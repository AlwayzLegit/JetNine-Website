import { and, asc, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { nextCode } from "@/db/codes";
import { aircraft } from "@/db/schema/aircraft";
import { airports } from "@/db/schema/airports";
import { emptyLegs } from "@/db/schema/empty-legs";
import { operators } from "@/db/schema/operators";
import type { EmptyLegStore } from "./store";

// The Postgres side of the empty-legs store (OPS-113): today's queries, moved
// here unchanged. Postgres sorts NULLs first on a descending sort, which the
// "recently sold" strip relies on (see the D1 side, which says it out loud).

export function pgEmptyLegStore(): EmptyLegStore {
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
        .orderBy(asc(operators.name), asc(aircraft.tailNumber));
    },

    async tailRef(tail) {
      const [row] = await db
        .select({ id: aircraft.id, operatorId: aircraft.operatorId, category: aircraft.category })
        .from(aircraft)
        .where(eq(aircraft.tailNumber, tail));
      return row;
    },

    async createLeg(values, now) {
      // The app makes the code (OPS-101); the empty_legs_default_code trigger
      // fills it only when empty. One transaction, so a failed insert gives the number back.
      const [row] = await db.transaction(async (tx) => {
        const code = await nextCode(tx, "empty_leg", now);
        return tx
          .insert(emptyLegs)
          .values({ ...values, code })
          .returning({ id: emptyLegs.id, code: emptyLegs.code });
      });
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
          // State + country of the departure airport drive the coast filter.
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
        .orderBy(desc(emptyLegs.soldAt))
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
        // Same visibility rule as the public board, plus "has not departed".
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
