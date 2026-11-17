import { and, asc, count, desc, eq, ne, notInArray, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports, fbos } from "@/db/d1/schema/airports";
import { operatorContacts, operators } from "@/db/d1/schema/operators";
import { aircraftCategoryEnum } from "@/db/schema/enums";
import { SOURCING_INELIGIBLE_STATUSES } from "@/lib/operator-eligibility";
import type { ReferenceStore } from "./store";

// The D1 (SQLite) side of the reference store (OPS-112). Same methods and the
// same results as store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// Differences from Postgres that this file keeps the same:
// - Text sorts BINARY in SQLite ("Zulu" before "alpha"), the Postgres collation
//   does not split by case, so every sort by a name says `collate nocase`.
//   Codes (tail, ICAO, country, category) sort as they are on both.
// - A Postgres enum sorts in the order it was declared (turboprop, light,
//   midsize, supermid, heavy, ulr); SQLite sorts the text. The aircraft
//   category sort says the declared order with a CASE.
// - count(*) needs no ::int cast and the tables need no `public.` prefix.

type D1Client = DrizzleD1Database;

const ineligible = [...SOURCING_INELIGIBLE_STATUSES];

const nameNoCase = (col: unknown) => sql`${col} collate nocase`;

// The aircraft category in the order the Postgres enum declares it.
const categoryOrder = sql.raw(
  `case "aircraft"."category" ${aircraftCategoryEnum.enumValues.map((v, i) => `when '${v}' then ${i}`).join(" ")} else ${aircraftCategoryEnum.enumValues.length} end`,
);

