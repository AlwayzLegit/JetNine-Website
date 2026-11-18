import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, notExists, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { chunks } from "@/db/d1/helpers";
import { aircraft } from "@/db/d1/schema/aircraft";
import { auditLog, messages } from "@/db/d1/schema/audit";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/d1/schema/schedule-blocks";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { OPEN_REQUEST_STATUSES } from "@/lib/desk-status";
import { IS_SMOKE_D1, NOT_SMOKE_D1 } from "@/domain/smoke-d1";
import type { RequestStaffRow, RequestStore } from "./store";

// The D1 (SQLite) side of the request store (OPS-154). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so
// a test can hand it a real SQLite.
//
// Differences from Postgres:
// - ilike becomes lower(x) like lower(?) escape '\' (the pattern comes from likePattern).
// - ->> becomes json_extract on the snapshot, which D1 keeps as JSON text.
// - No ::int casts: count(*) is an integer. count(*) filter (where ...) becomes
//   sum(case when ... then 1 else 0 end). Booleans are 0 and 1 (is_chosen = 1).
// - Every timestamp is integer milliseconds. Drizzle maps a Date for a column; in raw SQL the
//   caller binds getTime().
// - D1 allows 100 bound values per statement: the id lists are read and written in chunks of 50.
// - No interactive transaction from a Worker: the prune is atomic batches, and every
//   statement repeats the guard that picked the rows, so a quote that got a trip between the
//   read and the batch keeps its messages and itself.

type D1Client = DrizzleD1Database;

const ESCAPE = sql.raw(`escape '\\'`);

/** lower(expr) like lower(pattern) escape '\' : the D1 spelling of `expr ilike pattern`. */
const ilike = (expr: ReturnType<typeof sql>, pattern: string) => sql`lower(${expr}) like lower(${pattern}) ${ESCAPE}`;

const STALE_SMOKE_DAYS = 7;

