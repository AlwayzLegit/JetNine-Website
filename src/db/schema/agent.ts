import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { apiKeys } from "./api";
import { users } from "./users";

// ─── The desk assistant ──────────────────────────────────────────────────
// Mirrors src/db/migrations/0052_agent.sql. The assistant reads its
// playbook and memory through /api/v1/agent/context, logs each run and
// what it produced, and keeps short memory between runs. Owners manage all
// of it from Settings › Assistant.

export const JOB_CADENCES = ["daily", "weekdays", "weekly", "manual"] as const;
export type JobCadence = (typeof JOB_CADENCES)[number];

export type PlaybookJob = {
  slug: string;
  name: string;
  enabled: boolean;
  /** daily, weekdays, weekly (with `weekday` 0–6, Sunday = 0) or manual. */
  cadence: JobCadence;
  weekday?: number;
  instructionsMd: string;
};

export const agentPlaybooks = pgTable(
  "agent_playbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: integer("version").notNull().unique(),
    generalMd: text("general_md").notNull(),
    jobs: jsonb("jobs").$type<PlaybookJob[]>().notNull().default([]),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [check("agent_playbooks_version_check", sql`${t.version} >= 1`)],
);

export const RUN_STATUSES = ["open", "closed", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type RunJobReport = {
  slug: string;
  did: string;
  worked?: string;
  didnt?: string;
  next?: string;
  metrics?: Record<string, number | string>;
};

export type RunReport = { jobs: RunJobReport[]; errors: string[] };

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runDate: date("run_date").notNull(),
    status: text("status").$type<RunStatus>().notNull().default("open"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().default(sql`now()`),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    keyId: uuid("key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    playbookVersion: integer("playbook_version").notNull().default(0),
    summaryMd: text("summary_md"),
    report: jsonb("report").$type<RunReport | null>(),
    metrics: jsonb("metrics").$type<Record<string, number | string> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("agent_runs_date_idx").on(t.runDate.desc(), t.startedAt.desc()),
    uniqueIndex("agent_runs_one_open_per_key").on(t.keyId).where(sql`${t.status} = 'open' and ${t.keyId} is not null`),
    check("agent_runs_status_check", sql`${t.status} in ('open','closed','failed')`),
  ],
);

export const RUN_ITEM_KINDS = ["post", "flag", "draft", "note", "insight", "proposal"] as const;
export type RunItemKind = (typeof RUN_ITEM_KINDS)[number];
export const RUN_ITEM_STATUSES = ["open", "dismissed", "done"] as const;
export type RunItemStatus = (typeof RUN_ITEM_STATUSES)[number];

export const agentRunItems = pgTable(
  "agent_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RunItemKind>().notNull(),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    subjectCode: text("subject_code"),
    title: text("title").notNull(),
    bodyMd: text("body_md"),
    url: text("url"),
    status: text("status").$type<RunItemStatus>().notNull().default("open"),
    dismissedBy: uuid("dismissed_by").references(() => users.id, { onDelete: "set null" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("agent_run_items_run_idx").on(t.runId),
    index("agent_run_items_open_subject_idx").on(t.subjectType, t.subjectId).where(sql`${t.status} = 'open'`),
    check("agent_run_items_kind_check", sql`${t.kind} in ('post','flag','draft','note','insight','proposal')`),
    check("agent_run_items_title_check", sql`char_length(${t.title}) between 1 and 200`),
    check("agent_run_items_body_md_check", sql`${t.bodyMd} is null or char_length(${t.bodyMd}) <= 8000`),
    check("agent_run_items_url_check", sql`${t.url} is null or char_length(${t.url}) <= 600`),
    check("agent_run_items_status_check", sql`${t.status} in ('open','dismissed','done')`),
  ],
);

export const MEMORY_KINDS = ["fact", "lesson", "preference", "todo"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const agentMemory = pgTable(
  "agent_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<MemoryKind>().notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    author: text("author").$type<"agent" | "owner">().notNull(),
    sourceRunId: uuid("source_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("agent_memory_active_idx").on(t.pinned.desc(), t.updatedAt.desc()).where(sql`${t.archivedAt} is null`),
    check("agent_memory_kind_check", sql`${t.kind} in ('fact','lesson','preference','todo')`),
    check("agent_memory_body_check", sql`char_length(${t.body}) between 1 and 600`),
    check("agent_memory_author_check", sql`${t.author} in ('agent','owner')`),
  ],
);

export type AgentPlaybook = typeof agentPlaybooks.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentRunItem = typeof agentRunItems.$inferSelect;
export type AgentMemory = typeof agentMemory.$inferSelect;

/** Keep the cap in one place: the command refuses the 201st active memory. */
export const MEMORY_CAP = 200;
