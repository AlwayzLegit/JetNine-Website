import { listEmptyLegs } from "@/domain/empty-legs/queries";
import { ok } from "@/domain/result";
import type { RouteDef } from "../handler";

const listEmptyLegsRoute: RouteDef = {
  method: "GET",
  path: "/empty-legs",
  operationId: "listEmptyLegs",
  summary: "List empty legs",
  description:
    "The 50 most recent repositioning legs by wheels-up time, every status, with the operator, seats, listed price and discount. `meta.totals` counts them by status. The public board shows only live legs.",
  tag: "Empty legs",
  scope: "read",
  run: async () => {
    const { legs, totals } = await listEmptyLegs();
    return ok({ data: legs, meta: { totals } });
  },
};

export const EMPTY_LEG_ROUTES = {
  listEmptyLegs: listEmptyLegsRoute,
} satisfies Record<string, RouteDef>;