export function d1RequestStore(db: D1Client): RequestStore {
  return {
    async listRows({ bookedSince, closedSince, pattern, limit }) {
      const openOrRecentlyBooked = or(
        inArray(quotes.status, [...OPEN_REQUEST_STATUSES]),
        and(
          inArray(quotes.status, ["accepted", "converted"]),
          sql`coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${bookedSince.getTime()}`,
        ),
        // Closed (declined / expired / cancelled) stays findable for a month.
        and(inArray(quotes.status, ["declined", "expired", "cancelled"]), gte(quotes.updatedAt, closedSince)),
      );

      const first = sql`json_extract(${quotes.contactSnapshot}, '$.firstName')`;
      const last = sql`json_extract(${quotes.contactSnapshot}, '$.lastName')`;
      const search = pattern
        ? or(
            ilike(first, pattern),
            ilike(last, pattern),
            ilike(sql`(${first} || ' ' || ${last})`, pattern),
            ilike(sql`json_extract(${quotes.contactSnapshot}, '$.email')`, pattern),
            sql`exists (
          select 1 from ${quoteLegs}
          where ${quoteLegs.quoteId} = ${quotes.id}
            and (
              ${ilike(sql`${quoteLegs.fromCity}`, pattern)} or ${ilike(sql`${quoteLegs.toCity}`, pattern)}
              or ${ilike(sql`${quoteLegs.fromName}`, pattern)} or ${ilike(sql`${quoteLegs.toName}`, pattern)}
              or ${ilike(sql`${quoteLegs.fromIata}`, pattern)} or ${ilike(sql`${quoteLegs.toIata}`, pattern)}
            )
        )`,
          )
        : undefined;

      const rows = await db
        .select({
          id: quotes.id,
          quoteCode: quotes.quoteCode,
          status: quotes.status,
          source: quotes.source,
          tripType: quotes.tripType,
          paxCount: quotes.paxCount,
          notes: quotes.notes,
          contactSnapshot: quotes.contactSnapshot,
          memberId: quotes.memberId,
          memberTier: members.tier,
          receivedAt: quotes.receivedAt,
          slaDeadlineAt: quotes.slaDeadlineAt,
          respondedAt: quotes.respondedAt,
          acceptedAt: quotes.acceptedAt,
          updatedAt: quotes.updatedAt,
          convertedTripId: quotes.convertedTripId,
          dispatcherName: staff.displayName,
        })
        .from(quotes)
        .leftJoin(members, eq(members.id, quotes.memberId))
        .leftJoin(staff, eq(staff.id, quotes.assignedDispatcherId))
        .where(and(NOT_SMOKE_D1, openOrRecentlyBooked, search))
        .orderBy(desc(quotes.receivedAt))
        .limit(limit);
      return rows as Awaited<ReturnType<RequestStore["listRows"]>>;
    },

    async legsFor(ids) {
      const out: Awaited<ReturnType<RequestStore["legsFor"]>> = [];
      for (const part of chunks(ids)) {
        const rows = await db
          .select({
            quoteId: quoteLegs.quoteId,
            legNumber: quoteLegs.legNumber,
            fromIata: quoteLegs.fromIata,
            fromCity: quoteLegs.fromCity,
            fromName: quoteLegs.fromName,
            toIata: quoteLegs.toIata,
            toCity: quoteLegs.toCity,
            toName: quoteLegs.toName,
            departDate: quoteLegs.departDate,
            departTime: quoteLegs.departTime,
          })
          .from(quoteLegs)
          .where(inArray(quoteLegs.quoteId, part))
          .orderBy(asc(quoteLegs.legNumber));
        out.push(...rows);
      }
      return out;
    },

    async optionCountsFor(ids) {
      const out: Awaited<ReturnType<RequestStore["optionCountsFor"]>> = [];
      for (const part of chunks(ids)) {
        const rows = await db
          .select({
            quoteId: sourcedOptions.quoteId,
            total: sql<number>`count(*)`,
            sent: sql<number>`sum(case when ${sourcedOptions.status} in ('sent_to_client', 'accepted') then 1 else 0 end)`,
          })
          .from(sourcedOptions)
          .where(inArray(sourcedOptions.quoteId, part))
          .groupBy(sourcedOptions.quoteId);
        out.push(...rows.map((r) => ({ quoteId: r.quoteId, total: Number(r.total), sent: Number(r.sent) })));
      }
      return out;
    },

    async getQuote(id) {
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
      return quote as Awaited<ReturnType<RequestStore["getQuote"]>>;
    },

    async requestParts(quote, now) {
      const id = quote.id;
      const [legs, memberRows, dispatchers, assigneeRows, flownRows, heldRows, conflictRows, sourcedRows] =
        await Promise.all([
          db.select().from(quoteLegs).where(eq(quoteLegs.quoteId, id)).orderBy(asc(quoteLegs.legNumber)),
          // Full roster: the picker shows active members; the linked row may be paused.
          db
            .select({
              id: members.id,
              memberCode: members.memberCode,
              preferredName: members.preferredName,
              legalName: members.legalName,
              status: members.status,
              tier: members.tier,
            })
            .from(members)
            .orderBy(asc(members.memberCode)),
          db
            .select({ id: staff.id, displayName: staff.displayName })
            .from(staff)
            .innerJoin(users, eq(users.id, staff.userId))
            .where(eq(users.role, "dispatcher")),
          quote.assignedDispatcherId
            ? db
                .select({ id: staff.id, displayName: staff.displayName })
                .from(staff)
                .where(eq(staff.id, quote.assignedDispatcherId))
                .limit(1)
            : Promise.resolve([] as RequestStaffRow[]),
          quote.memberId
            ? db
                .select({ n: sql<number>`count(*)` })
                .from(trips)
                .where(
                  and(
                    eq(trips.memberId, quote.memberId),
                    notInArray(trips.status, ["draft", "cancelled_wx", "cancelled_other"]),
                  ),
                )
            : Promise.resolve([] as { n: number }[]),
          db
            .select({
              blockId: aircraftScheduleBlocks.id,
              aircraftId: aircraftScheduleBlocks.aircraftId,
              startAt: aircraftScheduleBlocks.startAt,
              endAt: aircraftScheduleBlocks.endAt,
              tailNumber: aircraft.tailNumber,
              makeModel: aircraft.makeModel,
            })
            .from(aircraftScheduleBlocks)
            .innerJoin(aircraft, eq(aircraft.id, aircraftScheduleBlocks.aircraftId))
            .where(and(eq(aircraftScheduleBlocks.relatedQuoteId, id), eq(aircraftScheduleBlocks.kind, "hold")))
            .orderBy(asc(aircraftScheduleBlocks.startAt)),
          db
            .select({
              aircraftId: aircraftScheduleBlocks.aircraftId,
              relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
              quoteCode: quotes.quoteCode,
            })
            .from(aircraftScheduleBlocks)
            .innerJoin(quotes, eq(quotes.id, aircraftScheduleBlocks.relatedQuoteId))
            // Only holds still in force; a request's old holds are no longer a conflict.
            .where(and(eq(aircraftScheduleBlocks.kind, "hold"), gt(aircraftScheduleBlocks.endAt, now))),
          db
            .select({
              id: sourcedOptions.id,
              optionNumber: sourcedOptions.optionNumber,
              avinodeRef: sourcedOptions.avinodeRef,
              aircraftType: sourcedOptions.aircraftType,
              tailNumber: sourcedOptions.tailNumber,
              isFloatingFleet: sourcedOptions.isFloatingFleet,
              yearOfMake: sourcedOptions.yearOfMake,
              category: sourcedOptions.category,
              paxCapacity: sourcedOptions.paxCapacity,
              refurbInteriorYear: sourcedOptions.refurbInteriorYear,
              refurbExteriorYear: sourcedOptions.refurbExteriorYear,
              operatorNameRaw: sourcedOptions.operatorNameRaw,
              operatorMatched: sourcedOptions.operatorMatched,
              safetyFloorPassed: sourcedOptions.safetyFloorPassed,
              positioningTimeMin: sourcedOptions.positioningTimeMin,
              positioningAirport: sourcedOptions.positioningAirport,
              totalFlightTimeMin: sourcedOptions.totalFlightTimeMin,
              operatorCostUsd: sourcedOptions.operatorCostUsd,
              markupType: sourcedOptions.markupType,
              markupValue: sourcedOptions.markupValue,
              clientPriceUsd: sourcedOptions.clientPriceUsd,
              isChosen: sourcedOptions.isChosen,
              status: sourcedOptions.status,
              dispatcherNotes: sourcedOptions.dispatcherNotes,
            })
            .from(sourcedOptions)
            .where(eq(sourcedOptions.quoteId, id))
            .orderBy(asc(sourcedOptions.optionNumber)),
        ]);

      return {
        legs: legs as Awaited<ReturnType<RequestStore["requestParts"]>>["legs"],
        memberRows,
        dispatchers,
        assignee: assigneeRows[0] ?? null,
        timesFlown: quote.memberId ? Number(flownRows[0]?.n ?? 0) : null,
        holds: heldRows,
        conflicts: conflictRows,
        sourcedOptions: sourcedRows as Awaited<ReturnType<RequestStore["requestParts"]>>["sourcedOptions"],
      };
    },

    async candidates({ category, pax, longestLegNm }) {
      const rows = await db
        .select({
          id: aircraft.id,
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          seats: aircraft.seats,
          rangeNm: aircraft.rangeNm,
          speedKt: aircraft.speedKt,
          wifiType: aircraft.wifiType,
          baseIcao: aircraft.baseIcao,
          status: aircraft.status,
          operatorId: aircraft.operatorId,
          operatorName: operators.name,
          isPreferred: operators.isPreferred,
          argusRating: operators.argusRating,
          wyvernWingman: operators.wyvernWingman,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .where(
          and(
            eq(aircraft.category, category),
            eq(aircraft.status, "available"),
            gte(aircraft.seats, pax),
            gte(aircraft.rangeNm, longestLegNm),
            ne(operators.status, "suspended"),
            ne(operators.status, "banned"),
            ne(operators.status, "hold"),
          ),
        )
        .orderBy(
          desc(operators.isPreferred),
          sql`case ${operators.argusRating}
            when 'platinum' then 0
            when 'gold' then 1
            when 'silver' then 2
            else 3 end`,
          desc(operators.wyvernWingman),
          asc(aircraft.tailNumber),
        )
        .limit(8);
      return rows;
    },

    // One statement, the claim is its WHERE: update ... where id in (select ... limit n)
    // returning. SQLite builds the subquery's id set before the first row changes, and two
    // runs cannot both claim a row because the second finds sla_alerted_at already set.
    async claimSlaOverdue(now, limit) {
      const windowStart = now.getTime() - 24 * 3_600_000;
      return db
        .update(quotes)
        .set({ slaAlertedAt: now })
        .where(
          sql`${quotes.id} in (
        select ${quotes.id} from ${quotes}
        where ${quotes.status} in ('submitted', 'triaged', 'sourcing')
          and ${quotes.slaDeadlineAt} < ${now.getTime()}
          and ${quotes.slaAlertedAt} is null
          and ${quotes.slaDeadlineAt} > ${windowStart}
        order by ${quotes.slaDeadlineAt} asc
        limit ${limit}
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
    },

    async dueSoon(now, soon, action, limit) {
      const rows = await db
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
          and(
            inArray(quotes.status, ["submitted", "triaged", "sourcing"]),
            gt(quotes.slaDeadlineAt, now),
            lte(quotes.slaDeadlineAt, soon),
            notExists(
              db
                .select({ one: sql`1` })
                .from(auditLog)
                .where(
                  and(
                    eq(auditLog.subjectType, "quote"),
                    eq(auditLog.subjectId, quotes.id),
                    eq(auditLog.action, action),
                  ),
                ),
            ),
          ),
        )
        .orderBy(asc(quotes.slaDeadlineAt))
        .limit(limit);
      return rows as Awaited<ReturnType<RequestStore["dueSoon"]>>;
    },

    async pruneSmoke(now, batch) {
      const cutoff = new Date(now.getTime() - STALE_SMOKE_DAYS * 86_400_000);
      // The test that picks a quote, repeated in every statement that removes one.
      const staleQuote = and(
        IS_SMOKE_D1,
        lt(quotes.createdAt, cutoff),
        notExists(db.select({ one: sql`1` }).from(trips).where(eq(trips.quoteId, quotes.id))),
      );
      const stale = await db.select({ id: quotes.id }).from(quotes).where(staleQuote).limit(batch);
      if (stale.length === 0) return 0;

      let removed = 0;
      for (const part of chunks(stale.map((row) => row.id))) {
        const dropMessages = db.delete(messages).where(
          and(
            eq(messages.subjectType, "quote"),
            inArray(messages.subjectId, part),
            inArray(messages.subjectId, db.select({ id: quotes.id }).from(quotes).where(staleQuote)),
          ),
        );
        const dropQuotes = db
          .delete(quotes)
          .where(and(inArray(quotes.id, part), staleQuote))
          .returning({ id: quotes.id });
        // Legs, sourced options and schedule blocks go with the quote (ON DELETE CASCADE).
        const [, gone] = await db.batch([dropMessages, dropQuotes]);
        removed += (gone as { id: string }[]).length;
      }
      return removed;
    },

    async exportRows(start, limit) {
      const first = alias(quoteLegs, "first_leg");
      const lastLeg = alias(quoteLegs, "last_leg");
      const firstNo = sql`(select min(${quoteLegs.legNumber}) from ${quoteLegs} where ${quoteLegs.quoteId} = ${quotes.id})`;
      const lastNo = sql`(select max(${quoteLegs.legNumber}) from ${quoteLegs} where ${quoteLegs.quoteId} = ${quotes.id})`;
      const rows = await db
        .select({
          received_at: quotes.receivedAt,
          client_name: sql<string | null>`nullif(trim(coalesce(json_extract(${quotes.contactSnapshot}, '$.firstName'), '') || ' ' || coalesce(json_extract(${quotes.contactSnapshot}, '$.lastName'), '')), '')`,
          email: sql<string | null>`json_extract(${quotes.contactSnapshot}, '$.email')`,
          from_city: first.fromCity,
          from_name: first.fromName,
          from_iata: first.fromIata,
          to_city: lastLeg.toCity,
          to_name: lastLeg.toName,
          to_iata: lastLeg.toIata,
          legs: sql<number>`(select count(*) from ${quoteLegs} where ${quoteLegs.quoteId} = ${quotes.id})`,
          pax_count: quotes.paxCount,
          status: quotes.status,
          booked_usd: sql<number | null>`case when ${quotes.status} in ('accepted', 'converted')
            then coalesce(${quotes.finalPriceUsd},
              (select ${sourcedOptions.clientPriceUsd} from ${sourcedOptions}
                where ${sourcedOptions.quoteId} = ${quotes.id} and ${sourcedOptions.isChosen} = 1 limit 1))
            else null end`,
        })
        .from(quotes)
        .leftJoin(first, and(eq(first.quoteId, quotes.id), eq(first.legNumber, firstNo)))
        .leftJoin(lastLeg, and(eq(lastLeg.quoteId, quotes.id), eq(lastLeg.legNumber, lastNo)))
        .where(and(gte(quotes.receivedAt, start), NOT_SMOKE_D1))
        .orderBy(desc(quotes.receivedAt))
        .limit(limit);
      return rows.map((r) => ({ ...r, legs: Number(r.legs) }));
    },
  };
}
