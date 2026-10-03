import { z } from "zod";
import { runOp } from "@/domain/ops/registry";
import {
  aircraftCreateOp,
  aircraftUpdateOp,
  airportCreateOp,
  airportDeleteOp,
  airportUpdateOp,
  fboCreateOp,
  fboDeleteOp,
  fboToggleOp,
  operatorContactAddOp,
  operatorContactRemoveOp,
  operatorContactToggleEscalationOp,
  operatorCreateOp,
  operatorUpdateOp,
} from "@/domain/reference/ops";
import { listAircraft, listAirports, listOperators, listScheduleBlocks } from "@/domain/reference/queries";
import {
  AircraftBody,
  AirportCreateBody,
  AirportDeleteBody,
  AirportUpdateBody,
  FboCreateBody,
  FboDeleteBody,
  FboToggleBody,
  OperatorBody,
  OperatorContactAddBody,
  OperatorContactEscalationBody,
  OperatorContactRemoveBody,
} from "@/domain/reference/schemas";
import { ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";

/**
 * Reference data: the operators, aircraft and airports behind sourcing,
 * and the schedule blocks on the ops board. The writes go through the ops
 * registry. Operators, aircraft, airports and FBOs need the `settings`
 * permission (owners), and a key that asks before acting gets a 202 for
 * every one of them; an operator's contacts are desk bookkeeping and
 * change at once.
 */

const ASKS = "A key that asks before acting gets a 202 and an owner decides in Messages › Needs your OK. `reason` is an optional line for the approver.";

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

// ─── Operators ───────────────────────────────────────────────────────────

const createOperatorRoute: RouteDef = {
  method: "POST",
  path: "/reference/operators",
  operationId: "createOperator",
  summary: "Add an operator",
  description:
    "Adds an operator to the network. `name` is required; `status` defaults to active and `argusRating` to none; `homeAirportIcao` is a 4-character ICAO code; dates are YYYY-MM-DD; a suspended operator needs `suspendedReason`. 409 when another operator already has the `certNumber`. " +
    ASKS +
    " Returns the new operator's id.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: OperatorBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof OperatorBody>;
    return opRouteOutput(await runOp(operatorCreateOp, actor, input, { reason }), 201);
  },
};

const updateOperatorRoute: RouteDef = {
  method: "PATCH",
  path: "/reference/operators/{id}",
  operationId: "updateOperator",
  summary: "Change an operator",
  description:
    "Replaces the operator's details with the body: send every field, as the desk's edit form does, since a field left out goes back to its default or to empty. Same rules as adding one. 409 when another operator already has the `certNumber`. " +
    ASKS +
    " Returns which fields changed.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: OperatorBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof OperatorBody>;
    return opRouteOutput(await runOp(operatorUpdateOp, actor, { id: params.id, ...input }, { reason }));
  },
};

const addOperatorContactRoute: RouteDef = {
  method: "POST",
  path: "/reference/operators/{id}/contacts",
  operationId: "addOperatorContact",
  summary: "Add a contact at an operator",
  description:
    "Adds a person to the operator's contact list: `name`, an optional `role`, and an `email` or a `phoneE164` (at least one). `isEscalation` marks who to call when something goes wrong. Changes at once; never needs approval. Returns the contact's id.",
  tag: "Reference data",
  scope: "desk",
  approval: "never",
  body: OperatorContactAddBody,
  successStatus: 201,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof OperatorContactAddBody>;
    return opRouteOutput(await runOp(operatorContactAddOp, actor, { id: params.id, ...input }, { reason }), 201);
  },
};

const setOperatorContactEscalationRoute: RouteDef = {
  method: "PATCH",
  path: "/reference/operators/{id}/contacts/{contactId}",
  operationId: "setOperatorContactEscalation",
  summary: "Mark or unmark an escalation contact",
  description:
    "Sets `isEscalation` on one of the operator's contacts. Changes at once; never needs approval. Returns the contact's id and the flag as it now stands.",
  tag: "Reference data",
  scope: "desk",
  approval: "never",
  body: OperatorContactEscalationBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof OperatorContactEscalationBody>;
    return opRouteOutput(
      await runOp(operatorContactToggleEscalationOp, actor, { id: params.id, contactId: params.contactId, ...input }, { reason }),
    );
  },
};

const removeOperatorContactRoute: RouteDef = {
  method: "DELETE",
  path: "/reference/operators/{id}/contacts/{contactId}",
  operationId: "removeOperatorContact",
  summary: "Remove a contact from an operator",
  description: "Removes the contact from the operator's list. Changes at once; never needs approval. The body is optional.",
  tag: "Reference data",
  scope: "desk",
  approval: "never",
  body: OperatorContactRemoveBody,
  run: async ({ actor, params, body }) => {
    const { reason } = (body ?? {}) as z.infer<typeof OperatorContactRemoveBody>;
    return opRouteOutput(await runOp(operatorContactRemoveOp, actor, { id: params.id, contactId: params.contactId }, { reason }));
  },
};

// ─── Aircraft ────────────────────────────────────────────────────────────

const createAircraftRoute: RouteDef = {
  method: "POST",
  path: "/reference/aircraft",
  operationId: "createAircraft",
  summary: "Add an aircraft",
  description:
    "Adds an aircraft to the network under an existing operator (`operatorId`). `tailNumber` is 3–16 characters (A-Z, 0-9, -); `category` is turboprop, light, midsize, supermid, heavy or ulr; `seats` 1–19, `rangeNm` 100–10000, `speedKt` 100–700; `status` defaults to available and `wifiType` to none. 404 when the operator is unknown, 409 when the tail number is already on file. " +
    ASKS +
    " Returns the new aircraft's id and tail number.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: AircraftBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof AircraftBody>;
    return opRouteOutput(await runOp(aircraftCreateOp, actor, input, { reason }), 201);
  },
};

