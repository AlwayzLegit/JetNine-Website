import { and, asc, count, desc, eq, gte, inArray, lt, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import type { MessageStore } from "./store";

// The Postgres side of the message store (OPS-127): the queries that lived in
// the messages domain, the desk counts, the settings health read, the request
// and trip commands, the member's trip page and the three webhooks, moved as
// they were.

export function pgMessageStore(): MessageStore {
  return {
    async insertMessage(values) {
      const [row] = await db.insert(messages).values(values).returning({ id: messages.id });
      return row;
    },

    async setDelivery(id, patch) {
      await db.update(messages).set(patch).where(eq(messages.id, id));
    },

    async markFailedByProviderId(providerMessageId, error) {
      return db
        .update(messages)
        .set({ deliveryStatus: "failed", deliveryError: error })
        .where(eq(messages.deliveryMessageId, providerMessageId))
        .returning({
          id: messages.id,
          subjectType: messages.subjectType,
          subjectId: messages.subjectId,
          toAddress: messages.toAddress,
          preview: messages.preview,
        });
    },

    async unreadInThread(kind, id) {
      const [row] = await db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.subjectType, kind),
            eq(messages.subjectId, id),
            eq(messages.direction, "in"),
            eq(messages.isRead, false),
          ),
        );
      return row?.n ?? 0;
    },

    async markThreadRead(kind, id) {
      const updated = await db
        .update(messages)
        .set({ isRead: true })
        .where(
          and(
            eq(messages.subjectType, kind),
            eq(messages.subjectId, id),
            eq(messages.direction, "in"),
            eq(messages.isRead, false),
          ),
        )
        .returning({ id: messages.id });
      return updated.length;
    },

    async threadSummaries(kinds, limit) {
      const rows = await db
        .select({
          subjectType: messages.subjectType,
          subjectId: messages.subjectId,
          lastAt: dsql<string>`max(${messages.occurredAt})`,
          unread: dsql<number>`count(*) filter (where ${messages.direction} = 'in' and ${messages.isRead} = false)::int`,
          spoken: dsql<number>`count(*) filter (where ${messages.channel} not in ('call', 'voicemail'))::int`,
        })
        .from(messages)
        .where(inArray(messages.subjectType, kinds))
        .groupBy(messages.subjectType, messages.subjectId)
        .orderBy(desc(dsql`max(${messages.occurredAt})`))
        .limit(limit);
      // Raw aggregates come back as strings from the driver.
      return rows.map((r) => ({ ...r, lastAt: new Date(r.lastAt) }));
    },

    async latestPerThread(kinds, subjectIds) {
      if (subjectIds.length === 0) return [];
      return db
        .selectDistinctOn([messages.subjectType, messages.subjectId], {
          subjectType: messages.subjectType,
          subjectId: messages.subjectId,
          direction: messages.direction,
          preview: messages.preview,
          body: messages.body,
        })
        .from(messages)
        .where(and(inArray(messages.subjectType, kinds), inArray(messages.subjectId, subjectIds)))
        .orderBy(messages.subjectType, messages.subjectId, desc(messages.occurredAt));
    },

    async unreadThreadCount(kinds) {
      const [row] = await db
        .select({
          n: dsql<number>`count(distinct (${messages.subjectType}, ${messages.subjectId}))::int`,
        })
        .from(messages)
        .where(and(inArray(messages.subjectType, kinds), eq(messages.direction, "in"), eq(messages.isRead, false)));
      return row?.n ?? 0;
    },

    async thread(subjectType, subjectId, limit) {
      return db
        .select({
          id: messages.id,
          channel: messages.channel,
          direction: messages.direction,
          fromAddress: messages.fromAddress,
          toAddress: messages.toAddress,
          preview: messages.preview,
          body: messages.body,
          occurredAt: messages.occurredAt,
          fromUserFirstName: users.firstName,
          fromUserEmail: users.email,
          deliveryStatus: messages.deliveryStatus,
          deliveryProvider: messages.deliveryProvider,
          deliveryError: messages.deliveryError,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.fromUserId))
        .where(and(eq(messages.subjectType, subjectType), eq(messages.subjectId, subjectId)))
        .orderBy(desc(messages.occurredAt))
        .limit(limit);
    },

    async messageForRetry(id) {
      const [m] = await db
        .select({
          id: messages.id,
          subjectType: messages.subjectType,
          subjectId: messages.subjectId,
          channel: messages.channel,
          direction: messages.direction,
          toAddress: messages.toAddress,
          body: messages.body,
          preview: messages.preview,
          deliveryStatus: messages.deliveryStatus,
        })
        .from(messages)
        .where(eq(messages.id, id));
      return m;
    },

    async failedSince(since) {
      return db
        .select({
          id: messages.id,
          subjectType: messages.subjectType,
          subjectId: messages.subjectId,
          channel: messages.channel,
          toAddress: messages.toAddress,
          preview: messages.preview,
          error: messages.deliveryError,
          occurredAt: messages.occurredAt,
          quoteCode: quotes.quoteCode,
          quoteContact: quotes.contactSnapshot,
          tripCode: trips.tripCode,
          tripFirstName: users.firstName,
          tripLastName: users.lastName,
        })
        .from(messages)
        .leftJoin(quotes, and(eq(messages.subjectType, "quote"), eq(quotes.id, messages.subjectId)))
        .leftJoin(trips, and(eq(messages.subjectType, "trip"), eq(trips.id, messages.subjectId)))
        .leftJoin(members, eq(members.id, trips.memberId))
        .leftJoin(users, eq(users.id, members.userId))
        .where(
          and(eq(messages.deliveryStatus, "failed"), eq(messages.direction, "out"), gte(messages.occurredAt, since)),
        )
        .orderBy(desc(messages.occurredAt))
        .limit(50);
    },

    async unreadInbound() {
      const [row] = await db
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.direction, "in"), eq(messages.isRead, false)));
      return row?.n ?? 0;
    },

    async snapshotCounts(since7) {
      const [m] = await db
        .select({
          unread: dsql<number>`count(*) filter (where ${messages.direction} = 'in' and ${messages.isRead} = false)::int`,
          failed: dsql<number>`count(*) filter (
            where ${messages.direction} = 'out' and ${messages.deliveryStatus} = 'failed'
              and ${messages.occurredAt} >= ${since7.toISOString()}::timestamptz
          )::int`,
        })
        .from(messages)
        .where(
          or(
            and(eq(messages.direction, "in"), eq(messages.isRead, false)),
            and(eq(messages.direction, "out"), eq(messages.deliveryStatus, "failed"), gte(messages.occurredAt, since7)),
          ),
        );
      return { unread: m?.unread ?? 0, failed: m?.failed ?? 0 };
    },

    async emailsSentBetween(start, end) {
      const [row] = await db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.channel, "email"),
            eq(messages.direction, "out"),
            eq(messages.deliveryStatus, "sent"),
            gte(messages.occurredAt, start),
            lt(messages.occurredAt, end),
          ),
        );
      return row?.n ?? 0;
    },

    async memberTripTimeline(tripId) {
      return db
        .select({
          id: messages.id,
          channel: messages.channel,
          body: messages.body,
          preview: messages.preview,
          occurredAt: messages.occurredAt,
        })
        .from(messages)
        .where(and(eq(messages.subjectType, "trip"), eq(messages.subjectId, tripId), eq(messages.direction, "out")))
        .orderBy(asc(messages.occurredAt));
    },

    async threadByCode(code) {
      // Quote codes AND trip codes both use the JN- prefix (JN-YYYY-NNNNN for quotes,
      // JN-YYYY-NNNN for trips, see migrations 0003/0008), so a JN- code is tried against
      // BOTH tables: quotes first (the options-sheet reply is the highest-volume inbound),
      // then trips. QT- is kept for backward compatibility with older outbound subjects.
      if (code.startsWith("QT-") || code.startsWith("JN-")) {
        const [row] = await db
          .select({ id: quotes.id, memberUserId: members.userId })
          .from(quotes)
          .leftJoin(members, eq(members.id, quotes.memberId))
          .where(eq(quotes.quoteCode, code));
        if (row) return { subjectType: "quote", subjectId: row.id, toUserId: row.memberUserId ?? null };
      }
      if (code.startsWith("JN-")) {
        const [row] = await db
          .select({ id: trips.id, memberUserId: members.userId })
          .from(trips)
          .innerJoin(members, eq(members.id, trips.memberId))
          .where(eq(trips.tripCode, code));
        if (!row) return null;
        return { subjectType: "trip", subjectId: row.id, toUserId: row.memberUserId };
      }
      // INV-... could route to the invoice's trip, but that is not a thread surface yet.
      return null;
    },

    async userIdByEmail(email) {
      const [hit] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      return hit ?? null;
    },
  };
}
