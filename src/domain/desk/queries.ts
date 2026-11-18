import { messageStore } from "@/domain/messages/store";
import { inquiryStore } from "@/domain/contact/store";
import { settingsStore } from "@/domain/settings/store";
import { REPLY_PROMISE_DEFAULT, REPLY_PROMISE_KEY } from "@/db/schema/desk";
import { reportStore } from "@/domain/reports/store";
import { countPending } from "@/domain/approvals/queries";
import { listTrips } from "@/domain/trips/queries";

/**
 * Desk-wide counts. `deskCounts` feeds the sidebar pills; `deskSnapshot`
 * is the one object the assistant reads to know how the desk is doing.
 * Every quote count leaves out the post-deploy smoke rows. The quote, invoice and empty-leg
 * counts go through the report store (OPS-163): Postgres until the move, D1 where DB_TARGET
 * is "d1".
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
  const [needsReply, unread, approvals] = await Promise.all([
    reportStore().submittedCount(),
    messageStore().unreadInbound(),
    countPending(),
  ]);
  return { needsReply, unread, approvals };
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
    const value = await settingsStore().getSetting(REPLY_PROMISE_KEY);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return REPLY_PROMISE_DEFAULT;
    return Math.round(n);
  } catch {
    return REPLY_PROMISE_DEFAULT;
  }
}

export async function deskSnapshot(now: Date = new Date()): Promise<DeskSnapshot> {
  const since14 = new Date(now.getTime() - 14 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  const reports = reportStore();
  const [q, m, newInquiries, overdueInvoices, liveEmptyLegs, tripList, promise, pendingApprovals] = await Promise.all([
    reports.quoteStageCounts(since14, now),
    messageStore().snapshotCounts(since7),
    inquiryStore().newCount(),
    reports.overdueInvoiceCount(),
    reports.liveEmptyLegCount(),
    listTrips({ tab: "upcoming", now }),
    replyPromiseMinutes(),
    countPending(),
  ]);

  return {
    needsReply: q.needsReply,
    working: q.working,
    optionsOut: q.optionsOut,
    bookedLast14Days: q.bookedLast14Days,
    overdueReplies: q.overdueReplies,
    unreadMessages: m?.unread ?? 0,
    newInquiries,
    failedDeliveries7Days: m?.failed ?? 0,
    pendingApprovals,
    upcomingTrips30Days: tripList.groups.find((g) => g.key === "soon")?.items.length ?? 0,
    flyingToday: tripList.flyingToday.length,
    overdueInvoices,
    liveEmptyLegs,
    replyPromiseMinutes: promise,
    generatedAt: now,
  };
}
