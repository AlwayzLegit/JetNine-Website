import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agentRuns } from "./agent";
import { apiKeys } from "./api";
import { users } from "./users";

// ─── approvals ───────────────────────────────────────────────────────────
// Mirrors src/db/migrations/0053_approvals.sql. An operation a supervised
// key asked for, waiting for a person. See src/domain/ops/registry.ts
// (what gets queued) and src/domain/approvals (approve / reject / expire).

export const APPROVAL_RISKS = ["client", "money", "settings", "access", "content"] as const;
export type ApprovalRisk = (typeof APPROVAL_RISKS)[number];

export const APPROVAL_STATUSES = ["pending", "executing", "executed", "failed", "rejected", "expired"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Risks a Team member (dispatcher) may approve; the rest need an owner. */
export const TEAM_APPROVABLE_RISKS: ReadonlySet<ApprovalRisk> = new Set<ApprovalRisk>(["client", "content"]);

export const RISK_WORDS: Record<ApprovalRisk, string> = {
  client: "contacts a client",
  money: "moves money",
  settings: "changes settings",
  access: "changes who can do what",
  content: "changes public content",
};

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    op: text("op").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    editedPayload: jsonb("edited_payload").$type<Record<string, unknown> | null>(),
    summary: text("summary").notNull(),
    preview: text("preview"),
    reason: text("reason"),
    risk: text("risk").$type<ApprovalRisk>().notNull(),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    subjectCode: text("subject_code"),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    dedupeKey: text("dedupe_key").notNull(),
    requestedByKey: uuid("requested_by_key").references(() => apiKeys.id, { onDelete: "set null" }),
    requestedByUser: uuid("requested_by_user").references(() => users.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("approvals_status_created_idx").on(t.status, t.createdAt.desc()),
    index("approvals_pending_subject_idx").on(t.subjectType, t.subjectId).where(sql`${t.status} = 'pending'`),
    uniqueIndex("approvals_pending_dedupe_uq").on(t.dedupeKey).where(sql`${t.status} = 'pending'`),
    index("approvals_key_created_idx").on(t.requestedByKey, t.createdAt.desc()),
    check("approvals_summary_check", sql`char_length(${t.summary}) between 1 and 300`),
    check("approvals_reason_check", sql`${t.reason} is null or char_length(${t.reason}) <= 2000`),
    check("approvals_risk_check", sql`${t.risk} in ('client','money','settings','access','content')`),
    check("approvals_status_check", sql`${t.status} in ('pending','executing','executed','failed','rejected','expired')`),
    check("approvals_decision_note_check", sql`${t.decisionNote} is null or char_length(${t.decisionNote}) <= 1000`),
  ],
);

export type Approval = typeof approvals.$inferSelect;
