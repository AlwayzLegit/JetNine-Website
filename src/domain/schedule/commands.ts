import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { aircraftScheduleBlocks, type NewAircraftScheduleBlock } from "@/db/schema/schedule-blocks";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import { isManualBlockKind, type ScheduleBlockCreateInput, type ScheduleBlockDeleteInput, type ScheduleBlockKind } from "./schemas";

/**
 * Schedule-block commands for the ops board, shared by the admin's Server
 * Actions and the API through the ops in ./ops.ts. Trip and hold blocks
 * belong to the trip and request lifecycles: the planner can neither
 * author nor remove them here. Nothing here checks the session or
 * revalidates: the op declares its paths and `runOp` handles both.
 */

export const AUTO_MANAGED_KIND = "Trip + hold blocks are auto-managed; pick a manual kind.";
export const AUTO_MANAGED_BLOCK = "Auto-managed by trip/quote — cancel the trip or release the hold instead.";

// Sanity ceiling: anything longer is a data-entry error, not a real ops scenario.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Create ──────────────────────────────────────────────────────────────

export type ScheduleBlockCreateState = {
  aircraft: { id: string; tailNumber: string };
  startAt: Date;
  endAt: Date;
};

export async function loadForScheduleBlockCreate(input: ScheduleBlockCreateInput): Promise<Result<ScheduleBlockCreateState>> {
  if (!isManualBlockKind(input.kind)) return err("invalid", AUTO_MANAGED_KIND);

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime())) return err("invalid", "Start required");
  if (Number.isNaN(endAt.getTime())) return err("invalid", "End required");
  if (endAt <= startAt) return err("invalid", "End must be after start");
  if (endAt.getTime() - startAt.getTime() > ONE_YEAR_MS) return err("invalid", "Window exceeds 1 year");

  if (!isUuid(input.aircraftId)) return err("not_found", "Aircraft not found");
  const [ac] = await db
    .select({ id: aircraft.id, tailNumber: aircraft.tailNumber })
    .from(aircraft)
    .where(eq(aircraft.id, input.aircraftId));
  if (!ac) return err("not_found", "Aircraft not found");

  return ok({ aircraft: ac, startAt, endAt });
}

export async function createScheduleBlock(
  actor: Actor,
  input: ScheduleBlockCreateInput,
  state: ScheduleBlockCreateState,
): Promise<Result<{ id: string }>> {
  const { aircraft: ac, startAt, endAt } = state;
  const a = auditFields(actor);

  const values: NewAircraftScheduleBlock = {
    aircraftId: ac.id,
    kind: input.kind,
    startAt,
    endAt,
    fromIcao: input.fromIcao || null,
    toIcao: input.toIcao || null,
    notes: input.notes || null,
    createdByUserId: a.actorUserId,
  };

  let row: { id: string };
  try {
    [row] = await db.insert(aircraftScheduleBlocks).values(values).returning({ id: aircraftScheduleBlocks.id });
  } catch (e) {
    console.error("createScheduleBlock failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "schedule_block.create",
    subjectType: "aircraft",
    subjectId: ac.id,
    subjectCode: ac.tailNumber,
    metadata: {
      ...a.metadata,
      blockId: row.id,
      kind: input.kind,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      windowHours: Math.round((endAt.getTime() - startAt.getTime()) / 3_600_000),
    },
  });

  return ok({ id: row.id });
}

// ─── Delete ──────────────────────────────────────────────────────────────

export type ScheduleBlockDeleteState = {
  block: { id: string; aircraftId: string; kind: ScheduleBlockKind };
};

export async function loadScheduleBlockForDelete(input: ScheduleBlockDeleteInput): Promise<Result<ScheduleBlockDeleteState>> {
  if (!isUuid(input.id)) return err("not_found", "Not found");
  const [target] = await db
    .select({
      id: aircraftScheduleBlocks.id,
      aircraftId: aircraftScheduleBlocks.aircraftId,
      kind: aircraftScheduleBlocks.kind,
      relatedTripId: aircraftScheduleBlocks.relatedTripId,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
    })
    .from(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.id, input.id));
  if (!target) return err("not_found", "Not found");
  if (target.relatedTripId || target.relatedQuoteId) return err("conflict", AUTO_MANAGED_BLOCK);
  return ok({ block: { id: target.id, aircraftId: target.aircraftId, kind: target.kind } });
}

export async function deleteScheduleBlock(
  actor: Actor,
  _input: ScheduleBlockDeleteInput,
  state: ScheduleBlockDeleteState,
): Promise<Result<{ id: string }>> {
  const { block } = state;
  const a = auditFields(actor);

  await db.delete(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.id, block.id));

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "schedule_block.delete",
    subjectType: "aircraft",
    subjectId: block.aircraftId,
    metadata: { ...a.metadata, blockId: block.id, kind: block.kind },
  });

  return ok({ id: block.id });
}
