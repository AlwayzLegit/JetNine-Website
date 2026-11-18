import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { approvals, type ApprovalStatus } from "@/db/schema/approvals";
import { apiKeys } from "@/db/schema/api";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import type { ApprovalStore } from "./store";

// The Postgres side of the approval store (OPS-150): the queries that lived in queue.ts,
// commands.ts and queries.ts, moved as they were. Postgres behaviour is unchanged.

const baseSelect = {
  approval: approvals,
  keyName: apiKeys.name,
  decFirst: users.firstName,
  decLast: users.lastName,
  decEmail: users.email,
  decDisplay: staff.displayName,
};

function joined() {
  return db
    .select(baseSelect)
    .from(approvals)
    .leftJoin(apiKeys, eq(apiKeys.id, approvals.requestedByKey))
    .leftJoin(users, eq(users.id, approvals.decidedBy))
    .leftJoin(staff, eq(staff.userId, approvals.decidedBy));
}

const STUCK_ERROR = "The desk lost track of this while carrying it out. Propose it again if it still matters.";

export function pgApprovalStore(): ApprovalStore {
  return {
    async expireStaleTwin(dedupeKey, now) {
      await db
        .update(approvals)
        .set({ status: "expired", decidedAt: now })
        .where(and(eq(approvals.dedupeKey, dedupeKey), eq(approvals.status, "pending"), lt(approvals.expiresAt, now)));
    },

    async pendingByDedupe(dedupeKey) {
      const [row] = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.dedupeKey, dedupeKey), eq(approvals.status, "pending")))
        .limit(1);
      return row;
    },

    async countForRun(runId) {
      const [row] = await db.select({ n: count() }).from(approvals).where(eq(approvals.runId, runId));
      return Number(row?.n ?? 0);
    },

    async countForKeySince(keyId, since) {
      const [row] = await db
        .select({ n: count() })
        .from(approvals)
        .where(and(eq(approvals.requestedByKey, keyId), gte(approvals.createdAt, since)));
      return Number(row?.n ?? 0);
    },

    async insert(values) {
      const [row] = await db.insert(approvals).values(values).returning();
      return row;
    },

    async getById(id) {
      const [row] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
      return row;
    },

    async claim(id, decidedBy, next, note, now) {
      const [row] = await db
        .update(approvals)
        .set({ status: next, decidedBy, decidedAt: now, decisionNote: note })
        .where(and(eq(approvals.id, id), eq(approvals.status, "pending")))
        .returning();
      return row;
    },

    async finish(id, patch) {
      const [row] = await db
        .update(approvals)
        .set(
          patch.status === "executed"
            ? { status: "executed", result: patch.result ?? null, editedPayload: patch.editedPayload }
            : { status: "failed", error: patch.error, editedPayload: patch.editedPayload },
        )
        .where(eq(approvals.id, id))
        .returning();
      return row;
    },

    async keyName(keyId) {
      const [row] = await db.select({ id: apiKeys.id, name: apiKeys.name }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
      return row;
    },

    async listJoined(statuses, keyId, limit) {
      const where = [inArray(approvals.status, statuses as ApprovalStatus[])];
      if (keyId) where.push(eq(approvals.requestedByKey, keyId));
      return joined()
        .where(and(...where))
        .orderBy(desc(approvals.createdAt))
        .limit(limit);
    },

    async getJoined(id) {
      const [row] = await joined().where(eq(approvals.id, id)).limit(1);
      return row;
    },

    async pendingForSubject(subjectType, subjectId) {
      return joined()
        .where(and(eq(approvals.status, "pending"), eq(approvals.subjectType, subjectType), eq(approvals.subjectId, subjectId)))
        .orderBy(desc(approvals.createdAt));
    },

    async countPending() {
      const [row] = await db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"));
      return Number(row?.n ?? 0);
    },

    async decidedSince(since, limit) {
      return db
        .select()
        .from(approvals)
        .where(and(inArray(approvals.status, ["executed", "failed", "rejected", "expired"]), gte(approvals.decidedAt, since)))
        .orderBy(desc(approvals.decidedAt))
        .limit(limit);
    },

    async expirePending(now) {
      const rows = await db
        .update(approvals)
        .set({ status: "expired", decidedAt: now })
        .where(and(eq(approvals.status, "pending"), lt(approvals.expiresAt, now)))
        .returning({ id: approvals.id });
      const stuck = await db
        .update(approvals)
        .set({ status: "failed", error: STUCK_ERROR })
        .where(and(eq(approvals.status, "executing"), lt(approvals.decidedAt, new Date(now.getTime() - 60 * 60_000))))
        .returning({ id: approvals.id });
      return rows.length + stuck.length;
    },
  };
}
