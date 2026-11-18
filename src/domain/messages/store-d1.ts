import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { chunks } from "@/db/d1/helpers";
import { messages } from "@/db/d1/schema/audit";
import { members } from "@/db/d1/schema/members";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import type { MessageStore } from "./store";

// The D1 (SQLite) side of the message store (OPS-127). Same methods and the
// same results as store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// Differences from Postgres: ids are text made by newId() on insert, the
// timestamps are integer milliseconds that drizzle maps to Date (a raw max()
// comes back as a number and is mapped here), the enums are text with CHECK
// constraints, there are no ::int or ::timestamptz casts and no `public.`
// prefix. Three queries are rewritten because SQLite lacks the Postgres form:
//   - the newest message of each thread (no DISTINCT ON): row_number() over a
//     partition, keep rank 1;
//   - the count of threads with unread messages (no count(distinct (a, b))):
//     count over a select distinct subquery;
//   - the Los Angeles day: the caller passes the day's start and end as
//     instants (see laDayBounds), compared as integer milliseconds.
// count(*) filter (where ...) becomes sum(case when ... then 1 else 0 end).

type D1Client = DrizzleD1Database;

export function d1MessageStore(db: D1Client): MessageStore {
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
          lastAt: sql<number>`max(${messages.occurredAt})`,
          unread: sql<number>`sum(case when ${messages.direction} = 'in' and ${messages.isRead} = 0 then 1 else 0 end)`,
          spoken: sql<number>`sum(case when ${messages.channel} not in ('call', 'voicemail') then 1 else 0 end)`,
        })
        .from(messages)
        .where(inArray(messages.subjectType, kinds))
        .groupBy(messages.subjectType, messages.subjectId)
        .orderBy(desc(sql`max(${messages.occurredAt})`))
        .limit(limit);
      return rows.map((r) => ({
        subjectType: r.subjectType,
        subjectId: r.subjectId,
        lastAt: new Date(Number(r.lastAt)),
        unread: Number(r.unread ?? 0),
        spoken: Number(r.spoken ?? 0),
      }));
    },

    async latestPerThread(kinds, subjectIds) {
      // D1 allows 100 bound parameters a query: the kinds and the ids share them, so the
      // ids go in chunks (the thread list asks for up to 100 threads).
      const size = Math.max(1, 90 - kinds.length);
      const out: Awaited<ReturnType<MessageStore["latestPerThread"]>> = [];
      for (let i = 0; i < subjectIds.length; i += size) {
        const ids = subjectIds.slice(i, i + size);
        const ranked = db
          .select({
            subjectType: messages.subjectType,
            subjectId: messages.subjectId,
            direction: messages.direction,
            preview: messages.preview,
            body: messages.body,
            rank: sql<number>`row_number() over (partition by ${messages.subjectType}, ${messages.subjectId} order by ${messages.occurredAt} desc)`.as(
              "rank",
            ),
          })
          .from(messages)
          .where(and(inArray(messages.subjectType, kinds), inArray(messages.subjectId, ids)))
          .as("ranked");
        const rows = await db
          .select({
            subjectType: ranked.subjectType,
            subjectId: ranked.subjectId,
            direction: ranked.direction,
            preview: ranked.preview,
            body: ranked.body,
          })
          .from(ranked)
          .where(eq(ranked.rank, 1));
        out.push(...rows);
      }
      return out;
    },

    async unreadThreadCount(kinds) {
      const threads = db
        .selectDistinct({ subjectType: messages.subjectType, subjectId: messages.subjectId })
        .from(messages)
        .where(and(inArray(messages.subjectType, kinds), eq(messages.direction, "in"), eq(messages.isRead, false)))
        .as("unread_threads");
      const [row] = await db.select({ n: count() }).from(threads);
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

    async threadSubjects({ quoteIds, tripIds, memberIds }) {
      // The same five reads as the Postgres store, each id list read in chunks of
      // ID_CHUNK (D1 allows 100 bound values per statement) and put back together.
      // All legs of one quote or trip are in one chunk, so each subject's leg_number
      // order is kept (OPS-165).
      const out: Awaited<ReturnType<MessageStore["threadSubjects"]>> = {
        quotes: [],
        quoteLegs: [],
        trips: [],
        tripLegs: [],
        members: [],
      };
      for (const part of chunks(quoteIds)) {
        out.quotes.push(
          ...(await db
            .select({
              id: quotes.id,
              status: quotes.status,
              memberId: quotes.memberId,
              contactSnapshot: quotes.contactSnapshot,
            })
            .from(quotes)
            .where(inArray(quotes.id, part))),
        );
        out.quoteLegs.push(
          ...(await db
            .select({
              quoteId: quoteLegs.quoteId,
              fromCity: quoteLegs.fromCity,
              fromName: quoteLegs.fromName,
              fromIata: quoteLegs.fromIata,
              toCity: quoteLegs.toCity,
              toName: quoteLegs.toName,
              toIata: quoteLegs.toIata,
              departDate: quoteLegs.departDate,
            })
            .from(quoteLegs)
            .where(inArray(quoteLegs.quoteId, part))
            .orderBy(asc(quoteLegs.legNumber))),
        );
      }
      for (const part of chunks(tripIds)) {
        out.trips.push(
          ...(await db
            .select({
              id: trips.id,
              status: trips.status,
              memberId: trips.memberId,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
              phone: users.phoneE164,
            })
            .from(trips)
            .innerJoin(members, eq(members.id, trips.memberId))
            .innerJoin(users, eq(users.id, members.userId))
            .where(inArray(trips.id, part))),
        );
        out.tripLegs.push(
          ...(await db
            .select({
              tripId: tripLegs.tripId,
              fromCity: tripLegs.fromCity,
              fromName: tripLegs.fromName,
              fromIata: tripLegs.fromIata,
              toCity: tripLegs.toCity,
              toName: tripLegs.toName,
              toIata: tripLegs.toIata,
              departDate: tripLegs.departDate,
            })
            .from(tripLegs)
            .where(inArray(tripLegs.tripId, part))
            .orderBy(asc(tripLegs.legNumber))),
        );
      }
      for (const part of chunks(memberIds)) {
        out.members.push(
          ...(await db
            .select({
              id: members.id,
              tier: members.tier,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
              phone: users.phoneE164,
              mobile: members.mobileE164,
            })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(inArray(members.id, part))),
        );
      }
      return out;
    },

    async subjectCode(subjectType, id) {
      if (subjectType === "quote") {
        const [q] = await db.select({ code: quotes.quoteCode }).from(quotes).where(eq(quotes.id, id));
        return q?.code ?? null;
      }
      const [t] = await db.select({ code: trips.tripCode }).from(trips).where(eq(trips.id, id));
      return t?.code ?? null;
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
        .limit(50) as never;
    },

    async unreadInbound() {
      const [row] = await db
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.direction, "in"), eq(messages.isRead, false)));
      return row?.n ?? 0;
    },

    async snapshotCounts(since7) {
      const [[unread], [failed]] = await Promise.all([
        db
          .select({ n: count() })
          .from(messages)
          .where(and(eq(messages.direction, "in"), eq(messages.isRead, false))),
        db
          .select({ n: count() })
          .from(messages)
          .where(
            and(eq(messages.direction, "out"), eq(messages.deliveryStatus, "failed"), gte(messages.occurredAt, since7)),
          ),
      ]);
      return { unread: unread?.n ?? 0, failed: failed?.n ?? 0 };
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
  };
}
