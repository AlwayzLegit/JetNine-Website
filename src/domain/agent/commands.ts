import type { z } from "zod";
import { MEMORY_CAP, type AgentMemory, type AgentRun, type AgentRunItem } from "@/db/schema/agent";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import { currentPlaybook, dayKeyLA, openRunForKey } from "./queries";
import { agentStore } from "./store";
import type { CloseRun, FailRun, MemoryInput, MemoryPatch, OpenRun, PlaybookInput, RunItemInput } from "./schemas";

/**
 * What the assistant (an `agent` key) and owners may change. Every write
 * is audited with the key and run ids. The approval queue arrives in the
 * next phase; until then "proposal" items are the assistant's way to ask.
 * The queries are in the agent store (store.ts, OPS-142), Postgres or D1 by dbTarget().
 */

const STALE_RUN_HOURS = 24;
const MAX_ITEMS_PER_RUN = 100;
const MAX_MEMORY_PER_RUN = 5;

function isOwner(actor: Actor): boolean {
  return actor.via === "session" && (actor.role === "admin" || actor.role === "superadmin");
}

function canUseRun(actor: Actor, run: AgentRun): boolean {
  if (actor.via === "session") return true; // a staff session may close or annotate any run
  return Boolean(actor.key && run.keyId === actor.key.id);
}

// ─── Runs ────────────────────────────────────────────────────────────────

export async function openRun(actor: Actor, input: z.infer<typeof OpenRun>): Promise<Result<AgentRun>> {
  const keyId = actor.key && !actor.key.legacy ? actor.key.id : null;
  const now = new Date();

  if (keyId) {
    const open = await openRunForKey(keyId);
    if (open) {
      const ageHours = (now.getTime() - open.startedAt.getTime()) / 3_600_000;
      if (ageHours < STALE_RUN_HOURS) {
        return err("conflict", "This key already has an open run. Close it first, or keep using it.", { runId: open.id });
      }
      // A run left open for a day was never closed: mark it failed and move on.
      await agentStore().failRunLeftOpen(open.id, now, open.summaryMd ?? "Left open; closed automatically when the next run started.");
    }
  }

  const playbook = await currentPlaybook();
  // A key always runs "today"; only a person may backfill a date.
  const runDate = actor.via === "session" && input.runDate ? input.runDate : dayKeyLA(now);
  const inserted = await agentStore().insertRun({ runDate, keyId, playbookVersion: playbook.version });
  if (inserted.conflict) {
    // Two opens raced past the check above; the partial unique index won.
    const open = keyId ? await openRunForKey(keyId) : null;
    return err("conflict", "This key already has an open run.", open ? { runId: open.id } : undefined);
  }
  const run: AgentRun = inserted.run;

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "agent_run.open",
    subjectType: "agent_run",
    subjectId: run.id,
    subjectCode: run.runDate,
    metadata: { ...a.metadata, playbookVersion: run.playbookVersion },
  });
  return ok(run);
}

async function loadRun(id: unknown): Promise<AgentRun | null> {
  if (!isUuid(id)) return null;
  return (await agentStore().getRun(id)) ?? null;
}

export async function closeRun(actor: Actor, id: unknown, input: z.infer<typeof CloseRun>): Promise<Result<AgentRun>> {
  const run = await loadRun(id);
  if (!run) return err("not_found", "No run with that id.");
  if (!canUseRun(actor, run)) return err("forbidden", "That run belongs to another key.");
  if (run.status !== "open") return err("conflict", `This run is already ${run.status}.`);

  const updated = await agentStore().closeRun(run.id, {
    closedAt: new Date(),
    summaryMd: input.summaryMd,
    report: input.report,
    metrics: input.metrics ?? null,
  });

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "agent_run.close",
    subjectType: "agent_run",
    subjectId: run.id,
    subjectCode: run.runDate,
    metadata: { ...a.metadata, jobs: input.report.jobs.map((j) => j.slug), errors: input.report.errors.length },
  });
  return ok(updated);
}

export async function failRun(actor: Actor, id: unknown, input: z.infer<typeof FailRun>): Promise<Result<AgentRun>> {
  const run = await loadRun(id);
  if (!run) return err("not_found", "No run with that id.");
  if (!canUseRun(actor, run)) return err("forbidden", "That run belongs to another key.");
  if (run.status !== "open") return err("conflict", `This run is already ${run.status}.`);

  const updated = await agentStore().failRun(run.id, {
    closedAt: new Date(),
    summaryMd: input.reason,
    report: { jobs: [], errors: [input.reason] },
  });

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "agent_run.fail",
    subjectType: "agent_run",
    subjectId: run.id,
    subjectCode: run.runDate,
    metadata: { ...a.metadata, reason: input.reason.slice(0, 300) },
  });
  return ok(updated);
}

// ─── Run items ───────────────────────────────────────────────────────────

export async function addRunItem(actor: Actor, runId: unknown, input: z.infer<typeof RunItemInput>): Promise<Result<AgentRunItem>> {
  const run = await loadRun(runId);
  if (!run) return err("not_found", "No run with that id.");
  if (!canUseRun(actor, run)) return err("forbidden", "That run belongs to another key.");
  if (run.status !== "open") return err("conflict", "This run is closed; open a new one.");
  if ((input.subjectId && !input.subjectType) || (input.subjectType && !input.subjectId && !input.subjectCode)) {
    return err("invalid", "A subject needs both a type and an id (or code).");
  }

  // The caps and the one-open-flag rule are checked and the row written as one step
  // (a lock on Postgres, one conditional statement on D1), so parallel calls can't pass them.
  const added = await agentStore().addItemGuarded(run.id, input, MAX_ITEMS_PER_RUN);
  if (added.ok) return ok(added.item);
  if (added.reason === "cap") return err("conflict", `A run holds at most ${MAX_ITEMS_PER_RUN} items.`);
  return err("conflict", "That subject already has an open flag.", { itemId: added.itemId });
}

