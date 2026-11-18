import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { apiKeys } from "@/db/d1/schema/api";
import { approvals } from "@/db/d1/schema/approvals";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import type { Approval, ApprovalStatus } from "@/db/schema/approvals";
import type { ApprovalJoinedRow, ApprovalStore } from "./store";

// The D1 (SQLite) side of the approval store (OPS-150). Same methods and the same results as
// store-pg.ts, on the D1 twin table (src/db/d1/schema/approvals.ts, OPS-100). The client is
// passed in so a test can hand it a real SQLite.
//
// Differences from Postgres: ids are text made by newId() on insert, the timestamps are integer
// milliseconds that drizzle maps to Date, payload, edited_payload and result are JSON text that
// drizzle parses both ways, count(*) is already an integer (no ::int) and the 24 hour window is
// a Date computed by the caller, not now() - interval. "Decide once" is the same conditional
// update (set ... where id and status = 'pending' returning), which SQLite supports, and "one
// pending proposal per dedupe key" is the partial unique index approvals_pending_dedupe_uq.

type D1Client = DrizzleD1Database;

const STUCK_ERROR = "The desk lost track of this while carrying it out. Propose it again if it still matters.";

const asApproval = (r: unknown) => r as Approval;

const baseSelect = {
  approval: approvals,
  keyName: apiKeys.name,
  decFirst: users.firstName,
  decLast: users.lastName,
  decEmail: users.email,
  decDisplay: staff.displayName,
};

export function d1ApprovalStore(db: D1Client): ApprovalStore {
  const joined = () =>
    db
      .select(baseSelect)
      .from(approvals)
      .leftJoin(apiKeys, eq(apiKeys.id, approvals.requestedByKey))
      .leftJoin(users, eq(users.id, approvals.decidedBy))
      .leftJoin(staff, eq(staff.userId, approvals.decidedBy));

  const shape = (rows: unknown[]): ApprovalJoinedRow[] => rows as ApprovalJoinedRow[];

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
      return row ? asApproval(row) : undefined;
    },

    async countForRun(runId) {
      const [row] = await db.select({ n: count() }).from(approvals).where(eq(approvals.runId, runId));
      return row?.n ?? 0;
    },

    async countForKeySince(keyId, since) {
      const [row] = await db
        .select({ n: count() })
        .from(approvals)
        .where(and(eq(approvals.requestedByKey, keyId), gte(approvals.createdAt, since)));
      return row?.n ?? 0;
    },

    async insert(values) {
      const [row] = await db.insert(approvals).values(values).returning();
      return asApproval(row);
    },

    async getById(id) {
      const [row] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
      return row ? asApproval(row) : undefined;
    },

    async claim(id, decidedBy, next, note, now) {
      const [row] = await db
        .update(approvals)
        .set({ status: next, decidedBy, decidedAt: now, decisionNote: note })
        .where(and(eq(approvals.id, id), eq(approvals.status, "pending")))
        .returning();
      return row ? asApproval(row) : undefined;
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
      return row ? asApproval(row) : undefined;
    },

    async keyName(keyId) {
      const [row] = await db.select({ id: apiKeys.id, name: apiKeys.name }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
      return row;
    },

    async listJoined(statuses, keyId, limit) {
      const where = [inArray(approvals.status, statuses as ApprovalStatus[])];
      if (keyId) where.push(eq(approvals.requestedByKey, keyId));
      const rows = await joined()
        .where(and(...where))
        .orderBy(desc(approvals.createdAt))
        .limit(limit);
      return shape(rows);
    },

    async getJoined(id) {
      const rows = await joined().where(eq(approvals.id, id)).limit(1);
      return shape(rows)[0];
    },

    async pendingForSubject(subjectType, subjectId) {
      const rows = await joined()
        .where(and(eq(approvals.status, "pending"), eq(approvals.subjectType, subjectType), eq(approvals.subjectId, subjectId)))
        .orderBy(desc(approvals.createdAt));
      return shape(rows);
    },

    async countPending() {
      const [row] = await db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"));
      return row?.n ?? 0;
    },

    async decidedSince(since, limit) {
      const rows = await db
        .select()
        .from(approvals)
        .where(and(inArray(approvals.status, ["executed", "failed", "rejected", "expired"]), gte(approvals.decidedAt, since)))
        .orderBy(desc(approvals.decidedAt))
        .limit(limit);
      return rows.map(asApproval);
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
