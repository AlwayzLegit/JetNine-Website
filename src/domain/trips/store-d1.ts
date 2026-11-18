import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { chunks } from "@/db/d1/helpers";
import { aircraft } from "@/db/d1/schema/aircraft";
import { invoices } from "@/db/d1/schema/invoices";
import { memberPreferences } from "@/db/d1/schema/member-prefs";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quotes } from "@/db/d1/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/d1/schema/schedule-blocks";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { syncTripScheduleBlockD1 } from "./schedule-block";
import type { TripListInvoiceRow, TripListLegRow, TripOptionRow, TripStore, AccountLegRow } from "./store";

// The D1 (SQLite) side of the trip store (OPS-156). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so
// a test can hand it a real SQLite.
//
// Differences from Postgres:
// - ilike becomes lower(x) like lower(?) escape '\' (the pattern comes from likePattern).
// - Booleans are 0 and 1, so desc(is_chosen) sorts the same. Timestamps are integer
//   milliseconds; drizzle maps a Date for a column.
// - No ::int casts: count(*) and sum() of integers are integers already.
// - D1 allows 100 bound values per statement: the id lists are read in chunks of 50, and the
//   chunks are put back in the order the SQL sorts (leg number; creation time).
// - No trigger and no interactive transaction: setStatus writes the trip and then recomputes
//   the aircraft's calendar block (syncTripScheduleBlockD1), as the Postgres side does.

type D1Client = DrizzleD1Database;

const ESCAPE = sql.raw(`escape '\\'`);

/** lower(expr) like lower(pattern) escape '\' : the D1 spelling of `expr ilike pattern`. */
const ilike = (expr: ReturnType<typeof sql>, pattern: string) => sql`lower(${expr}) like lower(${pattern}) ${ESCAPE}`;

export function d1TripStore(db: D1Client): TripStore {
  return {
    async listRows({ pattern, limit }) {
      const where = pattern
        ? or(
            ilike(sql`${users.firstName}`, pattern),
            ilike(sql`${users.lastName}`, pattern),
            ilike(sql`${users.email}`, pattern),
            ilike(sql`${members.preferredName}`, pattern),
            ilike(sql`${members.legalName}`, pattern),
            sql`exists (select 1 from ${tripLegs} tl where tl.trip_id = ${trips.id} and (${ilike(sql`tl.from_city`, pattern)} or ${ilike(sql`tl.to_city`, pattern)}))`,
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
      const out: TripListLegRow[] = [];
      for (const part of chunks(tripIds)) {
        out.push(
          ...(await db
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
            .where(inArray(tripLegs.tripId, part))
            .orderBy(asc(tripLegs.legNumber))),
        );
      }
      // One list ordered by leg number, as one Postgres statement returns it.
      return out.sort((a, b) => a.legNumber - b.legNumber);
    },

    async invoicesForTrips(tripIds) {
      const out: (TripListInvoiceRow & { createdAt: Date })[] = [];
      for (const part of chunks(tripIds)) {
        out.push(
          ...(await db
            .select({
              tripId: invoices.tripId,
              status: invoices.status,
              issuedOn: invoices.issuedOn,
              dueOn: invoices.dueOn,
              paidOn: invoices.paidOn,
              totalUsd: invoices.totalUsd,
              kind: invoices.kind,
              createdAt: invoices.createdAt,
            })
            .from(invoices)
            .where(inArray(invoices.tripId, part))
            .orderBy(asc(invoices.createdAt))),
        );
      }
      out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return out.map((row) => ({
        tripId: row.tripId,
        status: row.status,
        issuedOn: row.issuedOn,
        dueOn: row.dueOn,
        paidOn: row.paidOn,
        totalUsd: row.totalUsd,
        kind: row.kind,
      }));
    },

    async optionsForQuotes(quoteIds) {
      // A quote's options all sit in one chunk, so each quote keeps the order the SQL gives:
      // the chosen option first, then by option number.
      const out: TripOptionRow[] = [];
      for (const part of chunks(quoteIds)) {
        out.push(
          ...(await db
            .select({
              quoteId: sourcedOptions.quoteId,
              aircraftType: sourcedOptions.aircraftType,
              tailNumber: sourcedOptions.tailNumber,
              operatorNameRaw: sourcedOptions.operatorNameRaw,
            })
            .from(sourcedOptions)
            .where(inArray(sourcedOptions.quoteId, part))
            .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber))),
        );
      }
      return out;
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
      // D1 has no trigger: bring the aircraft calendar in step here (OPS-102).
      await syncTripScheduleBlockD1(db, id);
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
      const out: AccountLegRow[] = [];
      for (const part of chunks(tripIds)) {
        out.push(
          ...(await db
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
            .where(inArray(tripLegs.tripId, part))
            .orderBy(asc(tripLegs.legNumber))),
        );
      }
      return out.sort((a, b) => a.legNumber - b.legNumber);
    },

    async memberTripParts(id, memberId) {
      // Owner-only: explicit eq on member_id so members can't peek at other
      // trips even by guessing ids.
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
          lifetimeTrips: sql<number>`coalesce(count(*), 0)`,
          lifetimeRevenue: sql<number>`coalesce(sum(${trips.revenueUsd}), 0)`,
          totalPax: sql<number>`coalesce(sum(${trips.paxCount}), 0)`,
        })
        .from(trips)
        .where(eq(trips.aircraftId, aircraftId));
      return aggregate ?? { lifetimeTrips: 0, lifetimeRevenue: 0, totalPax: 0 };
    },

    async operatorRecentTrips(operatorId, limit) {
      return db
        .select({
          id: trips.id,
          tripCode: trips.tripCode,
          status: trips.status,
          paxCount: trips.paxCount,
          revenueUsd: trips.revenueUsd,
          createdAt: trips.createdAt,
        })
        .from(trips)
        .where(eq(trips.operatorId, operatorId))
        .orderBy(desc(trips.createdAt))
        .limit(limit);
    },

    async operatorTotals(operatorId) {
      const [aggregate] = await db
        .select({
          lifetimeTrips: sql<number>`coalesce(count(*), 0)`,
          lifetimeRevenue: sql<number>`coalesce(sum(${trips.revenueUsd}), 0)`,
        })
        .from(trips)
        .where(eq(trips.operatorId, operatorId));
      return {
        lifetimeTrips: Number(aggregate?.lifetimeTrips ?? 0),
        lifetimeRevenue: Number(aggregate?.lifetimeRevenue ?? 0),
      };
    },
  };
}
