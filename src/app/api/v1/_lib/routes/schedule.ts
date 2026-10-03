import { runOp } from "@/domain/ops/registry";
import { scheduleBlockCreateOp, scheduleBlockDeleteOp } from "@/domain/schedule/ops";
import { ScheduleBlockCreateBody } from "@/domain/schedule/schemas";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";

/**
 * Writes on the ops board. Reading the board is GET /schedule/blocks in
 * ./reference.ts. Blocking or freeing an aircraft is desk-side, so these
 * never wait for approval.
 */

const createScheduleBlockRoute: RouteDef = {
  method: "POST",
  path: "/schedule/blocks",
  operationId: "createScheduleBlock",
  summary: "Block an aircraft",
  description:
    "Takes an aircraft off the line for a window: `kind` is maintenance, repositioning, crew_rest, owner or unavailable (trip and hold blocks are written by the trip and request lifecycles and are refused with a 422). `startAt` and `endAt` are ISO 8601; the window must be at least a minute and at most a year. `fromIcao` / `toIcao` suit repositioning; `notes` is free text. Returns the block id.",
  tag: "Reference data",
  scope: "desk",
  approval: "never",
  body: ScheduleBlockCreateBody,
  successStatus: 201,
  run: async ({ actor, body }) => opRouteOutput(await runOp(scheduleBlockCreateOp, actor, body), 201),
};

const deleteScheduleBlockRoute: RouteDef = {
  method: "DELETE",
  path: "/schedule/blocks/{id}",
  operationId: "deleteScheduleBlock",
  summary: "Remove a block",
  description:
    "Removes a manual block from the ops board. 409 for a trip or hold block: cancel the trip or release the hold on its request instead.",
  tag: "Reference data",
  scope: "desk",
  approval: "never",
  run: async ({ actor, params }) => opRouteOutput(await runOp(scheduleBlockDeleteOp, actor, { id: params.id })),
};

export const SCHEDULE_ROUTES = {
  createScheduleBlock: createScheduleBlockRoute,
  deleteScheduleBlock: deleteScheduleBlockRoute,
} satisfies Record<string, RouteDef>;
