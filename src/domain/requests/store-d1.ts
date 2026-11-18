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
import { invoiceCodeSequence, invoices } from "@/db/d1/schema/invoices";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { tripCodeSequence, tripLegs, trips } from "@/db/d1/schema/trips";
import { codeSql, codeYear } from "@/db/codes";
import { planScheduleBlock } from "@/domain/trips/schedule-block";
import type { DrawdownOutcome } from "@/lib/membership-balance";
import { users } from "@/db/d1/schema/users";
import { OPEN_REQUEST_STATUSES } from "@/lib/desk-status";
import { IS_SMOKE_D1, NOT_SMOKE_D1 } from "@/domain/smoke-d1";
import { isUniqueViolation } from "@/db/unique";
import { HoldTaken, type ConvertResult, type RequestStaffRow, type RequestStore } from "./store";

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
// - OPS-155 (the desk's commands): the two multi-statement writes (markOptionsSent,
//   chooseOption) are one db.batch each, which D1 runs as one transaction. The request's
//   move to options_sent carries its status condition in the WHERE. Postgres sorts NULL dates
//   last and SQLite first, so the hold legs sort on "is null" first to keep the earliest dated leg
//   first. A duplicate soft hold fails on the unique index
//   ("UNIQUE constraint failed: aircraft_schedule_blocks...") and becomes HoldTaken.
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

    // ─── The desk's commands (OPS-155): the same calls as store-pg.ts on the D1 twins ─────

    async quoteHead(id) {
      const [row] = await db.select({ id: quotes.id, code: quotes.quoteCode }).from(quotes).where(eq(quotes.id, id)).limit(1);
      return row;
    },

    async quoteForStatus(id) {
      const [row] = await db
        .select({
          id: quotes.id,
          status: quotes.status,
          code: quotes.quoteCode,
          memberId: quotes.memberId,
          contactSnapshot: quotes.contactSnapshot,
        })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["quoteForStatus"]>>;
    },

    async memberContact(memberId) {
      const [row] = await db
        .select({ userId: members.userId, email: users.email })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, memberId));
      return row;
    },

    async memberUserId(memberId) {
      const [row] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, memberId));
      return row;
    },

    async setStatus(id, status, respondedAt) {
      // An undefined respondedAt is left out of the SET, as on Postgres.
      await db.update(quotes).set({ status, respondedAt }).where(eq(quotes.id, id));
    },

    async quoteForMessage(id) {
      const [row] = await db
        .select({
          id: quotes.id,
          code: quotes.quoteCode,
          memberId: quotes.memberId,
          contactSnapshot: quotes.contactSnapshot,
        })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["quoteForMessage"]>>;
    },

    async quoteForSendOptions(id) {
      const [row] = await db
        .select({
          id: quotes.id,
          code: quotes.quoteCode,
          status: quotes.status,
          paxCount: quotes.paxCount,
          memberId: quotes.memberId,
          contactSnapshot: quotes.contactSnapshot,
          statusToken: quotes.statusToken,
        })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["quoteForSendOptions"]>>;
    },

    async vettedOptions(quoteId) {
      const rows = await db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.safetyFloorPassed, true)))
        .orderBy(asc(sourcedOptions.optionNumber));
      return rows as Awaited<ReturnType<RequestStore["vettedOptions"]>>;
    },

    async legRoute(quoteId) {
      return db
        .select({ fromIata: quoteLegs.fromIata, toIata: quoteLegs.toIata })
        .from(quoteLegs)
        .where(eq(quoteLegs.quoteId, quoteId))
        .orderBy(asc(quoteLegs.legNumber));
    },

    // One batch: the options in chunks of 50 ids (D1 binds 100 values a statement), then the
    // request's move with its condition in the WHERE. One transaction, all or nothing.
    async markOptionsSent(quoteId, optionIds, now) {
      const flips = chunks(optionIds).map((part) =>
        db
          .update(sourcedOptions)
          .set({ status: "sent_to_client", updatedAt: now })
          .where(and(eq(sourcedOptions.quoteId, quoteId), inArray(sourcedOptions.id, part))),
      );
      const advance = db
        .update(quotes)
        .set({ status: "options_sent", respondedAt: now, updatedAt: now })
        .where(and(eq(quotes.id, quoteId), inArray(quotes.status, ["submitted", "triaged", "sourcing"])));
      await db.batch([...flips, advance] as unknown as [typeof advance]);
    },

    async quoteForAssign(id) {
      const [row] = await db
        .select({ id: quotes.id, code: quotes.quoteCode, assignedDispatcherId: quotes.assignedDispatcherId })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row;
    },

    async staffById(id) {
      const [row] = await db
        .select({ id: staff.id, displayName: staff.displayName })
        .from(staff)
        .where(eq(staff.id, id))
        .limit(1);
      return row;
    },

    async assign(quoteId, staffId) {
      await db.update(quotes).set({ assignedDispatcherId: staffId }).where(eq(quotes.id, quoteId));
    },

    async quoteForLink(id) {
      const [row] = await db
        .select({ id: quotes.id, code: quotes.quoteCode, memberId: quotes.memberId, convertedTripId: quotes.convertedTripId })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row;
    },

    async memberById(id) {
      const [row] = await db
        .select({ id: members.id, memberCode: members.memberCode })
        .from(members)
        .where(eq(members.id, id))
        .limit(1);
      return row;
    },

    async linkMember(quoteId, memberId, now) {
      await db.update(quotes).set({ memberId, updatedAt: now }).where(eq(quotes.id, quoteId));
    },

    async quoteForHold(id) {
      const [row] = await db
        .select({ id: quotes.id, code: quotes.quoteCode, status: quotes.status })
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["quoteForHold"]>>;
    },

    async aircraftById(id) {
      const [row] = await db
        .select({ id: aircraft.id, tailNumber: aircraft.tailNumber, status: aircraft.status })
        .from(aircraft)
        .where(eq(aircraft.id, id))
        .limit(1);
      return row;
    },

    async holdLegs(quoteId) {
      return db
        .select({ departDate: quoteLegs.departDate, departTime: quoteLegs.departTime })
        .from(quoteLegs)
        .where(eq(quoteLegs.quoteId, quoteId))
        // Postgres puts NULL last when ascending; SQLite puts it first, so say it.
        .orderBy(
          sql`${quoteLegs.departDate} is null`,
          asc(quoteLegs.departDate),
          sql`${quoteLegs.departTime} is null`,
          asc(quoteLegs.departTime),
        );
    },

    async holdFor(quoteId, aircraftId) {
      const [row] = await db
        .select({ id: aircraftScheduleBlocks.id })
        .from(aircraftScheduleBlocks)
        .where(
          and(
            eq(aircraftScheduleBlocks.aircraftId, aircraftId),
            eq(aircraftScheduleBlocks.relatedQuoteId, quoteId),
            eq(aircraftScheduleBlocks.kind, "hold"),
          ),
        )
        .limit(1);
      return row;
    },

    async insertHold(values) {
      try {
        // The id comes from the column default (crypto.randomUUID()).
        const [row] = await db
          .insert(aircraftScheduleBlocks)
          .values(values as never)
          .returning({ id: aircraftScheduleBlocks.id });
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) throw new HoldTaken();
        throw e;
      }
    },

    async holdById(id) {
      const [row] = await db
        .select({
          id: aircraftScheduleBlocks.id,
          kind: aircraftScheduleBlocks.kind,
          relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
          aircraftId: aircraftScheduleBlocks.aircraftId,
          tailNumber: aircraft.tailNumber,
        })
        .from(aircraftScheduleBlocks)
        .leftJoin(aircraft, eq(aircraft.id, aircraftScheduleBlocks.aircraftId))
        .where(eq(aircraftScheduleBlocks.id, id))
        .limit(1);
      return row;
    },

    async deleteHold(id) {
      await db.delete(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.id, id));
    },

    // The pattern is the caller's `%text%`, not escaped, as on Postgres (where ilike's own
    // escape character is the backslash too).
    async operatorLike(pattern) {
      const [row] = await db
        .select({
          id: operators.id,
          name: operators.name,
          status: operators.status,
          argusRating: operators.argusRating,
          wyvernWingman: operators.wyvernWingman,
          isbaoStage: operators.isbaoStage,
          insuranceRenewsOn: operators.insuranceRenewsOn,
          nextAuditOn: operators.nextAuditOn,
        })
        .from(operators)
        .where(ilike(sql`${operators.name}`, pattern))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["operatorLike"]>>;
    },

    async nextOptionNumber(quoteId) {
      const [{ maxNum }] = await db
        .select({ maxNum: sql<number>`coalesce(max(${sourcedOptions.optionNumber}), 0)` })
        .from(sourcedOptions)
        .where(eq(sourcedOptions.quoteId, quoteId));
      return Number(maxNum) + 1;
    },

    async insertOption(values) {
      const [row] = await db
        .insert(sourcedOptions)
        .values(values as never)
        .returning({ id: sourcedOptions.id });
      return row;
    },

    async optionOf(quoteId, optionId) {
      const [row] = await db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.id, optionId), eq(sourcedOptions.quoteId, quoteId)))
        .limit(1);
      return row as Awaited<ReturnType<RequestStore["optionOf"]>>;
    },

    async updateOption(id, fields, now) {
      await db
        .update(sourcedOptions)
        .set({ ...fields, updatedAt: now } as never)
        .where(eq(sourcedOptions.id, id));
    },

    // Two updates, nothing read between them: one batch, one transaction.
    async chooseOption(quoteId, optionId, now) {
      const clear = db.update(sourcedOptions).set({ isChosen: false, updatedAt: now }).where(eq(sourcedOptions.quoteId, quoteId));
      const pick = db
        .update(sourcedOptions)
        .set({ isChosen: true, status: "shortlisted", updatedAt: now })
        .where(eq(sourcedOptions.id, optionId));
      await db.batch([clear, pick]);
    },

    async deleteOption(id) {
      await db.delete(sourcedOptions).where(eq(sourcedOptions.id, id));
    },

    async quoteIdForOption(optionId) {
      const [row] = await db
        .select({ quoteId: sourcedOptions.quoteId })
        .from(sourcedOptions)
        .where(eq(sourcedOptions.id, optionId))
        .limit(1);
      return row?.quoteId;
    },

    async quoteLegsInOrder(quoteId) {
      const rows = await db.select().from(quoteLegs).where(eq(quoteLegs.quoteId, quoteId)).orderBy(asc(quoteLegs.legNumber));
      return rows as Awaited<ReturnType<RequestStore["quoteLegsInOrder"]>>;
    },

    async chosenOption(quoteId) {
      const [chosen] = await db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.isChosen, true)))
        .limit(1);
      return chosen as Awaited<ReturnType<RequestStore["chosenOption"]>>;
    },

    async aircraftIdByTail(tail) {
      const [ac] = await db.select({ id: aircraft.id }).from(aircraft).where(eq(aircraft.tailNumber, tail)).limit(1);
      return ac?.id;
    },

    async clientName(memberId) {
      const [m] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, memberId));
      return m;
    },

    async convertedTripOf(quoteId) {
      const [row] = await db
        .select({ convertedTripId: quotes.convertedTripId, quoteCode: quotes.quoteCode })
        .from(quotes)
        .where(eq(quotes.id, quoteId));
      return row;
    },

    // Convert to trip as one batch, which D1 runs as one transaction (OPS-157). D1 has no
    // interactive transaction and no advisory lock, and it runs one batch at a time per database,
    // so a statement that reads the balance and writes the draw only when the balance still covers
    // the total cannot be raced by another batch: that replaces the lock. The invoice turns paid
    // only if the draw row exists. A unique violation (a second convert of the same request, the
    // index trips_quote_id_uniq) anywhere rolls the whole batch back, the code counters included.
    async convertToTrip(plan) {
      const now = new Date();
      const year = codeYear(now);
      const tripId = crypto.randomUUID();
      const invoiceId = crypto.randomUUID();
      const drawId = crypto.randomUUID();
      const { quoteId, memberId } = plan;
      const total = plan.totalUsd ?? 0;

      // The trip has no wheels or ETA times yet, so the block (if any) comes from the legs alone.
      // Its notes carry the trip code, which the batch makes in SQL, so they are read in SQL too.
      const block = planScheduleBlock(
        {
          tripCode: "",
          aircraftId: plan.trip.aircraftId ?? null,
          status: "confirmed",
          wheelsUpAt: null,
          wheelsDownAt: null,
          etaAt: null,
        },
        plan.legs.map((l) => ({ scheduledDepAt: null, scheduledArrAt: null, departDate: l.departDate ?? null })),
      );

      const statements: unknown[] = [
        // (a) The trip counter moves first: the insert's code reads the value this leaves.
        db
          .insert(tripCodeSequence)
          .values({ year, lastValue: 1 })
          .onConflictDoUpdate({ target: tripCodeSequence.year, set: { lastValue: sql`${tripCodeSequence.lastValue} + 1` } }),
        // (b) The trip. The unique index trips_quote_id_uniq is the guard against a double convert.
        db.insert(trips).values({ ...plan.trip, id: tripId, tripCode: codeSql("trip", year) } as never),
        // (c) One insert per leg (each stays under D1's 100 bound values).
        ...plan.legs.map((l) => db.insert(tripLegs).values({ ...l, tripId } as never)),
      ];
      // (d) The aircraft's calendar block for the trip.
      if (block.action === "set") {
        statements.push(
          db.insert(aircraftScheduleBlocks).values({
            aircraftId: block.aircraftId,
            kind: "trip",
            startAt: block.startAt,
            endAt: block.endAt,
            relatedTripId: tripId,
            notes: sql`(select trip_code from trips where id = ${tripId})`,
          } as never),
        );
      }
      statements.push(
        // (e) The invoice counter, then (f) the invoice: due when a draw is tried, else draft.
        db
          .insert(invoiceCodeSequence)
          .values({ year, lastValue: 1 })
          .onConflictDoUpdate({ target: invoiceCodeSequence.year, set: { lastValue: sql`${invoiceCodeSequence.lastValue} + 1` } }),
        db
          .insert(invoices)
          .values({
            ...plan.invoice,
            id: invoiceId,
            invoiceCode: codeSql("invoice", year),
            tripId,
            status: plan.tryDraw ? "due" : "draft",
          } as never),
      );

      if (plan.tryDraw) {
        const ms = now.getTime();
        statements.push(
          // (g) The draw: written only when the member has an active membership (the newest
          // activated) and the ledger's balance still covers the total. insert ... select does not
          // run drizzle's default functions, so the id and the times are bound here.
          db.run(sql`insert into reserve_transactions
            (id, member_id, membership_id, kind, amount_usd, description, trip_id, invoice_id, occurred_at, created_at)
            select ${drawId}, ${memberId}, m.id, 'charter_draw', ${-total}, ${`Charter draw — invoice ${invoiceId}`}, ${tripId}, ${invoiceId}, ${ms}, ${ms}
            from memberships m
            where m.member_id = ${memberId} and m.status = 'active'
              and (select coalesce(sum(amount_usd), 0) from reserve_transactions where member_id = ${memberId}) >= ${total}
            order by m.activated_on desc
            limit 1`),
          // (h) The invoice turns paid only if the draw row exists; its note names the membership.
          db.run(sql`update invoices set
              status = 'paid', paid_on = ${now.toISOString().slice(0, 10)}, paid_at = ${ms},
              notes = coalesce(notes || char(10), '') || 'Auto-drawn from reserve membership ' ||
                (select membership_id from reserve_transactions where id = ${drawId}) || ${` — $${total.toLocaleString()}`},
              updated_at = ${ms}
            where id = ${invoiceId} and exists (select 1 from reserve_transactions where id = ${drawId})`),
          // (i) No draw: the optimistic due goes back to draft.
          db.run(sql`update invoices set status = 'draft', updated_at = ${ms} where id = ${invoiceId} and status = 'due'`),
        );
      }

      statements.push(
        // (j) Release the request's soft holds.
        db
          .delete(aircraftScheduleBlocks)
          .where(and(eq(aircraftScheduleBlocks.relatedQuoteId, quoteId), eq(aircraftScheduleBlocks.kind, "hold"))),
        // (k) Mark the request converted.
        db.update(quotes).set({ status: "converted", acceptedAt: now, convertedTripId: tripId }).where(eq(quotes.id, quoteId)),
      );

      await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);

      const [tripRow] = await db.select({ tripCode: trips.tripCode }).from(trips).where(eq(trips.id, tripId));
      let drawdown: DrawdownOutcome | null = null;
      if (plan.tryDraw) {
        const [draw] = await db
          .select({ id: reserveTransactions.id })
          .from(reserveTransactions)
          .where(eq(reserveTransactions.id, drawId));
        if (draw) {
          const [bal] = await db
            .select({ total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)` })
            .from(reserveTransactions)
            .where(eq(reserveTransactions.memberId, memberId));
          drawdown = { drew: true, amountUsd: total, reserveTxId: draw.id, remainingBalanceUsd: Number(bal?.total ?? 0) };
        } else {
          const [active] = await db
            .select({ id: memberships.id })
            .from(memberships)
            .where(and(eq(memberships.memberId, memberId), eq(memberships.status, "active")))
            .limit(1);
          drawdown = { drew: false, reason: active ? "INSUFFICIENT_BALANCE" : "NO_ACTIVE_MEMBERSHIP" };
        }
      }
      const result: ConvertResult = {
        trip: { id: tripId, tripCode: tripRow?.tripCode ?? "" },
        invoice: { id: invoiceId },
        drawdown,
      };
      return result;
    },
  };
}