const updateAircraftRoute: RouteDef = {
  method: "PATCH",
  path: "/reference/aircraft/{id}",
  operationId: "updateAircraft",
  summary: "Change an aircraft",
  description:
    "Replaces the aircraft's details with the body: send every field, as the desk's edit form does, since a field left out goes back to its default or to empty. Same rules as adding one. 409 when another aircraft already uses the tail number. " +
    ASKS +
    " Returns which fields changed.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: AircraftBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof AircraftBody>;
    return opRouteOutput(await runOp(aircraftUpdateOp, actor, { id: params.id, ...input }, { reason }));
  },
};

// ─── Airports ────────────────────────────────────────────────────────────

const createAirportRoute: RouteDef = {
  method: "POST",
  path: "/reference/airports",
  operationId: "createAirport",
  summary: "Add an airport",
  description:
    "Adds an airport to the catalog. `icao` is the 4-character code, `iata` the optional 3-character one, `countryIso2` a two-letter country code; `lat` and `lon` are decimal degrees; `customs` is none, user_fee, aoe or intl (default none); `active` defaults to true. 409 when the ICAO is already on file. " +
    ASKS +
    " Returns the new airport's id and ICAO.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: AirportCreateBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof AirportCreateBody>;
    return opRouteOutput(await runOp(airportCreateOp, actor, input, { reason }), 201);
  },
};

const updateAirportRoute: RouteDef = {
  method: "PATCH",
  path: "/reference/airports/{id}",
  operationId: "updateAirport",
  summary: "Change an airport",
  description:
    "Replaces the airport's details with the body: send every field, as the desk's edit form does, since a field left out goes back to its default or to empty. Same rules as adding one. 409 when another airport already uses the ICAO. " +
    ASKS +
    " Returns which fields changed.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: AirportUpdateBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof AirportUpdateBody>;
    return opRouteOutput(await runOp(airportUpdateOp, actor, { id: params.id, ...input }, { reason }));
  },
};

const deleteAirportRoute: RouteDef = {
  method: "DELETE",
  path: "/reference/airports/{id}",
  operationId: "deleteAirport",
  summary: "Remove an airport",
  description:
    "Removes the airport and its FBOs from the catalog. Legs that named it keep their code as text, but setting `active` to false with a change is usually the safer move. " +
    ASKS +
    " The body is optional.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: AirportDeleteBody,
  run: async ({ actor, params, body }) => {
    const { reason } = (body ?? {}) as z.infer<typeof AirportDeleteBody>;
    return opRouteOutput(await runOp(airportDeleteOp, actor, { id: params.id }, { reason }));
  },
};

// ─── FBOs ────────────────────────────────────────────────────────────────

const createFboRoute: RouteDef = {
  method: "POST",
  path: "/reference/airports/{id}/fbos",
  operationId: "createFbo",
  summary: "Add an FBO at an airport",
  description:
    "Adds a fixed-base operator (the handling desk passengers walk through) at the airport: `name`, phones in E.164, email, website, hours, and whether it is the airport's primary or our preferred one. The name must be unique at that airport. " +
    ASKS +
    " Returns the new FBO's id.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: FboCreateBody,
  successStatus: 201,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof FboCreateBody>;
    return opRouteOutput(await runOp(fboCreateOp, actor, { id: params.id, ...input }, { reason }), 201);
  },
};

const setFboFlagRoute: RouteDef = {
  method: "PATCH",
  path: "/reference/airports/{id}/fbos/{fboId}",
  operationId: "setFboFlag",
  summary: "Mark an FBO primary or preferred",
  description:
    "Sets one flag on the FBO: `field` is isPrimary or isPreferred and `value` the new setting (left out, the flag flips). Making an FBO primary takes the flag off the airport's other FBOs. " +
    ASKS +
    " Returns the FBO's id, the field and its value as it now stands.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: FboToggleBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof FboToggleBody>;
    return opRouteOutput(await runOp(fboToggleOp, actor, { id: params.id, fboId: params.fboId, ...input }, { reason }));
  },
};

const deleteFboRoute: RouteDef = {
  method: "DELETE",
  path: "/reference/airports/{id}/fbos/{fboId}",
  operationId: "deleteFbo",
  summary: "Remove an FBO",
  description: "Removes the FBO from the airport. " + ASKS + " The body is optional.",
  tag: "Reference data",
  scope: "settings",
  approval: "always",
  body: FboDeleteBody,
  run: async ({ actor, params, body }) => {
    const { reason } = (body ?? {}) as z.infer<typeof FboDeleteBody>;
    return opRouteOutput(await runOp(fboDeleteOp, actor, { id: params.id, fboId: params.fboId }, { reason }));
  },
};

export const REFERENCE_ROUTES = {
  listOperators: listOperatorsRoute,
  createOperator: createOperatorRoute,
  updateOperator: updateOperatorRoute,
  addOperatorContact: addOperatorContactRoute,
  setOperatorContactEscalation: setOperatorContactEscalationRoute,
  removeOperatorContact: removeOperatorContactRoute,
  listAircraft: listAircraftRoute,
  createAircraft: createAircraftRoute,
  updateAircraft: updateAircraftRoute,
  listAirports: listAirportsRoute,
  createAirport: createAirportRoute,
  updateAirport: updateAirportRoute,
  deleteAirport: deleteAirportRoute,
  createFbo: createFboRoute,
  setFboFlag: setFboFlagRoute,
  deleteFbo: deleteFboRoute,
  listScheduleBlocks: listScheduleBlocksRoute,
} satisfies Record<string, RouteDef>;
