"use server";

import { revalidatePath } from "next/cache";
import type { Approval } from "@/db/schema/approvals";
import { sessionActor } from "@/domain/actor";
import { approve, reject } from "@/domain/approvals/commands";

// Messages › Needs your OK. A person approves or rejects what the daily
// assistant proposed. The domain decides who may; this only reads the form
// and refreshes the pages that show the result.

export type DecisionResult = { ok: true } | { ok: false; error: string };

const MESSAGES = "/admin/messages";

/** Every `edit:<field>` input becomes `edits[field]`. */
function editsFrom(formData: FormData): Record<string, unknown> {
  const edits: Record<string, unknown> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("edit:") && typeof value === "string") edits[name.slice("edit:".length)] = value;
  }
  return edits;
}

function noteFrom(formData: FormData): string {
  const v = formData.get("note");
  return typeof v === "string" ? v.trim() : "";
}

function refresh(approval: Approval | null): void {
  revalidatePath(MESSAGES);
  if (!approval?.subjectId) return;
  if (approval.subjectType === "quote") revalidatePath(`/admin/requests/${approval.subjectId}`);
  if (approval.subjectType === "trip") revalidatePath(`/admin/trips/${approval.subjectId}`);
}

export async function approveProposal(id: string, formData: FormData): Promise<DecisionResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const note = noteFrom(formData);
  const r = await approve(s.value, id, { edits: editsFrom(formData), note: note || undefined });
  if (!r.ok) {
    // "Approved, but it did not go through" still moved the row, so the tab must refresh.
    refresh(null);
    return { ok: false, error: r.error };
  }
  refresh(r.value.approval);
  return { ok: true };
}

export async function rejectProposal(id: string, formData: FormData): Promise<DecisionResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const note = noteFrom(formData);
  if (!note) return { ok: false, error: "Say why, in a few words." };

  const r = await reject(s.value, id, note);
  if (!r.ok) {
    refresh(null);
    return { ok: false, error: r.error };
  }
  refresh(r.value);
  return { ok: true };
}
