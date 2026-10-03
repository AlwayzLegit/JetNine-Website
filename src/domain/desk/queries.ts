import { and, count, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes } from "@/db/schema/quotes";
import { messages } from "@/db/schema/audit";
import { contactInquiries } from "@/db/schema/contact";
import { invoices } from "@/db/schema/invoices";
import { emptyLegs } from "@/db/schema/empty-legs";
import { REPLY_PROMISE_DEFAULT, REPLY_PROMISE_KEY, deskSettings } from "@/db/schema/desk";
import { NOT_SMOKE, isoParam } from "@/domain/common";
import { countPending } from "@/domain/approvals/queries";
import { listTrips } from "@/domain/trips/queries";

/**
 * Desk-wide counts. `deskCounts` feeds the sidebar pills; `deskSnapshot`
 * is the one object the assistant reads to know how the desk is doing.
 * Every quote count leaves out the post-deploy smoke rows.
 */

export type DeskCounts = {
  /** Requests waiting on a first reply (status submitted). */
  needsReply: number;
  /** Unread inbound messages. */
  unread: number;
  /** Proposals from the assistant waiting for someone to decide. */
  approvals: number;
};

export async function deskCounts(): Promise<DeskCounts> {
  const [[reply], [unread], approvals] = await Promise.all([
    db
      .select({ n: count() })
      .from(quotes)
      .where(and(eq(quotes.status, "submitted"), NOT_SMOKE)),
    db
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.direction, "in"), eq(messages.isRead, false))),
    countPending(),
  ]);
  return { needsReply: reply?.n ?? 0, unread: unread?.n ?? 0, approvals };
}

export type DeskSnapshot = {
  /** Requests waiting on a first reply. */
  needsReply: number;
  /** Requests the desk is working on (triaged or sourcing). */
  working: number;
  /** Requests with options out to the client (options sent or aircraft held). */
  optionsOut: number;
  /** Requests booked (accepted or converted) in the last 14 days. */
  bookedLast14Days: number;
  /** Requests waiting on a reply past their deadline. */
  overdueReplies: number;
  unreadMessages: number;
  /** Contact-form inquiries nobody has handled. */
  newInquiries: number;
  /** Outbound messages the provider failed to deliver in the last 7 days. */
  failedDeliveries7Days: number;
  /** Proposals from a supervised key waiting for a person to approve or reject. */
  pendingApprovals: number;
  /** Upcoming trips in the next 30 days (the trips page's "Next 30 days" group). */
  upcomingTrips30Days: number;
  /** Trips flying today, LA calendar (boarding/airborne or first leg today). */
  flyingToday: number;
  overdueInvoices: number;
  liveEmptyLegs: number;
  /** Minutes a new request gets before its reply is late (desk setting). */
  replyPromiseMinutes: number;
  generatedAt: Date;
};

const DAY_MS = 86_400_000;

/** Reads desk_settings.reply_promise_minutes; defaults to 30 and never throws. */
export async function replyPromiseMinutes(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: deskSettings.value })
      .from(deskSettings)
      .where(eq(deskSettings.key, REPLY_PROMISE_KEY))
      .limit(1);
    const n = Number(row?.value);
    if (!Number.isFinite(n) || n <= 0) return REPLY_PROMISE_DEFAULT;
    return Math.round(n);
  } catch {
    return REPLY_PROMISE_DEFAULT;
  }
}

export async function deskSnapshot(now: Date = new Date()): Promise<DeskSnapshot> {
  const since14 = new Date(now.getTime() - 14 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const nowIso = isoParam(now);

  const [[q], [m], [inq], [inv], [el], tripList, promise, pendingApprovals] = await Promise.all([
    db
      .select({
        needsReply: sql<number>`count(*) filter (where ${quotes.status} = 'submitted')::int`,
        working: sql<number>`count(*) filter (where ${quotes.status} in ('triaged', 'sourcing'))::int`,
        optionsOut: sql<number>`count(*) filter (where ${quotes.status} in ('options_sent', 'held'))::int`,
        bookedLast14Days: sql<number>`count(*) filter (
          where ${quotes.status} in ('accepted', 'converted')
            and coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${isoParam(since14)}::timestamptz
        )::int`,
        overdueReplies: sql<number>`count(*) filter (
          where ${quotes.status} = 'submitted' and ${quotes.slaDeadlineAt} < ${nowIso}::timestamptz
        )::int`,
      })
      .from(quotes)
      .where(NOT_SMOKE),
    db
      .select({
        unread: sql<number>`count(*) filter (where ${messages.direction} = 'in' and ${messages.isRead} = false)::int`,
        failed: sql<number>`count(*) filter (
          where ${messages.direction} = 'out' and ${messages.deliveryStatus} = 'failed'
            and ${messages.occurredAt} >= ${isoParam(since7)}::timestamptz
        )::int`,
      })
      .from(messages)
      .where(
        or(
          and(eq(messages.direction, "in"), eq(messages.isRead, false)),
          and(eq(messages.direction, "out"), eq(messages.deliveryStatus, "failed"), gte(messages.occurredAt, since7)),
        ),
      ),
    db.select({ n: count() }).from(contactInquiries).where(eq(contactInquiries.status, "new")),
    db.select({ n: count() }).from(invoices).where(eq(invoices.status, "overdue")),
    db.select({ n: count() }).from(emptyLegs).where(eq(emptyLegs.status, "live")),
    listTrips({ tab: "upcoming", now }),
    replyPromiseMinutes(),
    countPending(),
  ]);

  return {
    needsReply: q?.needsReply ?? 0,
    working: q?.working ?? 0,
    optionsOut: q?.optionsOut ?? 0,
    bookedLast14Days: q?.bookedLast14Days ?? 0,
    overdueReplies: q?.overdueReplies ?? 0,
    unreadMessages: m?.unread ?? 0,
    newInquiries: inq?.n ?? 0,
    failedDeliveries7Days: m?.failed ?? 0,
    pendingApprovals,
    upcomingTrips30Days: tripList.groups.find((g) => g.key === "soon")?.items.length ?? 0,
    flyingToday: tripList.flyingToday.length,
    overdueInvoices: inv?.n ?? 0,
    liveEmptyLegs: el?.n ?? 0,
    replyPromiseMinutes: promise,
    generatedAt: now,
  };
}
