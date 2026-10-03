import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { TEAM_APPROVABLE_RISKS, approvals, type Approval } from "@/db/schema/approvals";
import { apiKeys } from "@/db/schema/api";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { getOp } from "@/domain/ops";
import { revalidateQuietly } from "@/domain/ops/registry";
import { err, ok, type Result } from "@/domain/result";

/**
 * Deciding a proposal. Session only: a key can never approve, not even its
 * own. Approving claims the row atomically (pending → executing), merges
 * any edits onto the op's editable text fields, re-validates against the
 * current state, runs the op as the approver, and records the outcome.
 */

function canDecide(actor: Actor, a: Approval): Result<true> {
  if (actor.via !== "session" || !actor.userId) return err("forbidden", "Only a person on the desk can decide this.");
  const owner = actor.role === "admin" || actor.role === "superadmin";
  const team = actor.role === "dispatcher";
  if (!owner && !team) return err("forbidden", "This needs a desk account.");
  if (!owner && !TEAM_APPROVABLE_RISKS.has(a.risk)) return err("forbidden", "An owner has to decide this one.");
  return ok(true);
}

async function claim(id: string, actor: Actor | null, next: "executing" | "rejected" | "expired", note: string | null): Promise<Approval | null> {
  const [row] = await db
    .update(approvals)
    .set({ status: next, decidedBy: actor?.userId ?? null, decidedAt: new Date(), decisionNote: note })
    .where(and(eq(approvals.id, id), eq(approvals.status, "pending")))
    .returning();
  return row ?? null;
}

export async function approve(
  actor: Actor,
  id: unknown,
  opts: { edits?: Record<string, unknown>; note?: string } = {},
): Promise<Result<{ approval: Approval; result: unknown }>> {
  if (!isUuid(id)) return err("not_found", "No approval with that id.");
  const [existing] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
  if (!existing) return err("not_found", "No approval with that id.");
  if (existing.status !== "pending") return err("conflict", `This was already ${existing.status}.`);
  if (existing.expiresAt.getTime() <= Date.now()) {
    await claim(id, null, "expired", null);
    return err("conflict", "This proposal has expired.");
  }
  const allowed = canDecide(actor, existing);
  if (!allowed.ok) return allowed;

  const op = getOp(existing.op);
  if (!op) return err("unavailable", `The operation "${existing.op}" no longer exists.`);
  // Risk and permission are separate axes: approving never grants a permission the approver lacks.
  if (!actor.scopes.has(op.scope)) return err("forbidden", `This needs the "${op.scope}" permission.`);

  // Only whitelisted text fields may change; anything else is ignored.
  const edits: Record<string, unknown> = {};
  for (const k of op.editable ?? []) {
    const v = opts.edits?.[k];
    if (typeof v === "string" && v !== (existing.payload as Record<string, unknown>)[k]) edits[k] = v;
  }
  const payload = { ...existing.payload, ...edits };
  const parsed = op.schema.safeParse(payload);
  if (!parsed.success) return err("invalid", "The edited text is not valid.", parsed.error.issues);

  const claimed = await claim(id, actor, "executing", opts.note?.trim().slice(0, 1000) || null);
  if (!claimed) return err("conflict", "Someone else just decided this.");

  // Act as the approver, carrying the key's name so History reads "Alex (approving Daily assistant)".
  const [key] = claimed.requestedByKey
    ? await db.select({ id: apiKeys.id, name: apiKeys.name }).from(apiKeys).where(eq(apiKeys.id, claimed.requestedByKey)).limit(1)
    : [];
  const asApprover: Actor = {
    ...actor,
    via: "approval",
    approvalId: claimed.id,
    runId: claimed.runId ?? undefined,
    key: key ? { id: key.id, name: key.name, supervised: true } : undefined,
  };

  let outcome: Result<unknown>;
  try {
    const loaded = await op.load(parsed.data);
    outcome = loaded.ok ? await op.run(asApprover, parsed.data, loaded.value) : loaded;
    if (outcome.ok && loaded.ok) revalidateQuietly(op.revalidate?.(parsed.data, loaded.value) ?? []);
  } catch (e) {
    console.error(`[approvals] ${existing.op} threw`, e);
    outcome = err("internal", "Something went wrong while carrying this out.");
  }

  const [final] = await db
    .update(approvals)
    .set(
      outcome.ok
        ? { status: "executed", result: outcome.value ?? null, editedPayload: Object.keys(edits).length ? payload : null }
        : { status: "failed", error: outcome.error, editedPayload: Object.keys(edits).length ? payload : null },
    )
    .where(eq(approvals.id, id))
    .returning();

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: outcome.ok ? "approval.approve" : "approval.approve_failed",
    subjectType: "approval",
    subjectId: id,
    subjectCode: existing.subjectCode,
    metadata: {
      ...a.metadata,
      op: existing.op,
      risk: existing.risk,
      summary: existing.summary,
      keyName: key?.name ?? null,
      edited: Object.keys(edits),
      ...(outcome.ok ? {} : { error: outcome.error }),
    },
  });

  if (!outcome.ok) return err(outcome.code, `Approved, but it did not go through: ${outcome.error}`, outcome.details);
  return ok({ approval: final, result: outcome.value });
}

export async function reject(actor: Actor, id: unknown, note: string): Promise<Result<Approval>> {
  if (!isUuid(id)) return err("not_found", "No approval with that id.");
  const [existing] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
  if (!existing) return err("not_found", "No approval with that id.");
  if (existing.status !== "pending") return err("conflict", `This was already ${existing.status}.`);
  if (existing.expiresAt.getTime() <= Date.now()) {
    await claim(id, null, "expired", null);
    return err("conflict", "This proposal has expired.");
  }
  const allowed = canDecide(actor, existing);
  if (!allowed.ok) return allowed;

  const trimmed = note.trim().slice(0, 1000);
  const claimed = await claim(id, actor, "rejected", trimmed || null);
  if (!claimed) return err("conflict", "Someone else just decided this.");

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "approval.reject",
    subjectType: "approval",
    subjectId: id,
    subjectCode: existing.subjectCode,
    metadata: { ...a.metadata, op: existing.op, risk: existing.risk, summary: existing.summary, note: trimmed || null },
  });
  return ok(claimed);
}

/**
 * Pending proposals past their expiry become `expired`; a row left in
 * `executing` for over an hour (the process died mid-run) becomes `failed`
 * so it stops looking in flight. Maintenance cron.
 */
export async function expirePending(now = new Date()): Promise<number> {
  const rows = await db
    .update(approvals)
    .set({ status: "expired", decidedAt: now })
    .where(and(eq(approvals.status, "pending"), lt(approvals.expiresAt, now)))
    .returning({ id: approvals.id });
  const stuck = await db
    .update(approvals)
    .set({ status: "failed", error: "The desk lost track of this while carrying it out. Propose it again if it still matters." })
    .where(and(eq(approvals.status, "executing"), lt(approvals.decidedAt, new Date(now.getTime() - 60 * 60_000))))
    .returning({ id: approvals.id });
  return rows.length + stuck.length;
}
