import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes } from "@/db/schema/quotes";
import { sendDispatchAlert } from "@/lib/email";

// SLA watch — the site promises options "within 30 minutes" in the quote
// ack and on the contact page, and `sla_deadline_at` is stamped on every
// quote, but until this cron the promise was enforced only by a dispatcher
// happening to have /admin/dispatch open. Runs every 10 minutes; each
// breached quote pages the desk exactly once (claim-then-send on
// sla_alerted_at, so two overlapping runs can't double-page).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap per run — a backlog of breaches (e.g. after a cron outage) should
// page in waves, not carpet-bomb the desk inbox in one tick.
const MAX_ALERTS_PER_RUN = 10;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed — without a secret this endpoint would let anyone on the
  // internet spam the dispatch mailbox.
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

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Claim first, send second: stamping sla_alerted_at in the same statement
  // that selects the rows means a concurrent run sees them as already
  // claimed. The claim itself is capped at MAX_ALERTS_PER_RUN (via the id
  // subquery) so a backlog pages in waves — unclaimed rows stay eligible
  // for the next tick. A crash between claim and send loses that one page
  // (the quote still shows PAST SLA on /admin/dispatch) — the same trade
  // the watchlist cron documents and accepts.
  const claimed = await db
    .update(quotes)
    .set({ slaAlertedAt: now })
    .where(
      sql`${quotes.id} in (
        select id from ${quotes}
        where ${quotes.status} in ('submitted', 'triaged', 'sourcing')
          and ${quotes.slaDeadlineAt} < ${now.toISOString()}::timestamptz
          and ${quotes.slaAlertedAt} is null
          and ${quotes.slaDeadlineAt} > now() - interval '24 hours'
        order by ${quotes.slaDeadlineAt} asc
        limit ${MAX_ALERTS_PER_RUN}
      )`,
    )
    .returning({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      slaDeadlineAt: quotes.slaDeadlineAt,
      receivedAt: quotes.receivedAt,
      assignedDispatcherId: quotes.assignedDispatcherId,
    });

  const toAlert = claimed;
  let sent = 0;
  let failed = 0;

  for (const q of toAlert) {
    const overdueMin = Math.max(
      0,
      Math.round((now.getTime() - q.slaDeadlineAt.getTime()) / 60_000),
    );
    const ageMin = q.receivedAt
      ? Math.round((now.getTime() - q.receivedAt.getTime()) / 60_000)
      : null;
    const result = await sendDispatchAlert({
      subject: `[${q.quoteCode}] SLA BREACHED — ${overdueMin} min past the 30-min promise`,
      headline: `${q.quoteCode} has blown the 30-minute promise.`,
      lines: [
        `Status: ${q.status}${q.assignedDispatcherId ? "" : " · UNASSIGNED"}.`,
        ageMin != null ? `The customer has been waiting ${ageMin} minutes.` : "",
        "They were told options arrive within 30 minutes — get them something now, even a holding note.",
      ].filter(Boolean),
      link: { label: "Open the quote", url: `https://jetnine.com/admin/quote/${q.id}` },
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    breached: claimed.length,
    alerted: sent,
    failed,
  });
}
