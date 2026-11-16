// D1 (SQLite) twin of src/db/schema/approvals.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { desc, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ApprovalRisk, ApprovalStatus } from "../../schema/approvals";
import { inFuture, newId, nowDate } from "../helpers";
import { agentRuns } from "./agent";
import { apiKeys } from "./api";
import { users } from "./users";

// ─── approvals ───────────────────────────────────────────────────────────
// Mirrors src/db/migrations/0053_approvals.sql. An operation a supervised
// key asked for, waiting for a person. See src/domain/ops/registry.ts
// (what gets queued) and src/domain/approvals (approve / reject / expire).

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    op: text("op").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    editedPayload: text("edited_payload", { mode: "json" }).$type<Record<string, unknown> | null>(),
    summary: text("summary").notNull(),
    preview: text("preview"),
    reason: text("reason"),
    risk: text("risk").$type<ApprovalRisk>().notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    subjectCode: text("subject_code"),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    dedupeKey: text("dedupe_key").notNull(),
    requestedByKey: text("requested_by_key").references(() => apiKeys.id, { onDelete: "set null" }),
    requestedByUser: text("requested_by_user").references(() => users.id, { onDelete: "set null" }),
    runId: text("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    decidedBy: text("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note"),
    result: text("result", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => inFuture(7 * 24 * 60 * 60 * 1000)),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [
    index("approvals_status_created_idx").on(t.status, desc(t.createdAt)),
    index("approvals_pending_subject_idx").on(t.subjectType, t.subjectId).where(sql`${t.status} = 'pending'`),
    uniqueIndex("approvals_pending_dedupe_uq").on(t.dedupeKey).where(sql`${t.status} = 'pending'`),
    index("approvals_key_created_idx").on(t.requestedByKey, desc(t.createdAt)),
    check("approvals_summary_check", sql`length(${t.summary}) between 1 and 300`),
    check("approvals_reason_check", sql`${t.reason} is null or length(${t.reason}) <= 2000`),
    check("approvals_risk_check", sql`${t.risk} in ('client','money','settings','access','content')`),
    check("approvals_status_check", sql`${t.status} in ('pending','executing','executed','failed','rejected','expired')`),
    check("approvals_decision_note_check", sql`${t.decisionNote} is null or length(${t.decisionNote}) <= 1000`),
  ]);

