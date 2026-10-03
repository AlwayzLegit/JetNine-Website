import { z } from "zod";
import { scheduleBlockKindEnum } from "@/db/schema/schedule-blocks";

/**
 * Input shapes for the schedule-block operations on the ops board. These
 * ops never need approval, so the API bodies are the inputs themselves
 * (minus the id, which the path carries).
 */

export type ScheduleBlockKind = (typeof scheduleBlockKindEnum.enumValues)[number];

/** Trip and hold blocks are written by the trip and request lifecycles; the planner authors only these. */
export const MANUAL_BLOCK_KINDS = ["maintenance", "repositioning", "crew_rest", "owner", "unavailable"] as const satisfies readonly ScheduleBlockKind[];

export function isManualBlockKind(v: string): v is (typeof MANUAL_BLOCK_KINDS)[number] {
  return (MANUAL_BLOCK_KINDS as readonly string[]).includes(v);
}

const icao = z.string().trim().toUpperCase().optional();

export const ScheduleBlockCreateInput = z.object({
  aircraftId: z.uuid(),
  kind: z.enum(scheduleBlockKindEnum.enumValues).describe("maintenance, repositioning, crew_rest, owner or unavailable; trip and hold are managed by the trip and request lifecycles."),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }).describe("After startAt and within a year of it."),
  fromIcao: icao,
  toIcao: icao,
  notes: z.string().trim().optional(),
});
export type ScheduleBlockCreateInput = z.infer<typeof ScheduleBlockCreateInput>;

export const ScheduleBlockDeleteInput = z.object({
  id: z.uuid(),
});
export type ScheduleBlockDeleteInput = z.infer<typeof ScheduleBlockDeleteInput>;

export const ScheduleBlockCreateBody = ScheduleBlockCreateInput;
