"use server";

import { sessionActor } from "@/domain/actor";
import type { AnyOp } from "@/domain/ops";
import { runOp } from "@/domain/ops/registry";
import { voiceRoutingOp } from "@/domain/settings/ops";
import { archiveAgentOp, createAgentOp, makeLiveOp, restoreVersionOp, saveAgentOp } from "@/domain/voice-agents/ops";

// Settings › Voice agent. The work is the settings.voiceRouting op
// (src/domain/settings), shared with the approval queue; runOp checks the
// `settings` permission (owners) and revalidates the page.

export type VoiceActionResult = { ok: true; changed: boolean } | { ok: false; error: string };

export async function saveVoiceRouting(formData: FormData): Promise<VoiceActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const numbers = formData
    .getAll("number")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const r = await runOp(voiceRoutingOp, session.value, {
    ringFirst: formData.get("ringFirst") === "on",
    numbers,
    rings: Number(formData.get("rings")),
    schedule: "always",
    screen: formData.get("screen") === "on",
  });
  if (!r.ok) {
    // The schema's messages are whole sentences ("Add a number to ring first…").
    const first = (r.details as { message?: string }[] | undefined)?.[0]?.message;
    return { ok: false, error: r.code === "invalid" && first ? first : r.error };
  }
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, changed: (r.value.value as { changed: boolean }).changed };
}

// ─── Agents ─────────────────────────────────────────────────────────────

export type AgentActionResult = { ok: true; id?: string; changed?: boolean } | { ok: false; error: string };

function failure(r: { code: string; error: string; details?: unknown }): AgentActionResult {
  const first = (r.details as { message?: string; path?: PropertyKey[] }[] | undefined)?.[0];
  if (r.code === "invalid" && first?.message) {
    const where = first.path?.filter((p): p is string => typeof p === "string").slice(-1)[0];
    return { ok: false, error: where ? `${where.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${first.message}` : first.message };
  }
  return { ok: false, error: r.error };
}

async function runAgentOp(op: AnyOp, input: unknown): Promise<AgentActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const r = await runOp(op, session.value, input);
  if (!r.ok) return failure(r);
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  const v = r.value.value as { id?: string; changed?: boolean };
  return { ok: true, id: v.id, changed: v.changed };
}

export async function createVoiceAgent(input: { name: string; fromAgentId?: string }): Promise<AgentActionResult> {
  return runAgentOp(createAgentOp, { name: input.name, fromAgentId: input.fromAgentId || undefined });
}

export async function saveVoiceAgent(input: { id: string; name: string; description?: string; config: unknown; note?: string }): Promise<AgentActionResult> {
  return runAgentOp(saveAgentOp, input);
}

export async function makeVoiceAgentLive(id: string): Promise<AgentActionResult> {
  return runAgentOp(makeLiveOp, { id });
}

export async function archiveVoiceAgent(id: string, archived: boolean): Promise<AgentActionResult> {
  return runAgentOp(archiveAgentOp, { id, archived });
}

export async function restoreVoiceAgentVersion(id: string, version: number): Promise<AgentActionResult> {
  return runAgentOp(restoreVersionOp, { id, version });
}