export function d1ReferenceStore(db: D1Client): ReferenceStore {
  return {
    // ── operators ──
    async operatorRows() {
      return db
        .select({
          id: operators.id,
          name: operators.name,
          certNumber: operators.certNumber,
          homeAirportIcao: operators.homeAirportIcao,
          yearsPartner: operators.yearsPartner,
          isPreferred: operators.isPreferred,
          status: operators.status,
          argusRating: operators.argusRating,
          wyvernWingman: operators.wyvernWingman,
          isbaoStage: operators.isbaoStage,
          nextAuditOn: operators.nextAuditOn,
          insuranceRenewsOn: operators.insuranceRenewsOn,
          suspendedReason: operators.suspendedReason,
        })
        .from(operators)
        .orderBy(desc(operators.isPreferred), nameNoCase(operators.name));
    },

    async fleetCounts() {
      return db.select({ operatorId: aircraft.operatorId, n: count() }).from(aircraft).groupBy(aircraft.operatorId);
    },

    async sourcingOperators() {
      return db
        .select({ id: operators.id, name: operators.name })
        .from(operators)
        .where(notInArray(operators.status, ineligible))
        .orderBy(nameNoCase(operators.name));
    },

    async operatorOptions(currentId) {
      return db
        .select({ id: operators.id, name: operators.name })
        .from(operators)
        .where(or(notInArray(operators.status, ineligible), eq(operators.id, currentId)))
        .orderBy(nameNoCase(operators.name));
    },

    async operatorById(id) {
      const [row] = await db.select().from(operators).where(eq(operators.id, id));
      return row;
    },

    async operatorRef(id) {
      const [row] = await db
        .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
        .from(operators)
        .where(eq(operators.id, id));
      return row;
    },

    async operatorName(id) {
      const [row] = await db.select({ id: operators.id, name: operators.name }).from(operators).where(eq(operators.id, id));
      return row;
    },

    async operatorExists(id) {
      const [row] = await db.select({ id: operators.id }).from(operators).where(eq(operators.id, id));
      return Boolean(row);
    },

    async operatorIdByCert(certNumber) {
      const [row] = await db.select({ id: operators.id }).from(operators).where(eq(operators.certNumber, certNumber));
      return row;
    },

    async insertOperator(values) {
      const [row] = await db.insert(operators).values(values).returning({ id: operators.id, name: operators.name });
      return row;
    },

    async updateOperator(id, values) {
      await db.update(operators).set(values).where(eq(operators.id, id));
    },

    async contactsOf(operatorId) {
      return db
        .select()
        .from(operatorContacts)
        .where(eq(operatorContacts.operatorId, operatorId))
        .orderBy(desc(operatorContacts.isEscalation), nameNoCase(operatorContacts.name));
    },

    async contactOf(operatorId, contactId) {
      const [row] = await db
        .select({
          id: operatorContacts.id,
          name: operatorContacts.name,
          role: operatorContacts.role,
          isEscalation: operatorContacts.isEscalation,
        })
        .from(operatorContacts)
        .where(and(eq(operatorContacts.id, contactId), eq(operatorContacts.operatorId, operatorId)));
      return row;
    },

    async insertContact(values) {
      const [row] = await db.insert(operatorContacts).values(values).returning({ id: operatorContacts.id });
      return row;
    },

    async deleteContact(id) {
      await db.delete(operatorContacts).where(eq(operatorContacts.id, id));
    },

    async setContactEscalation(id, isEscalation) {
      await db.update(operatorContacts).set({ isEscalation }).where(eq(operatorContacts.id, id));
    },

    // ── aircraft ──
    async aircraftRows() {
      return db
        .select({
          id: aircraft.id,
          tailNumber: aircraft.tailNumber,
          operatorId: aircraft.operatorId,
          operatorName: operators.name,
          category: aircraft.category,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          seats: aircraft.seats,
          rangeNm: aircraft.rangeNm,
          speedKt: aircraft.speedKt,
          wifiType: aircraft.wifiType,
          standupCabin: aircraft.standupCabin,
          lieflatCapable: aircraft.lieflatCapable,
          petFriendly: aircraft.petFriendly,
          baseIcao: aircraft.baseIcao,
          totalHours: aircraft.totalHours,
          status: aircraft.status,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .orderBy(categoryOrder, asc(aircraft.tailNumber));
    },

    async aircraftById(id) {
      const [row] = await db.select().from(aircraft).where(eq(aircraft.id, id));
      return row;
    },

    async aircraftDetail(id) {
      const [row] = await db
        .select({
          id: aircraft.id,
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          category: aircraft.category,
          seats: aircraft.seats,
          rangeNm: aircraft.rangeNm,
          speedKt: aircraft.speedKt,
          wifiType: aircraft.wifiType,
          cabinHeightIn: aircraft.cabinHeightIn,
          standupCabin: aircraft.standupCabin,
          lavatoryEnclosed: aircraft.lavatoryEnclosed,
          lieflatCapable: aircraft.lieflatCapable,
          petFriendly: aircraft.petFriendly,
          flightAttendantStandard: aircraft.flightAttendantStandard,
          baseIcao: aircraft.baseIcao,
          totalHours: aircraft.totalHours,
          lastCCheckOn: aircraft.lastCCheckOn,
          status: aircraft.status,
          createdAt: aircraft.createdAt,
          operatorId: operators.id,
          operatorName: operators.name,
          operatorCertNumber: operators.certNumber,
          operatorStatus: operators.status,
          operatorArgus: operators.argusRating,
          operatorWyvern: operators.wyvernWingman,
          operatorIsPreferred: operators.isPreferred,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .where(eq(aircraft.id, id));
      return row;
    },

    async aircraftIdByTail(tailNumber, exceptId) {
      const [row] = await db
        .select({ id: aircraft.id })
        .from(aircraft)
        .where(exceptId ? and(eq(aircraft.tailNumber, tailNumber), ne(aircraft.id, exceptId)) : eq(aircraft.tailNumber, tailNumber));
      return row;
    },

    async insertAircraft(values) {
      const [row] = await db.insert(aircraft).values(values).returning({ id: aircraft.id, tailNumber: aircraft.tailNumber });
      return row;
    },

    async updateAircraft(id, values) {
      await db.update(aircraft).set(values).where(eq(aircraft.id, id));
    },

    async fleetOf(operatorId) {
      return db
        .select()
        .from(aircraft)
        .where(eq(aircraft.operatorId, operatorId))
        .orderBy(categoryOrder, asc(aircraft.tailNumber));
    },

    async fleetBoard() {
      return db
        .select({
          id: aircraft.id,
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          category: aircraft.category,
          seats: aircraft.seats,
          status: aircraft.status,
          operatorName: operators.name,
          isPreferred: operators.isPreferred,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .orderBy(categoryOrder, asc(aircraft.tailNumber));
    },

    // ── airports and FBOs ──
    async airportRows() {
      return db
        .select({
          id: airports.id,
          icao: airports.icao,
          iata: airports.iata,
          name: airports.name,
          city: airports.city,
          region: airports.region,
          countryIso2: airports.countryIso2,
          category: airports.category,
          customs: airports.customs,
          active: airports.active,
          // Written out in full: drizzle drops the table name from a column in a
          // one-table select, and a bare "id" would bind to the FBO's own id.
          fboCount: sql<number>`(select count(*) from fbos f where f.airport_id = "airports"."id")`,
        })
        .from(airports)
        .orderBy(asc(airports.countryIso2), asc(airports.icao));
    },

    async fboTotal() {
      const [row] = await db.select({ n: count() }).from(fbos);
      return row?.n ?? 0;
    },

    async airportById(id) {
      const [row] = await db.select().from(airports).where(eq(airports.id, id));
      return row;
    },

    async airportRef(id) {
      const [row] = await db
        .select({ id: airports.id, icao: airports.icao, name: airports.name })
        .from(airports)
        .where(eq(airports.id, id));
      return row;
    },

    async airportIdByIcao(icao, exceptId) {
      const [row] = await db
        .select({ id: airports.id })
        .from(airports)
        .where(exceptId ? and(eq(airports.icao, icao), ne(airports.id, exceptId)) : eq(airports.icao, icao));
      return row;
    },

    async insertAirport(values) {
      const [row] = await db.insert(airports).values(values).returning({ id: airports.id, icao: airports.icao });
      return row;
    },

    async updateAirport(id, values) {
      await db.update(airports).set(values).where(eq(airports.id, id));
    },

    async deleteAirport(id) {
      // The FBOs go with the airport through the foreign key (cascade); D1
      // enforces foreign keys.
      await db.delete(airports).where(eq(airports.id, id));
    },

    async fbosOf(airportId) {
      return db.select().from(fbos).where(eq(fbos.airportId, airportId)).orderBy(nameNoCase(fbos.name));
    },

    async fboOf(airportId, fboId) {
      const [row] = await db
        .select({ id: fbos.id, name: fbos.name, isPrimary: fbos.isPrimary, isPreferred: fbos.isPreferred })
        .from(fbos)
        .where(and(eq(fbos.id, fboId), eq(fbos.airportId, airportId)));
      return row;
    },

    async insertFbo(values) {
      const [row] = await db.insert(fbos).values(values).returning({ id: fbos.id });
      return row;
    },

    async deleteFbo(id) {
      await db.delete(fbos).where(eq(fbos.id, id));
    },

    async setFboFlag(id, field, value) {
      await db.update(fbos).set({ [field]: value }).where(eq(fbos.id, id));
    },

    async demoteOtherPrimaries(airportId, exceptFboId) {
      await db
        .update(fbos)
        .set({ isPrimary: false })
        .where(and(eq(fbos.airportId, airportId), ne(fbos.id, exceptFboId)));
    },

    // ── counts ──
    async counts() {
      const [o, a, p, f] = await Promise.all([
        db.select({ n: count() }).from(operators),
        db.select({ n: count() }).from(aircraft),
        db.select({ n: count() }).from(airports),
        db.select({ n: count() }).from(fbos),
      ]);
      return { operators: o[0]?.n ?? 0, aircraft: a[0]?.n ?? 0, airports: p[0]?.n ?? 0, fbos: f[0]?.n ?? 0 };
    },
  };
}
