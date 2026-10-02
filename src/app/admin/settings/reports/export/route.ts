import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { requestStage } from "@/lib/desk-status";
import { NOT_SMOKE, parsePeriod, periodBounds } from "../period";

// Settings › Reports › "Download this period as a spreadsheet". Owner-only.
// One row per request received in the period: when, who, route, status in
// plain words, booked value. Small on purpose — the desk's own numbers,
// nothing the Reports page does not already show.

export const dynamic = "force-dynamic";

type ExportRow = {
  received_at: Date;
  client_name: string | null;
  email: string | null;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  legs: number;
  pax_count: number;
  status: string;
  booked_usd: number | null;
};

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function place(city: string | null, name: string | null, iata: string | null): string {
  return city ?? name ?? iata ?? "";
}

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export async function GET(request: Request): Promise<Response> {
  await requireAdmin();

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));
  const { start } = periodBounds(period);

  const rows = await db.execute<ExportRow>(sql`
    select
      q.received_at,
      nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '') as client_name,
      q.contact_snapshot->>'email' as email,
      f.from_city, f.from_name, f.from_iata,
      l.to_city, l.to_name, l.to_iata,
      (select count(*)::int from public.quote_legs x where x.quote_id = q.id) as legs,
      q.pax_count,
      q.status,
      case when q.status in ('accepted','converted')
           then coalesce(q.final_price_usd,
                         (select o.client_price_usd from public.sourced_options o
                           where o.quote_id = q.id and o.is_chosen limit 1))
           else null end as booked_usd
    from public.quotes q
    left join public.quote_legs f on f.quote_id = q.id
      and f.leg_number = (select min(leg_number) from public.quote_legs a where a.quote_id = q.id)
    left join public.quote_legs l on l.quote_id = q.id
      and l.leg_number = (select max(leg_number) from public.quote_legs b where b.quote_id = q.id)
    where q.received_at >= ${start}
      and ${NOT_SMOKE}
    order by q.received_at desc
    limit 5000
  `);

  const header = ["Received", "Name", "Email", "Route", "Legs", "Passengers", "Status", "Booked value (USD)"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const route = `${place(r.from_city, r.from_name, r.from_iata)} → ${place(r.to_city, r.to_name, r.to_iata)}`;
    lines.push(
      [
        WHEN.format(new Date(r.received_at)),
        r.client_name,
        r.email,
        route,
        r.legs,
        r.pax_count,
        requestStage(r.status).label,
        r.booked_usd,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const filename = `jetnine-requests-${period === "ytd" ? "this-year" : `last-${period}-days`}-${today}.csv`;

  // BOM so Excel opens the arrows and accents correctly.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
