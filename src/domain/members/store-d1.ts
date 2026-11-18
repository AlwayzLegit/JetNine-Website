import { and, asc, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { codeSql, codeYear } from "@/db/codes";
import { chunks } from "@/db/d1/helpers";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { invoices } from "@/db/d1/schema/invoices";
import { companions, memberDocuments, memberLanes, memberPreferences } from "@/db/d1/schema/member-prefs";
import { memberCodeSequence, members } from "@/db/d1/schema/members";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { tierPatch } from "@/domain/memberships/tier";
import type { MemberStore, TripLegFacts } from "./store";

// The D1 (SQLite) side of the member store (OPS-149). Same methods and the same
// results as store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// Differences from Postgres:
// - ilike becomes lower(x) like lower(y) escape '\' (the pattern comes from likePattern).
// - No ::int or ::date casts: integer sums are integers, dates are text and are
//   compared as text (`today` arrives as YYYY-MM-DD).
// - SQLite sorts NULL first on asc and last on desc, Postgres the other way round;
//   the orderings that can meet a NULL add an `is null` key to give Postgres's order.
// - D1 allows 100 bound values per statement: every id list is read in chunks of 50.
// - The member code is made inside one batch with the insert (counter first, then
//   the insert reading the counter in SQL, OPS-113), so a failed insert gives the
//   number back. No interactive transaction exists on D1 from a Worker.

type D1Client = DrizzleD1Database;

const LEG_COLUMNS = {
  tripId: tripLegs.tripId,
  fromIata: tripLegs.fromIata,
  fromCity: tripLegs.fromCity,
  fromName: tripLegs.fromName,
  toIata: tripLegs.toIata,
  toCity: tripLegs.toCity,
  toName: tripLegs.toName,
  departDate: tripLegs.departDate,
  departTime: tripLegs.departTime,
};

const PAST_TRIP_STATUSES = ["wheels_down", "completed", "cancelled_wx", "cancelled_other"] as const;

export function d1MemberStore(db: D1Client): MemberStore {
  const sumBalance = (memberId: string) =>
    db
      .select({ total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)` })
      .from(reserveTransactions)
      .where(eq(reserveTransactions.memberId, memberId));

  return {
    // ── Identity ──
    async memberByUserId(userId) {
      const [row] = await db.select().from(members).where(eq(members.userId, userId));
      return row ?? null;
    },

    async memberRefByUserId(userId) {
      const [row] = await db
        .select({ id: members.id, memberCode: members.memberCode })
        .from(members)
        .where(eq(members.userId, userId));
      return row ?? null;
    },

    // ── The desk's client list and detail ──
    async listClientRows(like, today) {
      const rows = await db
        .select({
          id: members.id,
          tier: members.tier,
          status: members.status,
          memberSince: members.memberSince,
          tierSince: members.tierSince,
          mobileE164: members.mobileE164,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneE164: users.phoneE164,
          tripCount: sql<number>`(
            select count(*) from trips t where t.member_id = ${members.id}
          )`,
          lifetimeUsd: sql<number>`(
            select coalesce(sum(i.total_usd), 0) from invoices i
            where i.member_id = ${members.id} and i.status in ('paid','due','overdue')
          )`,
          lastFlownOn: sql<string | null>`(
            select max(l.depart_date) from trip_legs l
            join trips t on t.id = l.trip_id
            where t.member_id = ${members.id}
              and l.depart_date < ${today}
              and t.status not in ('draft','cancelled_wx','cancelled_other')
          )`,
          nextTripId: sql<string | null>`(
            select t.id from trips t
            join trip_legs l on l.trip_id = t.id
            where t.member_id = ${members.id}
              and l.depart_date >= ${today}
              and t.status not in ('wheels_down','completed','cancelled_wx','cancelled_other')
            order by l.depart_date asc limit 1
          )`,
          openRequests: sql<number>`(
            select count(*) from quotes q
            where q.member_id = ${members.id}
              and q.status in ('submitted','triaged','sourcing','options_sent','held')
          )`,
          reserveUsd: sql<number>`(
            select coalesce(sum(r.amount_usd), 0) from reserve_transactions r
            where r.member_id = ${members.id}
          )`,
          program: memberships.program,
          programSince: memberships.activatedOn,
          programRenews: memberships.nextRenewalDate,
          programEnds: memberships.expiresOn,
          prefs: memberPreferences,
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .leftJoin(memberships, and(eq(memberships.memberId, members.id), eq(memberships.status, "active")))
        .leftJoin(memberPreferences, eq(memberPreferences.memberId, members.id))
        .where(
          like
            ? or(
                sql`lower(${users.firstName}) like lower(${like}) escape '\\'`,
                sql`lower(${users.lastName}) like lower(${like}) escape '\\'`,
                sql`lower(${users.email}) like lower(${like}) escape '\\'`,
                sql`lower(${members.legalName}) like lower(${like}) escape '\\'`,
                sql`lower(${members.preferredName}) like lower(${like}) escape '\\'`,
                sql`lower(${members.companyName}) like lower(${like}) escape '\\'`,
              )
            : undefined,
        )
        // Postgres puts NULL last on asc; SQLite puts it first.
        .orderBy(sql`${users.lastName} is null`, asc(users.lastName), sql`${users.firstName} is null`, asc(users.firstName))
        .limit(200);
      return rows;
    },

    async nextTripFacts(tripIds) {
      const tripRows: { id: string; paxCount: number | null; status: string }[] = [];
      const legRows: TripLegFacts[] = [];
      for (const ids of chunks(tripIds)) {
        const [t, l] = await Promise.all([
          db
            .select({ id: trips.id, paxCount: trips.paxCount, status: trips.status })
            .from(trips)
            .where(inArray(trips.id, ids)),
          db.select(LEG_COLUMNS).from(tripLegs).where(inArray(tripLegs.tripId, ids)).orderBy(asc(tripLegs.legNumber)),
        ]);
        tripRows.push(...t);
        legRows.push(...l);
      }
      return { trips: tripRows, legs: legRows };
    },

    async clientHead(id) {
      const [row] = await db
        .select({
          id: members.id,
          memberCode: members.memberCode,
          legalName: members.legalName,
          preferredName: members.preferredName,
          tier: members.tier,
          tierSince: members.tierSince,
          memberSince: members.memberSince,
          status: members.status,
          mobileE164: members.mobileE164,
          companyName: members.companyName,
          roleTitle: members.roleTitle,
          twoFactorEnabled: members.twoFactorEnabled,
          marketingOptIn: members.marketingOptIn,
          lifetimeTripsCache: members.lifetimeTripsCache,
          lifetimeHoursCache: members.lifetimeHoursCache,
          primaryDispatcherId: members.primaryDispatcherId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneE164: users.phoneE164,
          role: users.role,
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, id));
      return row;
    },

    async clientBody(id, primaryDispatcherId) {
      const [
        dispatcherRows,
        prefRows,
        lanes,
        companionsList,
        documents,
        programs,
        balanceRows,
        tripsList,
        openTrips,
        invoicesList,
        quotesList,
        lifetimeRows,
        ledger,
      ] = await Promise.all([
        primaryDispatcherId
          ? db
              .select({ displayName: staff.displayName, status: staff.status })
              .from(staff)
              .where(eq(staff.id, primaryDispatcherId))
          : Promise.resolve([]),
        db.select().from(memberPreferences).where(eq(memberPreferences.memberId, id)),
        // Postgres puts NULL first on desc; SQLite puts it last.
        db
          .select()
          .from(memberLanes)
          .where(eq(memberLanes.memberId, id))
          .orderBy(sql`${memberLanes.frequencyPerYear} is not null`, desc(memberLanes.frequencyPerYear)),
        // Explicit columns: birth dates and encrypted KTNs never leave the database here.
        db
          .select({
            id: companions.id,
            relation: companions.relation,
            legalName: companions.legalName,
            apisComplete: companions.apisComplete,
            ccOnItinerary: companions.ccOnItinerary,
            speciesBreed: companions.speciesBreed,
            weightLb: companions.weightLb,
            notes: companions.notes,
            createdAt: companions.createdAt,
          })
          .from(companions)
          .where(eq(companions.memberId, id))
          .orderBy(asc(companions.legalName)),
        db
          .select({
            id: memberDocuments.id,
            docType: memberDocuments.docType,
            countryIso2: memberDocuments.countryIso2,
            expiresOn: memberDocuments.expiresOn,
            isPrimary: memberDocuments.isPrimary,
          })
          .from(memberDocuments)
          .where(eq(memberDocuments.memberId, id))
          .orderBy(desc(memberDocuments.isPrimary), asc(memberDocuments.docType)),
        db.select().from(memberships).where(eq(memberships.memberId, id)).orderBy(desc(memberships.activatedOn)),
        sumBalance(id),
        db
          .select({
            id: trips.id,
            tripCode: trips.tripCode,
            status: trips.status,
            missionType: trips.missionType,
            paxCount: trips.paxCount,
            revenueUsd: trips.revenueUsd,
            aircraftId: trips.aircraftId,
            createdAt: trips.createdAt,
          })
          .from(trips)
          .where(eq(trips.memberId, id))
          .orderBy(desc(trips.createdAt))
          .limit(10),
        // Everything still to fly, to pick the next trip for "Upcoming".
        db
          .select({
            id: trips.id,
            tripCode: trips.tripCode,
            status: trips.status,
            paxCount: trips.paxCount,
            revenueUsd: trips.revenueUsd,
            aircraftId: trips.aircraftId,
          })
          .from(trips)
          .where(and(eq(trips.memberId, id), notInArray(trips.status, [...PAST_TRIP_STATUSES]))),
        db
          .select({
            id: invoices.id,
            invoiceCode: invoices.invoiceCode,
            status: invoices.status,
            kind: invoices.kind,
            issuedOn: invoices.issuedOn,
            dueOn: invoices.dueOn,
            totalUsd: invoices.totalUsd,
            tripId: invoices.tripId,
            tripCode: trips.tripCode,
          })
          .from(invoices)
          .leftJoin(trips, eq(trips.id, invoices.tripId))
          .where(eq(invoices.memberId, id))
          .orderBy(desc(invoices.issuedOn))
          .limit(10),
        db
          .select({
            id: quotes.id,
            quoteCode: quotes.quoteCode,
            status: quotes.status,
            paxCount: quotes.paxCount,
            receivedAt: quotes.receivedAt,
            convertedTripId: quotes.convertedTripId,
          })
          .from(quotes)
          .where(eq(quotes.memberId, id))
          .orderBy(desc(quotes.receivedAt))
          .limit(10),
        db
          .select({ total: sql<number>`coalesce(sum(${invoices.totalUsd}), 0)` })
          .from(invoices)
          .where(and(eq(invoices.memberId, id), inArray(invoices.status, ["paid", "due", "overdue"]))),
        db
          .select({
            id: reserveTransactions.id,
            kind: reserveTransactions.kind,
            amountUsd: reserveTransactions.amountUsd,
            description: reserveTransactions.description,
            occurredAt: reserveTransactions.occurredAt,
          })
          .from(reserveTransactions)
          .where(eq(reserveTransactions.memberId, id))
          .orderBy(desc(reserveTransactions.occurredAt))
          .limit(8),
      ]);

      return {
        dispatcher: dispatcherRows[0] ?? null,
        prefs: prefRows[0] ?? null,
        lanes,
        companions: companionsList,
        documents,
        programs,
        balance: balanceRows[0]?.total ?? 0,
        trips: tripsList,
        openTrips,
        invoices: invoicesList,
        quotes: quotesList,
        lifetimeInvoiced: lifetimeRows[0]?.total ?? 0,
        ledger,
      };
    },

    async clientLegFacts(tripIds, quoteIds, laneIcaos) {
      const legs: TripLegFacts[] = [];
      for (const ids of chunks(tripIds)) {
        legs.push(...(await db.select(LEG_COLUMNS).from(tripLegs).where(inArray(tripLegs.tripId, ids)).orderBy(asc(tripLegs.legNumber))));
      }
      const quoteLegRows: Awaited<ReturnType<MemberStore["clientLegFacts"]>>["quoteLegs"] = [];
      for (const ids of chunks(quoteIds)) {
        quoteLegRows.push(
          ...(await db
            .select({
              quoteId: quoteLegs.quoteId,
              fromIata: quoteLegs.fromIata,
              fromCity: quoteLegs.fromCity,
              fromName: quoteLegs.fromName,
              toIata: quoteLegs.toIata,
              toCity: quoteLegs.toCity,
              toName: quoteLegs.toName,
              departDate: quoteLegs.departDate,
            })
            .from(quoteLegs)
            .where(inArray(quoteLegs.quoteId, ids))
            .orderBy(asc(quoteLegs.legNumber))),
        );
      }
      const laneAirports: { icao: string; city: string | null; name: string }[] = [];
      for (const icaos of chunks(laneIcaos)) {
        laneAirports.push(
          ...(await db
            .select({ icao: airports.icao, city: airports.city, name: airports.name })
            .from(airports)
            .where(inArray(airports.icao, icaos))),
        );
      }
      return { legs, quoteLegs: quoteLegRows, laneAirports };
    },

    async aircraftModel(aircraftId) {
      const [row] = await db
        .select({ makeModel: aircraft.makeModel })
        .from(aircraft)
        .where(eq(aircraft.id, aircraftId))
        .limit(1);
      return row?.makeModel ?? null;
    },

    // ── The reserve ledger ──
    async ledgerTarget(memberId) {
      const [[active], [member]] = await Promise.all([
        db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.memberId, memberId), eq(memberships.status, "active")))
          .orderBy(desc(memberships.activatedOn))
          .limit(1),
        db
          .select({
            id: members.id,
            memberCode: members.memberCode,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(eq(members.id, memberId)),
      ]);
      if (!member) return undefined;
      return { member, activeMembershipId: active?.id ?? null };
    },

    async appendLedger(values) {
      const [row] = await db.insert(reserveTransactions).values(values).returning({ id: reserveTransactions.id });
      return row;
    },

    async balance(memberId) {
      const [row] = await sumBalance(memberId);
      return row?.total ?? 0;
    },

    async creditAccrualTotal(memberId) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)` })
        .from(reserveTransactions)
        .where(and(eq(reserveTransactions.memberId, memberId), eq(reserveTransactions.kind, "credit_accrual")));
      return row?.total ?? 0;
    },

    async recentLedger(memberId, limit) {
      return db
        .select({
          id: reserveTransactions.id,
          kind: reserveTransactions.kind,
          amountUsd: reserveTransactions.amountUsd,
          description: reserveTransactions.description,
          occurredAt: reserveTransactions.occurredAt,
        })
        .from(reserveTransactions)
        .where(eq(reserveTransactions.memberId, memberId))
        .orderBy(desc(reserveTransactions.occurredAt))
        .limit(limit);
    },

    async recentLedgerWithRefs(memberId, limit) {
      return db
        .select({
          id: reserveTransactions.id,
          kind: reserveTransactions.kind,
          amountUsd: reserveTransactions.amountUsd,
          description: reserveTransactions.description,
          occurredAt: reserveTransactions.occurredAt,
          tripId: reserveTransactions.tripId,
          tripCode: trips.tripCode,
          invoiceId: reserveTransactions.invoiceId,
          invoiceCode: invoices.invoiceCode,
        })
        .from(reserveTransactions)
        .leftJoin(trips, eq(trips.id, reserveTransactions.tripId))
        .leftJoin(invoices, eq(invoices.id, reserveTransactions.invoiceId))
        .where(eq(reserveTransactions.memberId, memberId))
        .orderBy(desc(reserveTransactions.occurredAt))
        .limit(limit);
    },

    // ── Members: invite ──
    async insertMember(values) {
      const year = codeYear();
      const [, rows] = await db.batch([
        // The counter moves first: the insert's code reads the value this leaves.
        db
          .insert(memberCodeSequence)
          .values({ year, lastValue: 1 })
          .onConflictDoUpdate({
            target: memberCodeSequence.year,
            set: { lastValue: sql`${memberCodeSequence.lastValue} + 1` },
          }),
        db
          .insert(members)
          .values({ ...values, memberCode: codeSql("member", year) })
          .returning({ id: members.id, memberCode: members.memberCode }),
      ]);
      const row = rows[0];
      if (!row) throw new Error("member insert returned no row");
      return row;
    },

    // ── Memberships ──
    async membershipsOf(memberId) {
      return db.select().from(memberships).where(eq(memberships.memberId, memberId)).orderBy(desc(memberships.activatedOn));
    },

    async activeMembership(memberId) {
      const [row] = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.memberId, memberId), eq(memberships.status, "active")))
        .orderBy(desc(memberships.activatedOn))
        .limit(1);
      return row;
    },

    async insertMembership(values) {
      const [row] = await db.insert(memberships).values(values).returning({ id: memberships.id });
      return row;
    },

    async patchMembership(id, patch) {
      await db
        .update(memberships)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(memberships.id, id));
    },

    async syncTier(membershipId, previousStatus) {
      const [m] = await db
        .select({
          id: memberships.id,
          memberId: memberships.memberId,
          program: memberships.program,
          status: memberships.status,
          activatedOn: memberships.activatedOn,
        })
        .from(memberships)
        .where(eq(memberships.id, membershipId))
        .limit(1);
      if (!m) return;

      let hasOtherActive = false;
      if (m.status !== "active" && previousStatus === "active") {
        const others = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.memberId, m.memberId), eq(memberships.status, "active"), ne(memberships.id, m.id)))
          .limit(1);
        hasOtherActive = others.length > 0;
      }

      const patch = tierPatch({
        status: m.status,
        previousStatus,
        program: m.program,
        activatedOn: m.activatedOn,
        hasOtherActive,
      });
      if (!patch) return;
      await db.update(members).set(patch).where(eq(members.id, m.memberId));
    },

    // ── Preferences, companions, lanes ──
    async preferencesOf(memberId) {
      const [row] = await db.select().from(memberPreferences).where(eq(memberPreferences.memberId, memberId));
      return row;
    },

    async upsertPreferences(values) {
      const [existing] = await db
        .select({ memberId: memberPreferences.memberId })
        .from(memberPreferences)
        .where(eq(memberPreferences.memberId, values.memberId));
      if (existing) {
        await db.update(memberPreferences).set(values).where(eq(memberPreferences.memberId, values.memberId));
      } else {
        await db.insert(memberPreferences).values(values);
      }
      return { created: !existing };
    },

    async companionsOf(memberId) {
      return db.select().from(companions).where(eq(companions.memberId, memberId)).orderBy(asc(companions.createdAt));
    },

    async addCompanion(values) {
      const [row] = await db.insert(companions).values(values).returning({ id: companions.id });
      return row;
    },

    async companionOf(id, memberId) {
      const [row] = await db
        .select({ id: companions.id, legalName: companions.legalName, relation: companions.relation })
        .from(companions)
        .where(and(eq(companions.id, id), eq(companions.memberId, memberId)));
      return row;
    },

    async deleteCompanion(id) {
      await db.delete(companions).where(eq(companions.id, id));
    },

    async lanesOf(memberId) {
      return db.select().from(memberLanes).where(eq(memberLanes.memberId, memberId)).orderBy(asc(memberLanes.createdAt));
    },

    async laneExists(memberId, fromIcao, toIcao) {
      const [row] = await db
        .select({ id: memberLanes.id })
        .from(memberLanes)
        .where(and(eq(memberLanes.memberId, memberId), eq(memberLanes.fromIcao, fromIcao), eq(memberLanes.toIcao, toIcao)));
      return Boolean(row);
    },

    async addLane(values) {
      const [row] = await db.insert(memberLanes).values(values).returning({ id: memberLanes.id });
      return row;
    },

    async laneOf(id, memberId) {
      const [row] = await db
        .select({ id: memberLanes.id, fromIcao: memberLanes.fromIcao, toIcao: memberLanes.toIcao })
        .from(memberLanes)
        .where(and(eq(memberLanes.id, id), eq(memberLanes.memberId, memberId)));
      return row;
    },

    async deleteLane(id) {
      await db.delete(memberLanes).where(eq(memberLanes.id, id));
    },
  };
}
