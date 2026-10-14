import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { voiceAgents, voiceAgentVersions } from "@/db/schema/voice-agents";
import { logAudit } from "@/lib/audit";
import { DEFAULT_AGENT_CONFIG, configWords, type VoiceAgentConfig } from "@/lib/voice-agent-config";
import { auditFields, type Actor } from "@/domain/actor";
import { err, ok, type Result } from "@/domain/result";
import { getAgent, getVersion, type AgentDetail } from "./queries";
import type { AgentIdInput, ArchiveAgentInput, CreateAgentInput, RestoreVersionInput, SaveAgentInput } from "./schemas";

/**
 * Voice-agent commands, shared by the admin's Server Actions and the
 * approval queue through ./ops.ts. Every save writes a new row to
 * voice_agent_versions; History gets one sentence per change.
 */

export type AgentState = { agent: AgentDetail };

async function audit(actor: Actor, action: string, agentId: string, diff: Record<string, unknown> | null = null) {
  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action,
    subjectType: "system",
    subjectId: agentId,
    subjectCode: "voice_agent",
    diff,
    metadata: a.metadata,
  });
}

function unavailable(e: unknown, what: string) {
  console.error(`[voice-agents] ${what} failed`, e);
  return err("unavailable", `The agent could not be ${what}. If this keeps happening, apply migration 0054_voice_agents.sql.`);
}

export async function loadAgent(input: { id: string }): Promise<Result<AgentState>> {
  try {
    const agent = await getAgent(input.id);
    return agent ? ok({ agent }) : err("not_found", "That agent doesn't exist.");
  } catch (e) {
    return unavailable(e, "loaded");
  }
}

export type CreateState = { source: VoiceAgentConfig; sourceName: string | null };

export async function loadCreate(input: CreateAgentInput): Promise<Result<CreateState>> {
  if (!input.fromAgentId) return ok({ source: structuredClone(DEFAULT_AGENT_CONFIG), sourceName: null });
  const r = await loadAgent({ id: input.fromAgentId });
  return r.ok ? ok({ source: r.value.agent.config, sourceName: r.value.agent.name }) : r;
}

export async function createAgent(actor: Actor, input: CreateAgentInput, state: CreateState): Promise<Result<{ id: string }>> {
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(voiceAgents)
        .values({
          name: input.name,
          description: input.description || null,
          config: state.source,
          version: 1,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning({ id: voiceAgents.id });
      await tx.insert(voiceAgentVersions).values({
        agentId: row.id,
        version: 1,
        config: state.source,
        note: state.sourceName ? `Copied from ${state.sourceName}` : "Created from the defaults",
        createdBy: actor.userId,
      });
      return row.id;
    });
    await audit(actor, "system.voice_agent.create", id, { name: { after: input.name } });
    return ok({ id });
  } catch (e) {
    return unavailable(e, "created");
  }
}

export async function saveAgent(actor: Actor, input: SaveAgentInput, state: AgentState): Promise<Result<{ version: number; changed: boolean }>> {
  const before = state.agent;
  const same =
    before.name === input.name &&
    (before.description ?? "") === (input.description ?? "") &&
    JSON.stringify(before.config) === JSON.stringify(input.config);
  if (same) return ok({ version: before.version, changed: false });
  if (before.archived) return err("conflict", "Restore this agent before editing it.");

  const version = before.version + 1;
  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      // Optimistic: another save in between bumps the version and this one fails cleanly.
      const updated = await tx
        .update(voiceAgents)
        .set({ name: input.name, description: input.description || null, config: input.config, version, updatedBy: actor.userId, updatedAt: now })
        .where(and(eq(voiceAgents.id, before.id), eq(voiceAgents.version, before.version)))
        .returning({ id: voiceAgents.id });
      if (updated.length === 0) throw new Error("version-conflict");
      await tx.insert(voiceAgentVersions).values({ agentId: before.id, version, config: input.config, note: input.note || null, createdBy: actor.userId });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "version-conflict") {
      return err("conflict", "Someone else saved this agent just now. Reload to see their changes.");
    }
    return unavailable(e, "saved");
  }
  await audit(actor, "system.voice_agent.update", before.id, {
    version: { before: before.version, after: version },
    settings: { before: configWords(before.config), after: configWords(input.config) },
    ...(input.note ? { note: input.note } : {}),
  });
  return ok({ version, changed: true });
}

export async function makeLive(actor: Actor, _input: AgentIdInput, state: AgentState): Promise<Result<{ changed: boolean }>> {
  const a = state.agent;
  if (a.archived) return err("conflict", "Restore this agent before making it live.");
  if (a.isLive) return ok({ changed: false });
  try {
    await db.transaction(async (tx) => {
      await tx.update(voiceAgents).set({ isLive: false, updatedAt: new Date() }).where(and(eq(voiceAgents.isLive, true), ne(voiceAgents.id, a.id)));
      await tx.update(voiceAgents).set({ isLive: true, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(voiceAgents.id, a.id));
    });
  } catch (e) {
    return unavailable(e, "made live");
  }
  await audit(actor, "system.voice_agent.live", a.id, { name: { after: a.name } });
  return ok({ changed: true });
}

export async function setArchived(actor: Actor, input: ArchiveAgentInput, state: AgentState): Promise<Result<{ changed: boolean }>> {
  const a = state.agent;
  if (input.archived && a.isLive) return err("conflict", "Make another agent live before archiving this one.");
  if (a.archived === input.archived) return ok({ changed: false });
  try {
    await db
      .update(voiceAgents)
      .set({ archivedAt: input.archived ? sql`now()` : null, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(voiceAgents.id, a.id));
  } catch (e) {
    return unavailable(e, input.archived ? "archived" : "restored");
  }
  await audit(actor, input.archived ? "system.voice_agent.archive" : "system.voice_agent.unarchive", a.id, { name: { after: a.name } });
  return ok({ changed: true });
}

export async function restoreVersion(actor: Actor, input: RestoreVersionInput, state: AgentState): Promise<Result<{ version: number; changed: boolean }>> {
  const config = await getVersion(input.id, input.version);
  if (!config) return err("not_found", `Version ${input.version} doesn't exist.`);
  return saveAgent(
    actor,
    { id: input.id, name: state.agent.name, description: state.agent.description ?? undefined, config, note: `Restored version ${input.version}` },
    state,
  );
}
