import type { Approval, ApprovalRisk, ApprovalStatus } from "@/db/schema/approvals";
import { personName } from "@/lib/desk-status";
import { isUuid } from "@/domain/common";
import { approvalStore } from "./store";

/** Reads for the "Needs your OK" tab, the detail pages and the assistant's feedback. */

export type ApprovalRow = Approval & {
  /** "Daily assistant" (the key) or the person who proposed it. */
  requestedByName: string | null;
  decidedByName: string | null;
};

function shape(r: {
  approval: Approval;
  keyName: string | null;
  decFirst: string | null;
  decLast: string | null;
  decEmail: string | null;
  decDisplay: string | null;
}): ApprovalRow {
  return {
    ...r.approval,
    requestedByName: r.keyName ?? null,
    decidedByName: r.decEmail ? r.decDisplay?.trim() || personName(r.decFirst, r.decLast, r.decEmail.split("@")[0]) : null,
  };
}

export async function listApprovals({
  status = ["pending"],
  limit = 50,
  keyId,
}: { status?: ApprovalStatus[]; limit?: number; keyId?: string } = {}): Promise<ApprovalRow[]> {
  const rows = await approvalStore().listJoined(status, keyId, Math.min(Math.max(limit, 1), 200));
  return rows.map(shape);
}

export async function countPending(): Promise<number> {
  return approvalStore().countPending();
}

export async function getApproval(id: unknown): Promise<ApprovalRow | null> {
  if (!isUuid(id)) return null;
  const row = await approvalStore().getJoined(id);
  return row ? shape(row) : null;
}

export async function pendingForSubject(subjectType: string, subjectId: string): Promise<ApprovalRow[]> {
  if (!isUuid(subjectId)) return [];
  const rows = await approvalStore().pendingForSubject(subjectType, subjectId);
  return rows.map(shape);
}

export type Feedback = {
  approvalId: string;
  op: string;
  risk: ApprovalRisk;
  summary: string;
  status: ApprovalStatus;
  decisionNote: string | null;
  decidedAt: Date | null;
  edited: boolean;
  error: string | null;
};

/** What people decided about the assistant's proposals since `since` — the assistant learns from this. */
export async function decidedSince(since: Date, { limit = 40 }: { limit?: number } = {}): Promise<Feedback[]> {
  const rows = await approvalStore().decidedSince(since, limit);
  return rows.map((r) => ({
    approvalId: r.id,
    op: r.op,
    risk: r.risk,
    summary: r.summary,
    status: r.status,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    edited: r.editedPayload !== null && r.editedPayload !== undefined,
    error: r.error,
  }));
}
