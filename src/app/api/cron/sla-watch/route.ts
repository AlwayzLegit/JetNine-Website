import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { quotes } from "@/db/schema/quotes";
import { logAudit } from "@/lib/audit";
import { getReplyPromiseMinutes, recipientsFor } from "@/lib/desk-settings";
import { minutesWords, replyPromiseWords, requestStage } from "@/lib/desk-status";
import { sendDispatchAlert } from "@/lib/email";

// SLA watch — the site promises options within the reply-time promise
// (Settings › Notifications, default 30 minutes) and `sla_deadline_at` is
// stamped on every quote. Runs every 10 minutes and does two passes:
//
// 1. Breach: each quote past its deadline pages the shared desk inbox
//    exactly once (claim-then-send on sla_alerted_at, so two overlapping
//    runs can't double-page).
// 2. Due soon: each quote whose deadline falls within the next 10 minutes
//    pages the staff who turned on "A reply is about to be late". The
//    quotes table has no second claim column and sla_alerted_at belongs to
//    the breach pass, so this pass claims through the audit log instead: a
//    `quote.reply_due_soon.notify` row per quote, written before the send,
//    and the query skips quotes that already have one.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap per run — a backlog of breaches (e.g. after a cron outage) should
// page in waves, not carpet-bomb the desk inbox in one tick.
const MAX_ALERTS_PER_RUN = 10;
const DUE_SOON_MINUTES = 10;
const DUE_SOON_ACTION = "quote.reply_due_soon.notify";

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

function clientName(snapshot: { firstName?: string; lastName?: string } | null): string {
  return `${snapshot?.firstName ?? ""} ${snapshot?.lastName ?? ""}`.trim() || "The client";
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const promiseMinutes = await getReplyPromiseMinutes();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // ── Pass 1: breaches ──────────────────────────────────────────────────
  // Claim first, send second: stamping sla_alerted_at in the same statement
  // that selects the rows means a concurrent run sees them as already
  // claimed. The claim itself is capped at MAX_ALERTS_PER_RUN (via the id
  // subquery) so a backlog pages in waves — unclaimed rows stay eligible
  // for the next tick. A crash between claim and send loses that one page
  // (the quote still shows as overdue on /admin/requests) — the same trade
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

  let sent = 0;
  let failed = 0;

  for (const q of claimed) {
    const overdueMin = Math.max(
      0,
      Math.round((now.getTime() - q.slaDeadlineAt.getTime()) / 60_000),
    );
    const ageMin = q.receivedAt
      ? Math.round((now.getTime() - q.receivedAt.getTime()) / 60_000)
      : null;
    const result = await sendDispatchAlert({
      subject: `[${q.quoteCode}] Reply overdue by ${minutesWords(overdueMin)}`,
      headline: `A request is past the reply promise — reply overdue by ${minutesWords(overdueMin)}.`,
      lines: [
        `${requestStage(q.status).label}${q.assignedDispatcherId ? "" : " · nobody has taken it yet"}.`,
        ageMin != null ? `The client has been waiting ${minutesWords(ageMin)}.` : "",
        `They were told they'd have options ${replyPromiseWords(promiseMinutes)} — send them something now, even a short holding note.`,
        `Reference ${q.quoteCode}`,
      ].filter(Boolean),
      link: { label: "Open the request", url: `${base}/admin/requests/${q.id}` },
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  // ── Pass 2: due soon ──────────────────────────────────────────────────
  // Only the staff who asked for it. With nobody subscribed the pass is a
  // no-op (the breach pass still covers the shared inbox).
  const dueSoonRecipients = await recipientsFor("replyDueSoon");
  let dueSoon = 0;
  let dueSoonSent = 0;
  let dueSoonFailed = 0;

  if (dueSoonRecipients.length > 0) {
    const soon = new Date(now.getTime() + DUE_SOON_MINUTES * 60_000);
    const candidates = await db
      .select({
        id: quotes.id,
        quoteCode: quotes.quoteCode,
        status: quotes.status,
        slaDeadlineAt: quotes.slaDeadlineAt,
        contactSnapshot: quotes.contactSnapshot,
        assignedDispatcherId: quotes.assignedDispatcherId,
      })
      .from(quotes)
      .where(
        sql`${quotes.status} in ('submitted', 'triaged', 'sourcing')
          and ${quotes.slaDeadlineAt} > ${now.toISOString()}::timestamptz
          and ${quotes.slaDeadlineAt} <= ${soon.toISOString()}::timestamptz
          and not exists (
            select 1 from ${auditLog}
            where ${auditLog.subjectType} = 'quote'
              and ${auditLog.subjectId} = ${quotes.id}
              and ${auditLog.action} = ${DUE_SOON_ACTION}
          )`,
      )
      .orderBy(asc(quotes.slaDeadlineAt))
      .limit(MAX_ALERTS_PER_RUN);

    dueSoon = candidates.length;

    for (const q of candidates) {
      const minutesLeft = Math.max(1, Math.round((q.slaDeadlineAt.getTime() - now.getTime()) / 60_000));
      const name = clientName(q.contactSnapshot);

      // Claim before sending so the next tick skips this quote.
      await logAudit({
        actorUserId: null,
        actorRole: "system",
        action: DUE_SOON_ACTION,
        subjectType: "quote",
        subjectId: q.id,
        subjectCode: q.quoteCode,
        metadata: { minutesLeft, recipients: dueSoonRecipients.length },
      });

      const result = await sendDispatchAlert({
        subject: `[${q.quoteCode}] Reply due in ${minutesWords(minutesLeft)} — ${name}`,
        headline: `${name} is due a reply in ${minutesWords(minutesLeft)}.`,
        lines: [
          `The reply promise (${minutesWords(promiseMinutes)}) runs out at ${q.slaDeadlineAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Los_Angeles",
          })} Los Angeles time.`,
          q.assignedDispatcherId ? "" : "Nobody has taken this request yet.",
          "Send options, or a short holding note so the client knows we're on it.",
          `Reference ${q.quoteCode}`,
        ].filter(Boolean),
        link: { label: "Open the request", url: `${base}/admin/requests/${q.id}` },
        to: dueSoonRecipients,
      });
      if (result.ok) dueSoonSent += 1;
      else dueSoonFailed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    breached: claimed.length,
    alerted: sent,
    failed,
    dueSoon,
    dueSoonAlerted: dueSoonSent,
    dueSoonFailed,
    dueSoonRecipients: dueSoonRecipients.length,
  });
}
