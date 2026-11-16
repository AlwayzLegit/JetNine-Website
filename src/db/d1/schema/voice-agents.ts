// D1 (SQLite) twin of src/db/schema/voice-agents.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";
import { newId } from "../helpers";
import { users } from "./users";

// ─── voice_agents / voice_agent_versions (migration 0054) ─────────────────
// Settings › Voice agent › Agents. `config` is a VoiceAgentConfig document
// (src/lib/voice-agent-config.ts). One agent is live at a time; the Render
// voice service reads it with the service role, hence RLS with no policies.

export const voiceAgents = sqliteTable(
  "voice_agents",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    description: text("description"),
    config: text("config", { mode: "json" }).$type<unknown>().notNull(),
    version: integer("version").notNull().default(1),
    isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("voice_agents_one_live_idx").on(t.isLive).where(sql`${t.isLive}`)]);

export const voiceAgentVersions = sqliteTable(
  "voice_agent_versions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    agentId: text("agent_id")
      .notNull()
      .references(() => voiceAgents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    config: text("config", { mode: "json" }).$type<unknown>().notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  },
  (t) => [unique("voice_agent_versions_agent_id_version_key").on(t.agentId, t.version)]);

