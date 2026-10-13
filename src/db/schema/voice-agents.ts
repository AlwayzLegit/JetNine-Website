import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── voice_agents / voice_agent_versions (migration 0054) ─────────────────
// Settings › Voice agent › Agents. `config` is a VoiceAgentConfig document
// (src/lib/voice-agent-config.ts). One agent is live at a time; the Render
// voice service reads it with the service role, hence RLS with no policies.

export const voiceAgents = pgTable(
  "voice_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    config: jsonb("config").$type<unknown>().notNull(),
    version: integer("version").notNull().default(1),
    isLive: boolean("is_live").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("voice_agents_one_live_idx").on(t.isLive).where(sql`${t.isLive}`)],
);

export const voiceAgentVersions = pgTable(
  "voice_agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => voiceAgents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    config: jsonb("config").$type<unknown>().notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("voice_agent_versions_agent_id_version_key").on(t.agentId, t.version)],
);

export type VoiceAgentRow = typeof voiceAgents.$inferSelect;
export type VoiceAgentVersionRow = typeof voiceAgentVersions.$inferSelect;
