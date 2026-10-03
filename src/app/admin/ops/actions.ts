"use server";

import { scheduleBlockKindEnum } from "@/db/schema/schedule-blocks";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { scheduleBlockCreateOp, scheduleBlockDeleteOp } from "@/domain/schedule/ops";
import { isManualBlockKind } from "@/domain/schedule/schemas";
import { AUTO_MANAGED_KIND } from "@/domain/schedule/commands";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const KINDS = scheduleBlockKindEnum.enumValues as readonly string[];
const PENDING = "This was sent for approval.";

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

/**
 * Block an aircraft from the planner form. The form-shape checks stay here
 * with their wording; the window checks, the insert and the audit row are
 * the "schedule.block.create" op (src/domain/schedule), shared with the
 * API. runOp revalidates the ops board and the aircraft list.
 */
export async function createScheduleBlock(
  formData: FormData,
): Promise<CreateBlockResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const aircraftId = ((formData.get("aircraftId") as string | null) ?? "").trim();
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Pick an aircraft" };

  const kind = ((formData.get("kind") as string | null) ?? "").trim();
  if (!KINDS.includes(kind)) return { ok: false, error: "Pick a kind" };
  if (!isManualBlockKind(kind)) return { ok: false, error: AUTO_MANAGED_KIND };

  const startAt = parseWhen(formData.get("startAt") as string | null);
  const endAt = parseWhen(formData.get("endAt") as string | null);
  if (!startAt) return { ok: false, error: "Start required" };
  if (!endAt) return { ok: false, error: "End required" };

  const r = await runOp(scheduleBlockCreateOp, session.value, {
    aircraftId,
    kind,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    fromIcao: ((formData.get("fromIcao") as string | null) ?? "").trim().toUpperCase(),
    toIcao: ((formData.get("toIcao") as string | null) ?? "").trim().toUpperCase(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

// The work itself is the "schedule.block.delete" op (src/domain/schedule):
// it refuses trip and hold blocks, which belong to their trip or request.
export async function deleteScheduleBlock(
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(blockId)) return { ok: false, error: "Bad block id" };

  const r = await runOp(scheduleBlockDeleteOp, session.value, { id: blockId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Bad block id" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}
