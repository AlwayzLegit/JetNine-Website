import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, ne, notExists, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { messages } from "@/db/schema/audit";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { members } from "@/db/schema/members";
import { operators } from "@/db/schema/operators";
import { quoteLegs, quotes } from "@/db/schema/quotes";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { staff } from "@/db/schema/staff";
import { tripLegs, trips } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { nextCode } from "@/db/codes";
import { syncTripScheduleBlock } from "@/domain/trips/schedule-block";
import { attemptInvoiceDrawdown, type DrawdownOutcome } from "@/lib/membership-balance";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/audit";
import { OPEN_REQUEST_STATUSES } from "@/lib/desk-status";
import { isUniqueViolation } from "@/db/unique";
import { IS_SMOKE, NOT_SMOKE, isoParam } from "@/domain/common";
import { HoldTaken, type ConvertResult, type RequestStaffRow, type RequestStore } from "./store";

// The Postgres side of the request store (OPS-154): the queries of listRequests,
// getRequest, the SLA watch cron, the smoke prune and the reports export, moved here as
// they were. Nothing about them changes on Postgres.

/**
 * The export's own smoke filter, moved as it was (it is the Reports page's NOT_SMOKE in
 * src/app/admin/settings/reports/period.ts). Unlike the desk's NOT_SMOKE it has no coalesce,
 * so a quote with neither a first name nor an email is left out of the CSV on Postgres. That
 * is how it behaves today and this row does not change it; the D1 side uses the desk's
 * version (src/domain/smoke-d1.ts) and keeps such a quote.
 */
const EXPORT_NOT_SMOKE = sql`not (
  contact_snapshot->>'firstName' ilike '[SMOKE]%'
  or contact_snapshot->>'email' ilike 'smoke+%'
)`;

