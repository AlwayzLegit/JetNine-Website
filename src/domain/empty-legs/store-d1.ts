import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { codeSql, codeYear } from "@/db/codes";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { emptyLegCodeSequence, emptyLegs } from "@/db/d1/schema/empty-legs";
import { operators } from "@/db/d1/schema/operators";
import type { EmptyLegStore } from "./store";

// The D1 (SQLite) side of the empty-legs store (OPS-113). Same methods and the
// same results as store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// Differences from Postgres that this file keeps the same:
// - Text sorts BINARY in SQLite ("Zulu" before "alpha"), the Postgres collation
//   does not split by case, so the sort by operator name says `collate nocase`.
// - A descending sort puts NULLs first on Postgres and last on SQLite. The
//   "recently sold" strip lists sold legs by sold_at, newest first, with a leg
//   whose sold_at is null first, so the sort says that out loud.
// - The code and the insert were one Postgres transaction. D1 from a Worker has
//   no interactive transaction; db.batch() runs its statements as one
//   transaction and rolls all back when one fails, so the counter upsert and the
//   insert (which reads the counter in SQL, codeSql) are one batch.

type D1Client = DrizzleD1Database;

export function d1EmptyLegStore(db: D1Client): EmptyLegStore {
  return {
    async adminLegs(limit) {
      return db
        .select({
          id: emptyLegs.id,
          code: emptyLegs.code,
          status: emptyLegs.status,
          fromIata: emptyLegs.fromIata,
          fromIcao: emptyLegs.fromIcao,
          toIata: emptyLegs.toIata,
          toIcao: emptyLegs.toIcao,
          wheelsUpAt: emptyLegs.wheelsUpAt,
          seatsAvailable: emptyLegs.seatsAvailable,
          listedPriceUsd: emptyLegs.listedPriceUsd,
          discountPct: emptyLegs.discountPct,
          operatorId: emptyLegs.operatorId,
          operatorName: operators.name,
        })
        .from(emptyLegs)
        .innerJoin(operators, eq(operators.id, emptyLegs.operatorId))
        .orderBy(desc(emptyLegs.wheelsUpAt))
        .limit(limit);
    },

    async availableTails() {
      return db
        .select({
          tail: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          operator: operators.name,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .where(eq(aircraft.status, "available"))
        .orderBy(sql`${operators.name} collate nocase`, asc(aircraft.tailNumber));
    },

    async tailRef(tail) {
      const [row] = await db
        .select({ id: aircraft.id, operatorId: aircraft.operatorId, category: aircraft.category })
        .from(aircraft)
        .where(eq(aircraft.tailNumber, tail));
      return row;
    },

    async createLeg(values, now) {
      const year = codeYear(now);
      const [, rows] = await db.batch([
        // The counter moves first: the insert's code reads the value this leaves.
        db
          .insert(emptyLegCodeSequence)
          .values({ year, lastValue: 1 })
          .onConflictDoUpdate({
            target: emptyLegCodeSequence.year,
            set: { lastValue: sql`${emptyLegCodeSequence.lastValue} + 1` },
          }),
        db
          .insert(emptyLegs)
          .values({ ...values, code: codeSql("empty_leg", year) })
          .returning({ id: emptyLegs.id, code: emptyLegs.code }),
      ]);
      const row = rows[0];
      if (!row) throw new Error("empty leg insert returned no row");
      return row;
    },

    async legForStatus(id) {
      const [row] = await db
        .select({ id: emptyLegs.id, code: emptyLegs.code, status: emptyLegs.status })
        .from(emptyLegs)
        .where(eq(emptyLegs.id, id));
      return row;
    },

    async setStatus(id, status, at) {
      await db.update(emptyLegs).set({ status, updatedAt: at }).where(eq(emptyLegs.id, id));
    },

    async boardLegs() {
      return db
        .select({
          id: emptyLegs.id,
          code: emptyLegs.code,
          category: emptyLegs.category,
          fromIata: emptyLegs.fromIata,
          fromIcao: emptyLegs.fromIcao,
          fromCity: emptyLegs.fromCity,
          fromName: emptyLegs.fromName,
          toIata: emptyLegs.toIata,
          toIcao: emptyLegs.toIcao,
          toCity: emptyLegs.toCity,
          toName: emptyLegs.toName,
          wheelsUpAt: emptyLegs.wheelsUpAt,
          flightMinutes: emptyLegs.flightMinutes,
          seats: emptyLegs.seatsAvailable,
          priceWas: emptyLegs.fullCharterRefUsd,
          priceNow: emptyLegs.listedPriceUsd,
          discountPct: emptyLegs.discountPct,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          argusRating: operators.argusRating,
          wyvernWingman: operators.wyvernWingman,
          fromRegion: airports.region,
          fromCountry: airports.countryIso2,
        })
        .from(emptyLegs)
        .leftJoin(aircraft, eq(aircraft.id, emptyLegs.aircraftId))
        .innerJoin(operators, eq(operators.id, emptyLegs.operatorId))
        .leftJoin(airports, eq(airports.icao, emptyLegs.fromIcao))
        .where(eq(emptyLegs.status, "live"))
        .orderBy(asc(emptyLegs.wheelsUpAt));
    },

    async recentlySold(limit) {
      return db
        .select({
          id: emptyLegs.id,
          code: emptyLegs.code,
          category: emptyLegs.category,
          fromIata: emptyLegs.fromIata,
          fromIcao: emptyLegs.fromIcao,
          fromCity: emptyLegs.fromCity,
          toIata: emptyLegs.toIata,
          toIcao: emptyLegs.toIcao,
          toCity: emptyLegs.toCity,
          priceNow: emptyLegs.listedPriceUsd,
          discountPct: emptyLegs.discountPct,
          soldAt: emptyLegs.soldAt,
          boardGoLiveAt: emptyLegs.boardGoLiveAt,
          createdAt: emptyLegs.createdAt,
        })
        .from(emptyLegs)
        .where(eq(emptyLegs.status, "sold"))
        .orderBy(sql`(${emptyLegs.soldAt} is null) desc`, desc(emptyLegs.soldAt))
        .limit(limit);
    },

    async liveLegsAfter(now) {
      return db
        .select({
          id: emptyLegs.id,
          code: emptyLegs.code,
          category: emptyLegs.category,
          fromIcao: emptyLegs.fromIcao,
          fromIata: emptyLegs.fromIata,
          fromCity: emptyLegs.fromCity,
          fromName: emptyLegs.fromName,
          toIcao: emptyLegs.toIcao,
          toIata: emptyLegs.toIata,
          toCity: emptyLegs.toCity,
          toName: emptyLegs.toName,
          wheelsUpAt: emptyLegs.wheelsUpAt,
          listedPriceUsd: emptyLegs.listedPriceUsd,
          fullCharterRefUsd: emptyLegs.fullCharterRefUsd,
          discountPct: emptyLegs.discountPct,
        })
        .from(emptyLegs)
        .where(and(eq(emptyLegs.status, "live"), gt(emptyLegs.wheelsUpAt, now)))
        .orderBy(asc(emptyLegs.wheelsUpAt));
    },

    async countActive() {
      const [row] = await db
        .select({ n: count() })
        .from(emptyLegs)
        .where(inArray(emptyLegs.status, ["scheduled", "live"]));
      return row?.n ?? 0;
    },
  };
}