/** Owners and team dismiss flags and drafts from the request/trip pages. Session only. */
export async function dismissItem(actor: Actor, id: unknown): Promise<Result<AgentRunItem>> {
  if (actor.via !== "session" || !actor.userId) return err("forbidden", "Only a person on the desk can dismiss an item.");
  if (!isUuid(id)) return err("not_found", "No item with that id.");
  const item = await agentStore().dismissItem(id, actor.userId, new Date());
  if (!item) return err("not_found", "That item is no longer open.");
  return ok(item);
}

// ─── Memory ──────────────────────────────────────────────────────────────

export async function addMemory(actor: Actor, input: z.infer<typeof MemoryInput>): Promise<Result<AgentMemory>> {
  const author = actor.via === "session" ? "owner" : "agent";
  if (author === "owner" && !isOwner(actor)) return err("forbidden", "Only an owner edits the assistant's memory.");

  if (author === "agent") {
    if (!actor.runId) return err("invalid", "Send the X-Agent-Run header: memory is written during a run.");
    const run = await loadRun(actor.runId);
    if (!run || !canUseRun(actor, run) || run.status !== "open") return err("conflict", "That run is not open for this key.");
  }

  // Both caps are checked and the row written as one step.
  const added = await agentStore().addMemoryGuarded(
    {
      kind: input.kind,
      body: input.body.trim(),
      pinned: author === "owner" ? Boolean(input.pinned) : false,
      author,
      sourceRunId: author === "agent" ? (actor.runId ?? null) : null,
      createdBy: actor.userId,
    },
    MEMORY_CAP,
    author === "agent" ? { runId: actor.runId!, max: MAX_MEMORY_PER_RUN } : null,
  );
  if (!added.ok) {
    return err(
      "conflict",
      added.reason === "full" ? `Memory is full (${MEMORY_CAP} items). Archive something first.` : `At most ${MAX_MEMORY_PER_RUN} memory items per run. Make them count.`,
    );
  }
  const row = added.row;

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "agent_memory.add",
    subjectType: "agent_memory",
    subjectId: row.id,
    metadata: { ...a.metadata, kind: row.kind, author },
  });
  return ok(row);
}

export async function updateMemory(actor: Actor, id: unknown, patch: z.infer<typeof MemoryPatch>): Promise<Result<AgentMemory>> {
  if (!isUuid(id)) return err("not_found", "No memory item with that id.");
  const existing = await agentStore().getMemory(id);
  if (!existing) return err("not_found", "No memory item with that id.");

  const owner = isOwner(actor);
  if (!owner) {
    // The assistant may edit or archive only what it wrote, never a pinned
    // item (an owner pinned it on purpose), and only during an open run.
    if (existing.author !== "agent") return err("forbidden", "Only an owner changes that item.");
    if (existing.pinned) return err("forbidden", "An owner pinned that item; only an owner changes it.");
    if (patch.pinned !== undefined) return err("forbidden", "Only an owner pins memory.");
    if (!actor.runId) return err("invalid", "Send the X-Agent-Run header: memory is changed during a run.");
    const run = await loadRun(actor.runId);
    if (!run || !canUseRun(actor, run) || run.status !== "open") return err("conflict", "That run is not open for this key.");
  }

  const row = await agentStore().updateMemory(
    id,
    { body: patch.body !== undefined ? patch.body.trim() : undefined, pinned: patch.pinned, archived: patch.archived },
    new Date(),
  );

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: patch.archived ? "agent_memory.archive" : "agent_memory.update",
    subjectType: "agent_memory",
    subjectId: row.id,
    metadata: { ...a.metadata, fields: Object.keys(patch) },
  });
  return ok(row);
}

// ─── Playbook (owners, session only; the assistant proposes through approvals later) ──

export async function savePlaybook(actor: Actor, input: z.infer<typeof PlaybookInput>): Promise<Result<{ version: number }>> {
  if (!isOwner(actor) || !actor.userId) return err("forbidden", "Only an owner changes the assistant's instructions.");
  const slugs = new Set<string>();
  for (const j of input.jobs) {
    if (slugs.has(j.slug)) return err("invalid", `Two jobs share the slug "${j.slug}".`);
    slugs.add(j.slug);
    if (j.cadence === "weekly" && j.weekday === undefined) return err("invalid", `Job "${j.slug}" is weekly but has no weekday.`);
  }

  const version = await agentStore().savePlaybookNextVersion({
    generalMd: input.generalMd,
    jobs: input.jobs.map((j) => ({ ...j, weekday: j.cadence === "weekly" ? j.weekday : undefined })),
    note: input.note ?? null,
    createdBy: actor.userId,
  });

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "agent_playbook.save",
    subjectType: "agent_playbook",
    subjectCode: String(version),
    metadata: { ...a.metadata, jobs: input.jobs.map((j) => `${j.slug}${j.enabled ? "" : " (off)"}`), note: input.note ?? null },
  });
  return ok({ version });
}

/** Runs left open for a day with no close call (for the maintenance cron). */
export async function failStaleRuns(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_RUN_HOURS * 3_600_000);
  return agentStore().failStaleRuns(cutoff, now);
}
