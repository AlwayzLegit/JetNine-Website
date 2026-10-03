import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  createScheduleBlock,
  deleteScheduleBlock,
  loadForScheduleBlockCreate,
  loadScheduleBlockForDelete,
  type ScheduleBlockCreateState,
  type ScheduleBlockDeleteState,
} from "./commands";
import { ScheduleBlockCreateInput, ScheduleBlockDeleteInput, type ScheduleBlockKind } from "./schemas";

/** Operations on the ops board. Blocking or freeing an aircraft is desk-side: nobody outside hears about it. */

export const BLOCK_KIND_WORDS: Record<ScheduleBlockKind, string> = {
  trip: "trip",
  maintenance: "maintenance",
  repositioning: "repositioning",
  crew_rest: "crew rest",
  owner: "owner use",
  hold: "hold",
  unavailable: "unavailable",
};

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

export const scheduleBlockCreateOp = defineOp<ScheduleBlockCreateInput, ScheduleBlockCreateState>({
  id: "schedule.block.create",
  scope: "desk",
  schema: ScheduleBlockCreateInput,
  load: loadForScheduleBlockCreate,
  risk: () => null,
  summary: (input, state) =>
    `Block ${state.aircraft.tailNumber} (${BLOCK_KIND_WORDS[input.kind]}) from ${when.format(state.startAt)} to ${when.format(state.endAt)}`,
  subject: (_input, state) => ({ type: "aircraft", id: state.aircraft.id, code: state.aircraft.tailNumber }),
  run: createScheduleBlock,
  revalidate: () => ["/admin/ops", "/admin/aircraft"],
});

export const scheduleBlockDeleteOp = defineOp<ScheduleBlockDeleteInput, ScheduleBlockDeleteState>({
  id: "schedule.block.delete",
  scope: "desk",
  schema: ScheduleBlockDeleteInput,
  load: loadScheduleBlockForDelete,
  risk: () => null,
  summary: (_input, state) => `Remove the ${BLOCK_KIND_WORDS[state.block.kind]} block from the ops board`,
  subject: (_input, state) => ({ type: "aircraft", id: state.block.aircraftId }),
  run: deleteScheduleBlock,
  revalidate: () => ["/admin/ops"],
});

export const SCHEDULE_OPS: AnyOp[] = [scheduleBlockCreateOp, scheduleBlockDeleteOp];
