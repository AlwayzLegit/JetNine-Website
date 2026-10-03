import type { z } from "zod";
import { emptyLegCreateOp, emptyLegStatusOp } from "@/domain/empty-legs/ops";
import { listEmptyLegs } from "@/domain/empty-legs/queries";
import { EmptyLegCreateBody, EmptyLegStatusBody } from "@/domain/empty-legs/schemas";
import { runOp } from "@/domain/ops/registry";
import { ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";

/**
 * Empty legs: the repositioning flights on the public board. The writes go
 * through the ops registry: a leg that goes live is seen by the public and
 * texted to watchlist subscribers, so a key that asks before acting gets a
 * 202 for that; drafts and desk-side status changes run at once.
 */

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

const createEmptyLegRoute: RouteDef = {
  method: "POST",
  path: "/empty-legs",
  operationId: "createEmptyLeg",
  summary: "Post an empty leg",
  description:
    "Adds a repositioning leg. `aircraftTail` must be an aircraft on file (its operator and category are copied); `fromIcao` / `toIcao` are the airports, `wheelsUpAt` the departure (ISO 8601), `seats` 1–19, and `listedPriceUsd` must be at least 5% under `fullCharterRefUsd`. `status` defaults to draft; `live` puts the leg on the public board now, where the watchlist cron will text subscribers, so a key that asks before acting gets a 202 for live legs and a person decides in Messages › Needs your OK. `reason` is an optional line for the approver. Returns the new leg's id and EL- code.",
  tag: "Empty legs",
  scope: "desk",
  approval: "conditional",
  body: EmptyLegCreateBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof EmptyLegCreateBody>;
    return opRouteOutput(await runOp(emptyLegCreateOp, actor, input, { reason }), 201);
  },
};

const setEmptyLegStatusRoute: RouteDef = {
  method: "POST",
  path: "/empty-legs/{id}/status",
  operationId: "setEmptyLegStatus",
  summary: "Change an empty leg's status",
  description:
    "Moves the leg to `status` (draft, scheduled, live, sold, cancelled, expired). The public board lists only live legs, so this is also how a sold or stale leg comes off it. Going live texts watchlist subscribers, so a key that asks before acting gets a 202 for that change; everything else runs at once. `reason` is an optional line for the approver.",
  tag: "Empty legs",
  scope: "desk",
  approval: "conditional",
  body: EmptyLegStatusBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof EmptyLegStatusBody>;
    return opRouteOutput(await runOp(emptyLegStatusOp, actor, { id: params.id, ...input }, { reason }));
  },
};

export const EMPTY_LEG_ROUTES = {
  listEmptyLegs: listEmptyLegsRoute,
  createEmptyLeg: createEmptyLegRoute,
  setEmptyLegStatus: setEmptyLegStatusRoute,
} satisfies Record<string, RouteDef>;
