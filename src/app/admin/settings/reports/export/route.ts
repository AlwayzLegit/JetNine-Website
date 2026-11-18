import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { requestStage } from "@/lib/desk-status";
import { requestStore } from "@/domain/requests/store";
import { parsePeriod, periodStartDate } from "../period";

// Settings › Reports › "Download this period as a spreadsheet". Owner-only.
// One row per request received in the period: when, who, route, status in
// plain words, booked value. Small on purpose — the desk's own numbers,
// nothing the Reports page does not already show.

export const dynamic = "force-dynamic";

// The query is the request store's (OPS-154), Postgres or D1 by dbTarget().
const EXPORT_LIMIT = 5000;

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Spreadsheets treat a leading = + - @ as a formula; names come from the
  // public quote form, so neutralise them.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  const start = periodStartDate(period);

  const rows = await requestStore().exportRows(start, EXPORT_LIMIT);

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
