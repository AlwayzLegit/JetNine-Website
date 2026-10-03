import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { emptyLegs } from "@/db/schema/empty-legs";

/**
 * Empty-leg queries shared by /admin/empty-leg and /api/v1/empty-legs.
 * The public board at /empty-legs reads the same table.
 */

export type EmptyLegStatusTotals = { live: number; scheduled: number; draft: number; sold: number };

export type EmptyLegList = {
  legs: Awaited<ReturnType<typeof loadLegs>>;
  /** Counts by status over the listed legs. */
  totals: EmptyLegStatusTotals;
};

async function loadLegs() {
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
    .limit(50);
}

/** The 50 most recent empty legs (by wheels-up time) with their operator, plus status totals. */
export async function listEmptyLegs(): Promise<EmptyLegList> {
  const legs = await loadLegs();
  const totals: EmptyLegStatusTotals = {
    live: legs.filter((r) => r.status === "live").length,
    scheduled: legs.filter((r) => r.status === "scheduled").length,
    draft: legs.filter((r) => r.status === "draft").length,
    sold: legs.filter((r) => r.status === "sold").length,
  };
  return { legs, totals };
}

export type AvailableTail = { tail: string; makeModel: string; operator: string };

/** Available aircraft with their operator, for the new-leg form. */
export async function listAvailableAircraft(): Promise<AvailableTail[]> {
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
}
