import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { recipientsFor } from "@/lib/desk-settings";
import { OPEN_REQUEST_STATUSES, passengersWords, replyDueLine, requestStage, tripState } from "@/lib/desk-status";
import { sendDispatchAlert } from "@/lib/email";
import { formatClock, relativeTime } from "@/lib/request-page";

// Morning summary — one email at 7 AM Los Angeles (vercel.json: "0 14 * * *"
// UTC) to the staff who turned on "Morning summary" in Settings ›
// Notifications. Lists today's flights and the open requests in plain
// sentences. With nobody subscribed it sends nothing.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LA = "America/Los_Angeles";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type FlightRow = {
  trip_id: string;
  status: string;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  depart_time: string | null;
  pax_count: number;
  client_name: string | null;
  aircraft: string | null;
};

type RequestRow = {
  id: string;
  status: string;
  received_at: Date;
  sla_deadline_at: Date;
  pax_count: number;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  client_name: string | null;
};

function place(city: string | null, name: string | null, iata: string | null): string {
  return city ?? name ?? iata ?? "—";
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const recipients = await recipientsFor("morningSummary");
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: "nobody has the morning summary on" });
  }

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: LA, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const todayWords = new Intl.DateTimeFormat("en-US", { timeZone: LA, weekday: "long", month: "long", day: "numeric" }).format(now);
  const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: LA, weekday: "short", month: "short", day: "numeric" }).format(now);

  const [flights, requests] = await Promise.all([
    db.execute<FlightRow>(sql`
      select t.id as trip_id, t.status, t.pax_count,
             l.from_city, l.from_name, l.from_iata, l.to_city, l.to_name, l.to_iata, l.depart_time,
             nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') as client_name,
             a.make_model as aircraft
      from public.trip_legs l
      join public.trips t on t.id = l.trip_id
      join public.members m on m.id = t.member_id
      join public.users u on u.id = m.user_id
      left join public.aircraft a on a.id = t.aircraft_id
      where l.depart_date = ${today}::date
        and t.status not in ('cancelled_wx', 'cancelled_other')
      order by l.depart_time asc nulls last, l.leg_number asc
      limit 40
    `),
    db.execute<RequestRow>(sql`
      select q.id, q.status, q.received_at, q.sla_deadline_at, q.pax_count,
             l.from_city, l.from_name, l.from_iata, l.to_city, l.to_name, l.to_iata,
             nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '') as client_name
      from public.quotes q
      left join public.quote_legs l on l.quote_id = q.id and l.leg_number = 1
      where q.status in (${sql.join(OPEN_REQUEST_STATUSES.map((s) => sql`${s}`), sql`, `)})
        and not (
          q.contact_snapshot->>'firstName' ilike '[SMOKE]%'
          or q.contact_snapshot->>'email' ilike 'smoke+%'
        )
      order by q.sla_deadline_at asc
      limit 40
    `),
  ]);

  const lines: string[] = [];

  // Today's flights
  if (flights.length === 0) {
    lines.push("No flights today.");
  } else {
    lines.push(`${flights.length} flight${flights.length === 1 ? "" : "s"} today:`);
    for (const f of flights) {
      const route = `${place(f.from_city, f.from_name, f.from_iata)} → ${place(f.to_city, f.to_name, f.to_iata)}`;
      const at = formatClock(f.depart_time);
      lines.push(
        `${f.client_name ?? "A client"} flies ${route}${at ? ` at ${at}` : ""}${f.aircraft ? ` on a ${f.aircraft}` : ""} · ${passengersWords(f.pax_count)} · ${tripState(f.status).label}.`,
      );
    }
  }

  lines.push("");

  // Open requests
  if (requests.length === 0) {
    lines.push("No open requests. All caught up.");
  } else {
    const needReply = requests.filter((r) => requestStage(r.status).key === "reply").length;
    const working = requests.filter((r) => requestStage(r.status).key === "working").length;
    const waiting = requests.filter((r) => requestStage(r.status).key === "sent").length;
    const parts = [
      needReply ? `${needReply} need${needReply === 1 ? "s" : ""} a reply` : null,
      working ? `${working} being worked on` : null,
      waiting ? `${waiting} waiting on the client` : null,
    ].filter((p): p is string => p !== null);
    lines.push(`${requests.length} open request${requests.length === 1 ? "" : "s"}${parts.length ? ` — ${parts.join(", ")}` : ""}:`);
    for (const r of requests) {
      const route = `${place(r.from_city, r.from_name, r.from_iata)} → ${place(r.to_city, r.to_name, r.to_iata)}`;
      const due = replyDueLine(r.sla_deadline_at, r.status, now);
      lines.push(
        `${r.client_name ?? "A client"} · ${route} · ${passengersWords(r.pax_count)} · received ${relativeTime(new Date(r.received_at), now).toLowerCase()} · ${due ? due.text : requestStage(r.status).label}.`,
      );
    }
  }

  const result = await sendDispatchAlert({
    subject: `Morning summary · ${shortDay}`,
    headline: `Good morning. Here's the desk for ${todayWords}.`,
    lines,
    link: { label: "Open the requests", url: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "")}/admin/requests` },
    to: recipients,
  });

  return NextResponse.json({
    ok: result.ok,
    recipients: recipients.length,
    flights: flights.length,
    openRequests: requests.length,
    ...(result.ok ? {} : { error: result.error }),
  });
}
