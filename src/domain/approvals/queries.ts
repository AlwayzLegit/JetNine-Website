import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { approvals, type Approval, type ApprovalRisk, type ApprovalStatus } from "@/db/schema/approvals";
import { apiKeys } from "@/db/schema/api";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { personName } from "@/lib/desk-status";
import { isUuid } from "@/domain/common";

/** Reads for the "Needs your OK" tab, the detail pages and the assistant's feedback. */

export type ApprovalRow = Approval & {
  /** "Daily assistant" (the key) or the person who proposed it. */
  requestedByName: string | null;
  decidedByName: string | null;
};

const baseSelect = {
  approval: approvals,
  keyName: apiKeys.name,
  decFirst: users.firstName,
  decLast: users.lastName,
  decEmail: users.email,
  decDisplay: staff.displayName,
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

function joined() {
  return db
    .select(baseSelect)
    .from(approvals)
    .leftJoin(apiKeys, eq(apiKeys.id, approvals.requestedByKey))
    .leftJoin(users, eq(users.id, approvals.decidedBy))
    .leftJoin(staff, eq(staff.userId, approvals.decidedBy));
}

export async function listApprovals({
  status = ["pending"],
  limit = 50,
  keyId,
}: { status?: ApprovalStatus[]; limit?: number; keyId?: string } = {}): Promise<ApprovalRow[]> {
  const where = [inArray(approvals.status, status)];
  if (keyId) where.push(eq(approvals.requestedByKey, keyId));
  const rows = await joined()
    .where(and(...where))
    .orderBy(desc(approvals.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(shape);
}

export async function countPending(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"));
  return Number(row?.n ?? 0);
}

export async function getApproval(id: unknown): Promise<ApprovalRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await joined().where(eq(approvals.id, id)).limit(1);
  return row ? shape(row) : null;
}

export async function pendingForSubject(subjectType: string, subjectId: string): Promise<ApprovalRow[]> {
  if (!isUuid(subjectId)) return [];
  const rows = await joined()
    .where(and(eq(approvals.status, "pending"), eq(approvals.subjectType, subjectType), eq(approvals.subjectId, subjectId)))
    .orderBy(desc(approvals.createdAt));
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
  const rows = await db
    .select()
    .from(approvals)
    .where(and(inArray(approvals.status, ["executed", "failed", "rejected", "expired"]), gte(approvals.decidedAt, since)))
    .orderBy(desc(approvals.decidedAt))
    .limit(limit);
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
