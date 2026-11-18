import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { recipientsFor } from "@/lib/desk-settings";
import { passengersWords, replyDueLine, requestStage, tripState } from "@/lib/desk-status";
import { sendDispatchAlert } from "@/lib/email";
import { formatClock, relativeTime } from "@/lib/request-page";
import { reportStore } from "@/domain/reports/store";

// Morning summary — one email at 7 AM Los Angeles (wrangler.jsonc cron "0 14,15 * * *"
// UTC, the route keeps the 7 AM one) to the staff who turned on "Morning summary" in Settings ›
// Notifications. Lists today's flights and the open requests in plain
// sentences. With nobody subscribed it sends nothing. Both reads go through the report store
// (OPS-163): Postgres until the move, D1 where DB_TARGET is "d1".

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

function place(city: string | null, name: string | null, iata: string | null): string {
  return city ?? name ?? iata ?? "—";
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Two UTC slots cover daylight saving; only the one that is 7 AM in Los
  // Angeles sends.
  const laHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: LA, hour: "numeric", hour12: false }).format(new Date()));
  if (laHour !== 7) {
    return NextResponse.json({ ok: true, skipped: `it is ${laHour}:00 in Los Angeles, not 7:00` });
  }

  const recipients = await recipientsFor("morningSummary");
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: "nobody has the morning summary on" });
  }

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: LA, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const todayWords = new Intl.DateTimeFormat("en-US", { timeZone: LA, weekday: "long", month: "long", day: "numeric" }).format(now);
  const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: LA, weekday: "short", month: "short", day: "numeric" }).format(now);

  const reports = reportStore();
  const [flights, requests] = await Promise.all([reports.flightsOn(today), reports.openRequestsForSummary()]);

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
