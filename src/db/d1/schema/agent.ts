// D1 (SQLite) twin of src/db/schema/agent.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { desc, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { PlaybookJob, RunStatus, RunReport, RunItemKind, RunItemStatus, MemoryKind } from "../../schema/agent";
import { newId, nowDate } from "../helpers";
import { apiKeys } from "./api";
import { users } from "./users";

// ─── The desk assistant ──────────────────────────────────────────────────
// Mirrors src/db/migrations/0052_agent.sql. The assistant reads its
// playbook and memory through /api/v1/agent/context, logs each run and
// what it produced, and keeps short memory between runs. Owners manage all
// of it from Settings › Assistant.

export const agentPlaybooks = sqliteTable(
  "agent_playbooks",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    version: integer("version").notNull().unique(),
    generalMd: text("general_md").notNull(),
    jobs: text("jobs", { mode: "json" }).$type<PlaybookJob[]>().notNull().default([]),
    note: text("note"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [check("agent_playbooks_version_check", sql`${t.version} >= 1`)]);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    runDate: text("run_date").notNull(),
    status: text("status").$type<RunStatus>().notNull().default("open"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    keyId: text("key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    playbookVersion: integer("playbook_version").notNull().default(0),
    summaryMd: text("summary_md"),
    report: text("report", { mode: "json" }).$type<RunReport | null>(),
    metrics: text("metrics", { mode: "json" }).$type<Record<string, number | string> | null>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [
    index("agent_runs_date_idx").on(desc(t.runDate), desc(t.startedAt)),
    uniqueIndex("agent_runs_one_open_per_key").on(t.keyId).where(sql`${t.status} = 'open' and ${t.keyId} is not null`),
    check("agent_runs_status_check", sql`${t.status} in ('open','closed','failed')`),
  ]);


export const agentRunItems = sqliteTable(
  "agent_run_items",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RunItemKind>().notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    subjectCode: text("subject_code"),
    title: text("title").notNull(),
    bodyMd: text("body_md"),
    url: text("url"),
    status: text("status").$type<RunItemStatus>().notNull().default("open"),
    dismissedBy: text("dismissed_by").references(() => users.id, { onDelete: "set null" }),
    dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [
    index("agent_run_items_run_idx").on(t.runId),
    index("agent_run_items_open_subject_idx").on(t.subjectType, t.subjectId).where(sql`${t.status} = 'open'`),
    check("agent_run_items_kind_check", sql`${t.kind} in ('post','flag','draft','note','insight','proposal')`),
    check("agent_run_items_title_check", sql`length(${t.title}) between 1 and 200`),
    check("agent_run_items_body_md_check", sql`${t.bodyMd} is null or length(${t.bodyMd}) <= 8000`),
    check("agent_run_items_url_check", sql`${t.url} is null or length(${t.url}) <= 600`),
    check("agent_run_items_status_check", sql`${t.status} in ('open','dismissed','done')`),
  ]);


export const agentMemory = sqliteTable(
  "agent_memory",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    kind: text("kind").$type<MemoryKind>().notNull(),
    body: text("body").notNull(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    author: text("author").$type<"agent" | "owner">().notNull(),
    sourceRunId: text("source_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [
    index("agent_memory_active_idx").on(desc(t.pinned), desc(t.updatedAt)).where(sql`${t.archivedAt} is null`),
    check("agent_memory_kind_check", sql`${t.kind} in ('fact','lesson','preference','todo')`),
    check("agent_memory_body_check", sql`length(${t.body}) between 1 and 600`),
    check("agent_memory_author_check", sql`${t.author} in ('agent','owner')`),
  ]);


