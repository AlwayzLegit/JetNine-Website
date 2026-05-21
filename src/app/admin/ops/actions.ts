"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import {
  aircraftScheduleBlocks,
  scheduleBlockKindEnum,
  type NewAircraftScheduleBlock,
} from "@/db/schema/schedule-blocks";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const KINDS = scheduleBlockKindEnum.enumValues as readonly string[];

// Trip + hold blocks are managed by the trips and quotes lifecycles; the
// manual planner UI must not author them.
const MANUAL_KINDS = new Set([
  "maintenance",
  "repositioning",
  "crew_rest",
  "owner",
  "unavailable",
]);

function parseWhen(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export type CreateBlockResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createScheduleBlock(
  formData: FormData,
): Promise<CreateBlockResult> {
  const actor = await requireStaff();

  const aircraftId = ((formData.get("aircraftId") as string | null) ?? "").trim();
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Pick an aircraft" };

  const kindRaw = ((formData.get("kind") as string | null) ?? "").trim();
  if (!KINDS.includes(kindRaw)) return { ok: false, error: "Pick a kind" };
  if (!MANUAL_KINDS.has(kindRaw)) {
    return {
      ok: false,
      error: "Trip + hold blocks are auto-managed; pick a manual kind.",
    };
  }

  const startAt = parseWhen(formData.get("startAt") as string | null);
  const endAt = parseWhen(formData.get("endAt") as string | null);
  if (!startAt) return { ok: false, error: "Start required" };
  if (!endAt) return { ok: false, error: "End required" };
  if (endAt <= startAt) return { ok: false, error: "End must be after start" };

  // Sanity ceiling — no blocks longer than 1 year. Anything that long is
  // probably a data-entry error, not a real ops scenario.
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  if (endAt.getTime() - startAt.getTime() > oneYearMs) {
    return { ok: false, error: "Window exceeds 1 year" };
  }

  const [ac] = await db
    .select({ id: aircraft.id, tailNumber: aircraft.tailNumber })
    .from(aircraft)
    .where(eq(aircraft.id, aircraftId));
  if (!ac) return { ok: false, error: "Aircraft not found" };

  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const fromIcao =
    ((formData.get("fromIcao") as string | null) ?? "").trim().toUpperCase() || null;
  const toIcao =
    ((formData.get("toIcao") as string | null) ?? "").trim().toUpperCase() || null;

  const values: NewAircraftScheduleBlock = {
    aircraftId,
    kind: kindRaw as NewAircraftScheduleBlock["kind"],
    startAt,
    endAt,
    fromIcao,
    toIcao,
    notes,
    createdByUserId: actor.id,
  };

  try {
    const [row] = await db
      .insert(aircraftScheduleBlocks)
      .values(values)
      .returning({ id: aircraftScheduleBlocks.id });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "schedule_block.create",
      subjectType: "aircraft",
      subjectId: aircraftId,
      subjectCode: ac.tailNumber,
      metadata: {
        blockId: row.id,
        kind: kindRaw,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        windowHours: Math.round((endAt.getTime() - startAt.getTime()) / 3_600_000),
      },
    });

    revalidatePath("/admin/ops");
    revalidatePath("/admin/aircraft");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("createScheduleBlock failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function deleteScheduleBlock(
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();
  if (!UUID_RE.test(blockId)) return { ok: false, error: "Bad block id" };

  const [target] = await db
    .select({
      id: aircraftScheduleBlocks.id,
      aircraftId: aircraftScheduleBlocks.aircraftId,
      kind: aircraftScheduleBlocks.kind,
      relatedTripId: aircraftScheduleBlocks.relatedTripId,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
    })
    .from(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.id, blockId));
  if (!target) return { ok: false, error: "Not found" };

  if (target.relatedTripId || target.relatedQuoteId) {
    return {
      ok: false,
      error: "Auto-managed by trip/quote — cancel the trip or release the hold instead.",
    };
  }

  await db
    .delete(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.id, target.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "schedule_block.delete",
    subjectType: "aircraft",
    subjectId: target.aircraftId,
    metadata: { blockId: target.id, kind: target.kind },
  });

  revalidatePath("/admin/ops");
  return { ok: true };
}
