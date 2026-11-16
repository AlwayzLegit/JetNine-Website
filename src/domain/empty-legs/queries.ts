import { emptyLegStore, type AdminLegRow } from "./store";

/**
 * Empty-leg queries shared by /admin/empty-leg and /api/v1/empty-legs.
 * The public board at /empty-legs reads the same table. Every query goes
 * through the empty-legs store (./store.ts), Postgres or D1 by dbTarget() (OPS-113).
 */

export type EmptyLegStatusTotals = { live: number; scheduled: number; draft: number; sold: number };

export type EmptyLegList = {
  legs: AdminLegRow[];
  /** Counts by status over the listed legs. */
  totals: EmptyLegStatusTotals;
};

/** The 50 most recent empty legs (by wheels-up time) with their operator, plus status totals. */
export async function listEmptyLegs(): Promise<EmptyLegList> {
  const legs = await emptyLegStore().adminLegs(50);
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
  return emptyLegStore().availableTails();
}
