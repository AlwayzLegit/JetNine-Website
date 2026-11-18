import { isUniqueViolation } from "@/db/unique";
import type { Approval, ApprovalRisk } from "@/db/schema/approvals";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import type { OpSubject } from "@/domain/ops/registry";
import { err, ok, type Result } from "@/domain/result";
import { approvalStore } from "./store";

/**
 * Putting a proposal on the queue. Kept apart from approve/reject so the
 * ops registry can import it without a module cycle.
 */

const MAX_PER_RUN = 25;
const MAX_PER_KEY_PER_DAY = 40;

export type QueueInput = {
  op: string;
  payload: Record<string, unknown>;
  summary: string;
  preview: string | null;
  reason: string | null;
  risk: ApprovalRisk;
  subject: OpSubject;
  dedupeKey: string;
  actor: Actor;
};

export async function queueApproval(q: QueueInput): Promise<Result<Approval>> {
  const keyId = q.actor.key && !q.actor.key.legacy ? q.actor.key.id : null;

  const store = approvalStore();
  const now = new Date();

  // A stale pending twin would block this proposal until the daily sweep:
  // expire it now so the key gets a fresh one and the tab shows the truth.
  await store.expireStaleTwin(q.dedupeKey, now);

  // Same proposal already waiting: hand it back instead of a duplicate.
  const existing = await store.pendingByDedupe(q.dedupeKey);
  if (existing) return ok(existing);

  if (q.actor.runId) {
    const n = await store.countForRun(q.actor.runId);
    if (n >= MAX_PER_RUN) return err("conflict", `A run may propose at most ${MAX_PER_RUN} things. Pick the ones that matter.`);
  }
  if (keyId) {
    const n = await store.countForKeySince(keyId, new Date(now.getTime() - 24 * 60 * 60_000));
    if (n >= MAX_PER_KEY_PER_DAY) return err("conflict", `This key has proposed ${MAX_PER_KEY_PER_DAY} things today; try again tomorrow.`);
  }

  let row: Approval;
  try {
    row = await store.insert({
      op: q.op,
      payload: q.payload,
      summary: q.summary,
      preview: q.preview,
      reason: q.reason,
      risk: q.risk,
      subjectType: q.subject.type,
      subjectId: q.subject.id,
      subjectCode: q.subject.code ?? null,
      dedupeKey: q.dedupeKey,
      requestedByKey: keyId,
      requestedByUser: q.actor.userId,
      runId: q.actor.runId ?? null,
    });
  } catch (e) {
    // Two proposals with the same key raced: the partial unique index let one in. Hand that one back.
    if (isUniqueViolation(e)) {
      const dupe = await store.pendingByDedupe(q.dedupeKey);
      if (dupe) return ok(dupe);
    }
    throw e;
  }

  const a = auditFields(q.actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "approval.request",
    subjectType: "approval",
    subjectId: row.id,
    subjectCode: row.subjectCode,
    metadata: { ...a.metadata, op: row.op, risk: row.risk, summary: row.summary, subject: q.subject },
  });
  return ok(row);
}