export function pgRequestStore(): RequestStore {
  return {
    async listRows({ bookedSince, closedSince, pattern, limit }) {
      const openOrRecentlyBooked = or(
        inArray(quotes.status, [...OPEN_REQUEST_STATUSES]),
        and(
          inArray(quotes.status, ["accepted", "converted"]),
          sql`coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${isoParam(bookedSince)}::timestamptz`,
        ),
        // Closed (declined / expired / cancelled) stays findable for a month.
        and(
          inArray(quotes.status, ["declined", "expired", "cancelled"]),
          sql`${quotes.updatedAt} >= ${isoParam(closedSince)}::timestamptz`,
        ),
      );

      const search = pattern
        ? or(
            sql`${quotes.contactSnapshot}->>'firstName' ilike ${pattern}`,
            sql`${quotes.contactSnapshot}->>'lastName' ilike ${pattern}`,
            sql`(${quotes.contactSnapshot}->>'firstName' || ' ' || ${quotes.contactSnapshot}->>'lastName') ilike ${pattern}`,
            sql`${quotes.contactSnapshot}->>'email' ilike ${pattern}`,
            sql`exists (
          select 1 from ${quoteLegs}
          where ${quoteLegs.quoteId} = ${quotes.id}
            and (
              ${quoteLegs.fromCity} ilike ${pattern} or ${quoteLegs.toCity} ilike ${pattern}
              or ${quoteLegs.fromName} ilike ${pattern} or ${quoteLegs.toName} ilike ${pattern}
              or ${quoteLegs.fromIata} ilike ${pattern} or ${quoteLegs.toIata} ilike ${pattern}
            )
        )`,
          )
        : undefined;

      return db
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
        .where(and(NOT_SMOKE, openOrRecentlyBooked, search))
        .orderBy(desc(quotes.receivedAt))
        .limit(limit);
    },

    async legsFor(ids) {
      if (ids.length === 0) return [];
      return db
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
        .where(inArray(quoteLegs.quoteId, ids))
        .orderBy(asc(quoteLegs.legNumber));
    },

    async optionCountsFor(ids) {
      if (ids.length === 0) return [];
      return db
        .select({
          quoteId: sourcedOptions.quoteId,
          total: sql<number>`count(*)::int`,
          sent: sql<number>`count(*) filter (where ${sourcedOptions.status} in ('sent_to_client', 'accepted'))::int`,
        })
        .from(sourcedOptions)
        .where(inArray(sourcedOptions.quoteId, ids))
        .groupBy(sourcedOptions.quoteId);
    },

    async getQuote(id) {
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
      return quote;
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
                .select({ n: sql<number>`count(*)::int` })
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
        legs,
        memberRows,
        dispatchers,
        assignee: assigneeRows[0] ?? null,
        timesFlown: quote.memberId ? (flownRows[0]?.n ?? 0) : null,
        holds: heldRows,
        conflicts: conflictRows,
        sourcedOptions: sourcedRows,
      };
    },

    async candidates({ category, pax, longestLegNm }) {
      return db
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
    },

    // Claim first, send second: stamping sla_alerted_at in the same statement that selects the
    // rows means a concurrent run sees them as already claimed. The claim is capped at `limit`
    // (via the id subquery) so a backlog pages in waves.
    async claimSlaOverdue(now, limit) {
      return db
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
      return db
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
              and ${auditLog.action} = ${action}
          )`,
        )
        .orderBy(asc(quotes.slaDeadlineAt))
        .limit(limit);
    },

    // Legs, sourced options and schedule blocks cascade from the quote. Thread messages are
    // polymorphic with no foreign key, so they go first, in the same transaction.
    async pruneSmoke(now, batch) {
      const cutoff = new Date(now.getTime() - 7 * 86_400_000);
      return db.transaction(async (tx) => {
        const stale = await tx
          .select({ id: quotes.id })
          .from(quotes)
          .where(
            and(
              IS_SMOKE,
              lt(quotes.createdAt, cutoff),
              notExists(tx.select({ one: sql`1` }).from(trips).where(eq(trips.quoteId, quotes.id))),
            ),
          )
          .limit(batch);
        if (stale.length === 0) return 0;

        const ids = stale.map((row) => row.id);
        await tx.delete(messages).where(and(eq(messages.subjectType, "quote"), inArray(messages.subjectId, ids)));
        await tx.delete(quotes).where(inArray(quotes.id, ids));
        return ids.length;
      });
    },

    async exportRows(start, limit) {
      const rows = await db.execute<{
        received_at: Date;
        client_name: string | null;
        email: string | null;
        from_city: string | null;
        from_name: string | null;
        from_iata: string | null;
        to_city: string | null;
        to_name: string | null;
        to_iata: string | null;
        legs: number;
        pax_count: number;
        status: string;
        booked_usd: number | null;
      }>(sql`
    select
      q.received_at,
      nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '') as client_name,
      q.contact_snapshot->>'email' as email,
      f.from_city, f.from_name, f.from_iata,
      l.to_city, l.to_name, l.to_iata,
      (select count(*)::int from public.quote_legs x where x.quote_id = q.id) as legs,
      q.pax_count,
      q.status,
      case when q.status in ('accepted','converted')
           then coalesce(q.final_price_usd,
                         (select o.client_price_usd from public.sourced_options o
                           where o.quote_id = q.id and o.is_chosen limit 1))
           else null end as booked_usd
    from public.quotes q
    left join public.quote_legs f on f.quote_id = q.id
      and f.leg_number = (select min(leg_number) from public.quote_legs a where a.quote_id = q.id)
    left join public.quote_legs l on l.quote_id = q.id
      and l.leg_number = (select max(leg_number) from public.quote_legs b where b.quote_id = q.id)
    where q.received_at >= ${isoParam(start)}::timestamptz
      and ${EXPORT_NOT_SMOKE}
    order by q.received_at desc
    limit ${limit}
  `);
      return Array.from(rows);
    },

    // ─── The desk's commands (OPS-155): today's queries, moved as they were ──────

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
      return row;
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
      return row;
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
      return row;
    },

    async vettedOptions(quoteId) {
      return db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.safetyFloorPassed, true)))
        .orderBy(asc(sourcedOptions.optionNumber));
    },

    async legRoute(quoteId) {
      return db
        .select({ fromIata: quoteLegs.fromIata, toIata: quoteLegs.toIata })
        .from(quoteLegs)
        .where(eq(quoteLegs.quoteId, quoteId))
        .orderBy(asc(quoteLegs.legNumber));
    },

    // Both updates as they were, in the same order. The request's move now carries its
    // condition in the WHERE (the plan of OPS-155) instead of a status read earlier in the app.
    async markOptionsSent(quoteId, optionIds, now) {
      await db
        .update(sourcedOptions)
        .set({ status: "sent_to_client", updatedAt: now })
        .where(and(eq(sourcedOptions.quoteId, quoteId), inArray(sourcedOptions.id, optionIds)));
      await db
        .update(quotes)
        .set({ status: "options_sent", respondedAt: now, updatedAt: now })
        .where(and(eq(quotes.id, quoteId), inArray(quotes.status, ["submitted", "triaged", "sourcing"])));
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
      return row;
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
        .orderBy(asc(quoteLegs.departDate), asc(quoteLegs.departTime));
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
        const [row] = await db.insert(aircraftScheduleBlocks).values(values).returning({ id: aircraftScheduleBlocks.id });
        return row;
      } catch (e) {
        // The partial unique index (migration 0032) catches the race where two people both
        // passed the duplicate check.
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
        .where(ilike(operators.name, pattern))
        .limit(1);
      return row;
    },

    async nextOptionNumber(quoteId) {
      const [{ maxNum }] = await db
        .select({ maxNum: sql<number>`coalesce(max(${sourcedOptions.optionNumber}), 0)` })
        .from(sourcedOptions)
        .where(eq(sourcedOptions.quoteId, quoteId));
      return Number(maxNum) + 1;
    },

    async insertOption(values) {
      const [row] = await db.insert(sourcedOptions).values(values).returning({ id: sourcedOptions.id });
      return row;
    },

    async optionOf(quoteId, optionId) {
      const [row] = await db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.id, optionId), eq(sourcedOptions.quoteId, quoteId)))
        .limit(1);
      return row;
    },

    async updateOption(id, fields, now) {
      await db
        .update(sourcedOptions)
        .set({ ...fields, updatedAt: now })
        .where(eq(sourcedOptions.id, id));
    },

    async chooseOption(quoteId, optionId, now) {
      await db.transaction(async (tx) => {
        await tx.update(sourcedOptions).set({ isChosen: false, updatedAt: now }).where(eq(sourcedOptions.quoteId, quoteId));
        await tx
          .update(sourcedOptions)
          .set({ isChosen: true, status: "shortlisted", updatedAt: now })
          .where(eq(sourcedOptions.id, optionId));
      });
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
      return db.select().from(quoteLegs).where(eq(quoteLegs.quoteId, quoteId)).orderBy(asc(quoteLegs.legNumber));
    },

    async chosenOption(quoteId) {
      const [chosen] = await db
        .select()
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.isChosen, true)))
        .limit(1);
      return chosen;
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

    // Today's transaction, moved as it was (OPS-157): the trip insert is the serialization point
    // against a double convert (the unique index trips_quote_id_uniq), and the advisory lock inside
    // attemptInvoiceDrawdown keeps two draws of one member apart.
    async convertToTrip(plan) {
      const { quoteId, memberId } = plan;
      return db.transaction(async (tx): Promise<ConvertResult> => {
        // Codes are made by the app (OPS-101); the triggers fill them only when empty.
        const tripCode = await nextCode(tx, "trip");
        const [tripRow] = await tx
          .insert(trips)
          .values({ ...plan.trip, tripCode })
          .returning({ id: trips.id, tripCode: trips.tripCode });

        await tx.insert(tripLegs).values(plan.legs.map((l) => ({ ...l, tripId: tripRow.id })));
        // Keep the aircraft calendar in step (OPS-102); the trips_sync_schedule_block
        // trigger does the same on Postgres and arrives at the same row.
        await syncTripScheduleBlock(tx, tripRow.id);

        // 'due' lets the drawdown helper short-circuit to 'paid' atomically. If the draw fails
        // (no card or insufficient balance), the invoice goes back to 'draft' below so the existing
        // review-then-finalize workflow holds.
        const invoiceCode = await nextCode(tx, "invoice");
        const [invRow] = await tx
          .insert(invoices)
          .values({
            ...plan.invoice,
            invoiceCode,
            tripId: tripRow.id,
            status: plan.tryDraw ? "due" : "draft",
          })
          .returning({ id: invoices.id });

        let drawdown: DrawdownOutcome | null = null;
        if (plan.tryDraw) {
          drawdown = await attemptInvoiceDrawdown(tx, {
            invoiceId: invRow.id,
            memberId,
            tripId: tripRow.id,
            totalUsd: plan.totalUsd,
          });
          // Drawdown didn't fire: revert the optimistic 'due' status to 'draft'.
          if (!drawdown.drew) {
            await tx.update(invoices).set({ status: "draft", updatedAt: new Date() }).where(eq(invoices.id, invRow.id));
          }
        }

        // Release any soft holds this quote had on aircraft, so /admin/ops shows no phantom blocks.
        await tx
          .delete(aircraftScheduleBlocks)
          .where(and(eq(aircraftScheduleBlocks.relatedQuoteId, quoteId), eq(aircraftScheduleBlocks.kind, "hold")));

        await tx
          .update(quotes)
          .set({ status: "converted", acceptedAt: new Date(), convertedTripId: tripRow.id })
          .where(eq(quotes.id, quoteId));

        return { trip: tripRow, invoice: invRow, drawdown };
      });
    },
  };
}
