// D1 (SQLite) twin of src/db/schema/ai.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AiProviderKind, AiPurpose } from "../../schema/ai";
import { newId } from "../helpers";
import { users } from "./users";

// ─── ai_providers / ai_routes ────────────────────────────────────────────
// Which LLM vendors the business has keys for, and which one each AI
// surface uses. Keys are stored sealed (AES-256-GCM, src/lib/secretbox.ts)
// so a database read alone never yields a usable key; last4 is kept in the
// clear for the admin screen. One row per provider.
//
// Readers: the admin settings page (site, Drizzle) and the Render voice
// service (Supabase service role), which is why the tables carry no RLS
// policies — like the voice_* tables, only the service connection sees
// them.

export const aiProviders = sqliteTable("ai_providers", {
  id: text("id").primaryKey().$defaultFn(newId),
  provider: text("provider").$type<AiProviderKind>().notNull().unique(),
  label: text("label").notNull(),
  apiKeyEnc: text("api_key_enc").notNull(),
  apiKeyLast4: text("api_key_last4").notNull(),
  defaultModel: text("default_model").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
  lastTestOk: integer("last_test_ok", { mode: "boolean" }),
  lastTestNote: text("last_test_note"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
});

export const aiRoutes = sqliteTable("ai_routes", {
  purpose: text("purpose").$type<AiPurpose>().primaryKey(),
  primaryProviderId: text("primary_provider_id").references(() => aiProviders.id, {
    onDelete: "set null",
  }),
  fallbackProviderId: text("fallback_provider_id").references(() => aiProviders.id, {
    onDelete: "set null",
  }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
});

