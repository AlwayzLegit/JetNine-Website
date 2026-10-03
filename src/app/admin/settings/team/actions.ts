"use server";

import type { z } from "zod";
import { DESK_ROLE_WORDS, type DeskRole } from "@/lib/desk-status";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import type { Err } from "@/domain/result";
import type { InviteOutcome, RoleOutcome } from "@/domain/team/commands";
import { teamInviteOp, teamRemoveOp, teamRoleOp } from "@/domain/team/ops";

// Settings › Team. Owner-only (the `admin` permission). The work itself is
// the team.* ops (src/domain/team), shared with the API and the approval
// queue; runOp checks the permission and revalidates the page. These
// wrappers turn the form into the op's input and the outcome back into the
// sentences the forms have always shown.

export type TeamActionResult = { ok: true; message: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PENDING = "This was sent for approval.";

/** The form's own wording for a failed op: the first validation message, or the op's sentence. */
function failure(r: Err): string {
  if (r.code === "invalid") return (r.details as z.ZodIssue[] | undefined)?.[0]?.message ?? r.error;
  return r.error;
}

// ─── Invite ─────────────────────────────────────────────────────────────

export async function inviteTeammate(formData: FormData): Promise<TeamActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const r = await runOp(teamInviteOp, session.value, {
    email: (formData.get("email") as string | null) ?? "",
    firstName: (formData.get("firstName") as string | null) ?? "",
    lastName: (formData.get("lastName") as string | null) ?? "",
    role: (formData.get("role") as string | null) ?? "team",
  });
  if (!r.ok) return { ok: false, error: failure(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };

  const out = r.value.value as InviteOutcome;
  const label = DESK_ROLE_WORDS[out.role].label;
  return {
    ok: true,
    message: out.invited
      ? `Invite sent to ${out.email}. They join as ${label} once they sign in.`
      : `${out.name} is now on the desk as ${label}.`,
  };
}

// ─── Change role ────────────────────────────────────────────────────────

export async function setTeammateRole(userId: string, role: DeskRole): Promise<TeamActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(userId)) return { ok: false, error: "Bad request." };

  const r = await runOp(teamRoleOp, session.value, { id: userId, role });
  if (!r.ok) return { ok: false, error: failure(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };

  const out = r.value.value as RoleOutcome;
  const label = DESK_ROLE_WORDS[out.role].label;
  return { ok: true, message: out.changed ? `${out.name} is now ${label}.` : `${out.name} is already ${label}.` };
}

// ─── Remove ─────────────────────────────────────────────────────────────

export async function removeTeammate(userId: string): Promise<TeamActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(userId)) return { ok: false, error: "Bad request." };

  const r = await runOp(teamRemoveOp, session.value, { id: userId });
  if (!r.ok) return { ok: false, error: failure(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };

  const out = r.value.value as { name: string };
  return { ok: true, message: `${out.name} no longer has access to the desk.` };
}
