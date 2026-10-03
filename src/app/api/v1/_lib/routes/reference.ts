import { z } from "zod";
import { listAircraft, listAirports, listOperators, listScheduleBlocks } from "@/domain/reference/queries";
import { ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * Reference data: the operators, aircraft and airports behind sourcing,
 * and the schedule blocks on the ops board.
 */

const listOperatorsRoute: RouteDef = {
  method: "GET",
  path: "/reference/operators",
  operationId: "listOperators",
  summary: "List operators",
  description:
    "Every operator we book with, preferred first: certificate, home base, vetting status, safety ratings, audit and insurance dates, and how many aircraft they fly. `meta.totals` counts them by status.",
  tag: "Reference data",
  scope: "read",
  run: async () => {
    const { operators, totals } = await listOperators();
    return ok({ data: operators, meta: { totals } });
  },
};

const listAircraftRoute: RouteDef = {
  method: "GET",
  path: "/reference/aircraft",
  operationId: "listAircraft",
  summary: "List aircraft",
  description:
    "Every aircraft in the network, by category then tail number, with seats, range, speed, cabin features, base and status, plus its operator. `meta.totals` counts them by status.",
  tag: "Reference data",
  scope: "read",
  run: async () => {
    const { aircraft, totals } = await listAircraft();
    return ok({ data: aircraft, meta: { totals } });
  },
};

const listAirportsRoute: RouteDef = {
  method: "GET",
  path: "/reference/airports",
  operationId: "listAirports",
  summary: "List airports",
  description:
    "Every airport we know, by country then ICAO, with IATA code, city, customs availability, whether it is active and how many FBOs it has. `meta.totals` has the airport, FBO and country counts.",
  tag: "Reference data",
  scope: "read",
  run: async () => {
    const { airports, totals } = await listAirports();
    return ok({ data: airports, meta: { totals } });
  },
};

const listScheduleBlocksRoute: RouteDef = {
  method: "GET",
  path: "/schedule/blocks",
  operationId: "listScheduleBlocks",
  summary: "List schedule blocks",
  description:
    "The ops board: every aircraft and the blocks (trips, maintenance, repositioning, crew rest, owner use, soft holds, unavailable) that overlap the next `days` days (default 14, up to 60), starting at today's UTC midnight. `meta` has the window and the share of aircraft-days in use.",
  tag: "Reference data",
  scope: "read",
  query: z.object({ days: z.coerce.number().int().min(1).max(60).optional() }),
  run: async ({ query }) => {
    const window = await listScheduleBlocks(new Date(), (query.days as number | undefined) ?? 14);
    return ok({
      data: { fleet: window.fleet, blocks: window.blocks },
      meta: { from: window.from, to: window.to, days: window.days, utilizationPct: window.utilizationPct },
    });
  },
};

export const REFERENCE_ROUTES = {
  listOperators: listOperatorsRoute,
  listAircraft: listAircraftRoute,
  listAirports: listAirportsRoute,
  listScheduleBlocks: listScheduleBlocksRoute,
} satisfies Record<string, RouteDef>;
