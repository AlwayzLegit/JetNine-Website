// The reply deadline of a contact enquiry (OPS-373). A quote has sla_deadline_at; a contact enquiry
// had none. Its deadline is the lead_desk row's reply_due_at, set when the pointer was sent, and it
// is watched by the sla-watch cron (a third pass) and listed in the morning summary.
import { and, asc, count, eq, gte, isNull, lte, min } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { contactInquiries } from "@/db/d1/schema/contact";
import { leadDesk } from "@/db/d1/schema/lead-desk";
import { d1Db } from "@/db";

export type OverdueContact = { id: string; inquiryId: string; receivedAt: Date; replyDueAt: Date };

/** A deadline missed by more than this is left to the desk's own list, as for quotes. */
export const STALE_AFTER_MS = 24 * 3_600_000;

/**
 * Claims the contact enquiries whose reply deadline has passed, that nobody has marked handled and
 * that were not alerted yet. Claim first, send second: sla_alerted_at is stamped with a guard on
 * "still null", so two overlapping runs cannot both claim a row. At most `limit` rows, oldest first.
 */
export async function claimContactOverdue(db: DrizzleD1Database, now: Date, limit: number): Promise<OverdueContact[]> {
  const due = await db
    .select({
      id: leadDesk.id,
      inquiryId: leadDesk.subjectId,
      receivedAt: leadDesk.receivedAt,
      replyDueAt: leadDesk.replyDueAt,
    })
    .from(leadDesk)
    .innerJoin(contactInquiries, eq(contactInquiries.id, leadDesk.subjectId))
    .where(
      and(
        eq(leadDesk.subjectType, "contact"),
        isNull(leadDesk.slaAlertedAt),
        lte(leadDesk.replyDueAt, now),
        gte(leadDesk.replyDueAt, new Date(now.getTime() - STALE_AFTER_MS)),
        eq(contactInquiries.status, "new"),
      ),
    )
    .orderBy(asc(leadDesk.replyDueAt))
    .limit(limit);

  const claimed: OverdueContact[] = [];
  for (const r of due) {
    if (!r.replyDueAt) continue;
    const won = await db
      .update(leadDesk)
      .set({ slaAlertedAt: now })
      .where(and(eq(leadDesk.id, r.id), isNull(leadDesk.slaAlertedAt)))
      .returning({ id: leadDesk.id });
    if (won.length > 0) claimed.push({ id: r.id, inquiryId: r.inquiryId, receivedAt: r.receivedAt, replyDueAt: r.replyDueAt });
  }
  return claimed;
}

/** For the morning summary: how many contact enquiries still wait, and when the oldest arrived. */
export async function waitingContactEnquiries(
  db: DrizzleD1Database,
): Promise<{ count: number; oldestAt: Date | null }> {
  const [row] = await db
    .select({ n: count(), oldest: min(leadDesk.receivedAt) })
    .from(leadDesk)
    .innerJoin(contactInquiries, eq(contactInquiries.id, leadDesk.subjectId))
    .where(and(eq(leadDesk.subjectType, "contact"), eq(contactInquiries.status, "new")));
  const oldest = row?.oldest ? new Date(row.oldest as unknown as number | Date) : null;
  return { count: row?.n ?? 0, oldestAt: oldest && Number.isFinite(oldest.getTime()) ? oldest : null };
}

/** Real client for the crons: null on a deployment with no D1 binding. */
export function contactSlaDb(): DrizzleD1Database | null {
  return d1Db();
}
