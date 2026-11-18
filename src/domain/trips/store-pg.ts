import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { invoices } from "@/db/schema/invoices";
import { memberPreferences } from "@/db/schema/member-prefs";
import { members } from "@/db/schema/members";
import { operators } from "@/db/schema/operators";
import { quotes } from "@/db/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { staff } from "@/db/schema/staff";
import { tripLegs, trips } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import { syncTripScheduleBlock } from "./schedule-block";
import type { TripStore } from "./store";

// The Postgres side of the trip store (OPS-156): the queries of listTrips, getTrip, the trip
// lookups and the status write of the trip commands, the manual schedule blocks, the client's
// two trip pages and the aircraft page's block, trip and total reads, moved here as they were.
// Nothing about them changes on Postgres.

export function pgTripStore(): TripStore {
  return {
    async listRows({ pattern, limit }) {
      const where = pattern
        ? or(
            ilike(users.firstName, pattern),
            ilike(users.lastName, pattern),
            ilike(users.email, pattern),
            ilike(members.preferredName, pattern),
            ilike(members.legalName, pattern),
            sql`exists (select 1 from ${tripLegs} tl where tl.trip_id = ${trips.id} and (tl.from_city ilike ${pattern} or tl.to_city ilike ${pattern}))`,
          )
        : undefined;

      return db
        .select({
          id: trips.id,
          tripCode: trips.tripCode,
          status: trips.status,
          paxCount: trips.paxCount,
          missionType: trips.missionType,
          wheelsUpAt: trips.wheelsUpAt,
          createdAt: trips.createdAt,
          memberId: trips.memberId,
          quoteId: trips.quoteId,
          memberCode: members.memberCode,
          preferredName: members.preferredName,
          legalName: members.legalName,
          memberEmail: users.email,
          memberPhone: users.phoneE164,
          memberFirstName: users.firstName,
          memberLastName: users.lastName,
          makeModel: aircraft.makeModel,
          tailNumber: aircraft.tailNumber,
          operatorName: operators.name,
          groundOption: quotes.groundOption,
        })
        .from(trips)
        .innerJoin(members, eq(members.id, trips.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
        .leftJoin(operators, eq(operators.id, trips.operatorId))
        .leftJoin(quotes, eq(quotes.id, trips.quoteId))
        .where(where)
        .orderBy(desc(trips.createdAt))
        .limit(limit);
    },

    async legsForTrips(tripIds) {
      if (tripIds.length === 0) return [];
      return db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromIata: tripLegs.fromIata,
          fromCity: tripLegs.fromCity,
          fromName: tripLegs.fromName,
          toIata: tripLegs.toIata,
          toCity: tripLegs.toCity,
          toName: tripLegs.toName,
          departDate: tripLegs.departDate,
          departTime: tripLegs.departTime,
          departTz: tripLegs.departTz,
          scheduledDepAt: tripLegs.scheduledDepAt,
          scheduledArrAt: tripLegs.scheduledArrAt,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, tripIds))
        .orderBy(asc(tripLegs.legNumber));
    },

    async invoicesForTrips(tripIds) {
      if (tripIds.length === 0) return [];
      return db
        .select({
          tripId: invoices.tripId,
          status: invoices.status,
          issuedOn: invoices.issuedOn,
          dueOn: invoices.dueOn,
          paidOn: invoices.paidOn,
          totalUsd: invoices.totalUsd,
          kind: invoices.kind,
        })
        .from(invoices)
        .where(inArray(invoices.tripId, tripIds))
        .orderBy(asc(invoices.createdAt));
    },

    async optionsForQuotes(quoteIds) {
      if (quoteIds.length === 0) return [];
      return db
        .select({
          quoteId: sourcedOptions.quoteId,
          aircraftType: sourcedOptions.aircraftType,
          tailNumber: sourcedOptions.tailNumber,
          operatorNameRaw: sourcedOptions.operatorNameRaw,
        })
        .from(sourcedOptions)
        .where(inArray(sourcedOptions.quoteId, quoteIds))
        .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber));
    },

    async tripParts(id) {
      const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
      if (!trip) return null;

      const [legs, memberRows, invoiceRows, quoteRows, acRows, opRows] = await Promise.all([
        db.select().from(tripLegs).where(eq(tripLegs.tripId, id)).orderBy(asc(tripLegs.legNumber)),
        db
          .select({
            id: members.id,
            memberCode: members.memberCode,
            tier: members.tier,
            preferredName: members.preferredName,
            legalName: members.legalName,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phoneE164: users.phoneE164,
          })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(eq(members.id, trip.memberId))
          .limit(1),
        db.select().from(invoices).where(eq(invoices.tripId, id)).limit(1),
        trip.quoteId
          ? db
              .select({
                id: quotes.id,
                quoteCode: quotes.quoteCode,
                status: quotes.status,
                groundOption: quotes.groundOption,
              })
              .from(quotes)
              .where(eq(quotes.id, trip.quoteId))
              .limit(1)
          : Promise.resolve([]),
        trip.aircraftId
          ? db
              .select({
                tailNumber: aircraft.tailNumber,
                makeModel: aircraft.makeModel,
                yearManufactured: aircraft.yearManufactured,
                operatorId: aircraft.operatorId,
              })
              .from(aircraft)
              .where(eq(aircraft.id, trip.aircraftId))
              .limit(1)
          : Promise.resolve([]),
        trip.operatorId
          ? db
              .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
              .from(operators)
              .where(eq(operators.id, trip.operatorId))
              .limit(1)
          : Promise.resolve([]),
      ]);

      const acRow = acRows[0] ?? null;
      const [chosenOption] =
        trip.quoteId && !acRow
          ? await db
              .select({
                aircraftType: sourcedOptions.aircraftType,
                tailNumber: sourcedOptions.tailNumber,
                operatorNameRaw: sourcedOptions.operatorNameRaw,
                totalFlightTimeMin: sourcedOptions.totalFlightTimeMin,
              })
              .from(sourcedOptions)
              .where(eq(sourcedOptions.quoteId, trip.quoteId))
              .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber))
              .limit(1)
          : [];

      return {
        trip,
        legs,
        member: memberRows[0] ?? null,
        invoice: invoiceRows[0] ?? null,
        quote: quoteRows[0] ?? null,
        aircraft: acRow,
        operator: opRows[0] ?? null,
        chosenOption: chosenOption ?? null,
      };
    },

    async tripForMessage(id) {
      // A trip always has a client; the joins also give the default address.
      const [t] = await db
        .select({
          id: trips.id,
          code: trips.tripCode,
          memberId: trips.memberId,
          memberUserId: members.userId,
          memberEmail: users.email,
          memberPhone: users.phoneE164,
        })
        .from(trips)
        .innerJoin(members, eq(members.id, trips.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(trips.id, id))
        .limit(1);
      return t;
    },

    async tripForStatus(id) {
      const [t] = await db
        .select({ id: trips.id, code: trips.tripCode, status: trips.status })
        .from(trips)
        .where(eq(trips.id, id))
        .limit(1);
      return t;
    },

    async noticeTarget(id) {
      const [t] = await db
        .select({
          memberUserId: members.userId,
          memberEmail: users.email,
          memberPhone: users.phoneE164,
          memberFirstName: users.firstName,
          paxCount: trips.paxCount,
          smsOptIn: memberPreferences.commsSmsUpdates,
          quietStart: memberPreferences.quietHoursStart,
          quietEnd: memberPreferences.quietHoursEnd,
          quietTz: memberPreferences.quietHoursTz,
        })
        .from(trips)
        .innerJoin(members, eq(members.id, trips.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .leftJoin(memberPreferences, eq(memberPreferences.memberId, trips.memberId))
        .where(eq(trips.id, id));
      return t;
    },

    async noticeLegs(id) {
      return db
        .select({ fromIcao: tripLegs.fromIcao, toIcao: tripLegs.toIcao, departDate: tripLegs.departDate })
        .from(tripLegs)
        .where(eq(tripLegs.tripId, id))
        .orderBy(asc(tripLegs.legNumber));
    },

    async setStatus(id, patch) {
      await db.update(trips).set(patch).where(eq(trips.id, id));
      // Keep the aircraft calendar in step (OPS-102); the trigger does the same on Postgres.
      await syncTripScheduleBlock(db, id);
    },

    async aircraftForBlock(id) {
      const [ac] = await db
        .select({ id: aircraft.id, tailNumber: aircraft.tailNumber })
        .from(aircraft)
        .where(eq(aircraft.id, id));
      return ac;
    },

    async insertBlock(values) {
      const [row] = await db.insert(aircraftScheduleBlocks).values(values).returning({ id: aircraftScheduleBlocks.id });
      return row;
    },

    async blockById(id) {
      const [target] = await db
        .select({
          id: aircraftScheduleBlocks.id,
          aircraftId: aircraftScheduleBlocks.aircraftId,
          kind: aircraftScheduleBlocks.kind,
          relatedTripId: aircraftScheduleBlocks.relatedTripId,
          relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
        })
        .from(aircraftScheduleBlocks)
        .where(eq(aircraftScheduleBlocks.id, id));
      return target;
    },

    async deleteBlock(id) {
      await db.delete(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.id, id));
    },

    async memberTrips(memberId, limit) {
      return db
        .select({
          id: trips.id,
          tripCode: trips.tripCode,
          status: trips.status,
          paxCount: trips.paxCount,
          missionType: trips.missionType,
          revenueUsd: trips.revenueUsd,
          createdAt: trips.createdAt,
          aircraft: aircraft.makeModel,
        })
        .from(trips)
        .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
        .where(eq(trips.memberId, memberId))
        .orderBy(desc(trips.createdAt))
        .limit(limit);
    },

    async accountLegs(tripIds) {
      if (tripIds.length === 0) return [];
      return db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromIata: tripLegs.fromIata,
          toIata: tripLegs.toIata,
          fromCity: tripLegs.fromCity,
          toCity: tripLegs.toCity,
          departDate: tripLegs.departDate,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, tripIds))
        .orderBy(asc(tripLegs.legNumber));
    },

    async memberTripParts(id, memberId) {
      // Owner-only: explicit eq on member_id so members can't peek at other
      // trips even by guessing UUIDs.
      const [trip] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, id), eq(trips.memberId, memberId)));
      if (!trip) return null;

      const legs = await db.select().from(tripLegs).where(eq(tripLegs.tripId, id)).orderBy(asc(tripLegs.legNumber));
      const [invoice] = await db.select().from(invoices).where(eq(invoices.tripId, id));
      const [acRow] = trip.aircraftId
        ? await db
            .select({
              makeModel: aircraft.makeModel,
              category: aircraft.category,
              seats: aircraft.seats,
              yearManufactured: aircraft.yearManufactured,
            })
            .from(aircraft)
            .where(eq(aircraft.id, trip.aircraftId))
        : [];
      const [opRow] = trip.operatorId
        ? await db.select({ name: operators.name }).from(operators).where(eq(operators.id, trip.operatorId))
        : [];
      return { trip, legs, invoice: invoice ?? null, aircraft: acRow ?? null, operator: opRow ?? null };
    },

    async staffContact(id) {
      const [row] = await db
        .select({ displayName: staff.displayName, directLineE164: staff.directLineE164 })
        .from(staff)
        .where(eq(staff.id, id))
        .limit(1);
      return row;
    },

    async tailBlocks(aircraftId, from, to) {
      return db
        .select({
          id: aircraftScheduleBlocks.id,
          kind: aircraftScheduleBlocks.kind,
          startAt: aircraftScheduleBlocks.startAt,
          endAt: aircraftScheduleBlocks.endAt,
          relatedTripId: aircraftScheduleBlocks.relatedTripId,
          notes: aircraftScheduleBlocks.notes,
          tripCode: trips.tripCode,
        })
        .from(aircraftScheduleBlocks)
        .leftJoin(trips, eq(trips.id, aircraftScheduleBlocks.relatedTripId))
        .where(
          and(
            eq(aircraftScheduleBlocks.aircraftId, aircraftId),
            lt(aircraftScheduleBlocks.startAt, to),
            gt(aircraftScheduleBlocks.endAt, from),
          ),
        )
        .orderBy(asc(aircraftScheduleBlocks.startAt));
    },

    async tailRecentTrips(aircraftId, limit) {
      return db
        .select({
          id: trips.id,
          tripCode: trips.tripCode,
          status: trips.status,
          paxCount: trips.paxCount,
          revenueUsd: trips.revenueUsd,
          wheelsUpAt: trips.wheelsUpAt,
          createdAt: trips.createdAt,
        })
        .from(trips)
        .where(eq(trips.aircraftId, aircraftId))
        .orderBy(desc(trips.createdAt))
        .limit(limit);
    },

    async tailTotals(aircraftId) {
      const [aggregate] = await db
        .select({
          lifetimeTrips: sql<number>`coalesce(count(*)::int, 0)`,
          lifetimeRevenue: sql<number>`coalesce(sum(${trips.revenueUsd}), 0)::int`,
          totalPax: sql<number>`coalesce(sum(${trips.paxCount}), 0)::int`,
        })
        .from(trips)
        .where(eq(trips.aircraftId, aircraftId));
      return aggregate ?? { lifetimeTrips: 0, lifetimeRevenue: 0, totalPax: 0 };
    },
  };
}
