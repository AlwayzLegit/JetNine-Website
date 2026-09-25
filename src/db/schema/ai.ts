import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

export const AI_PROVIDERS = ["anthropic", "openai"] as const;
export type AiProviderKind = (typeof AI_PROVIDERS)[number];

export const AI_PURPOSES = ["voice_agent"] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

export const aiProviders = pgTable("ai_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").$type<AiProviderKind>().notNull().unique(),
  label: text("label").notNull(),
  apiKeyEnc: text("api_key_enc").notNull(),
  apiKeyLast4: text("api_key_last4").notNull(),
  defaultModel: text("default_model").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  lastTestNote: text("last_test_note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiRoutes = pgTable("ai_routes", {
  purpose: text("purpose").$type<AiPurpose>().primaryKey(),
  primaryProviderId: uuid("primary_provider_id").references(() => aiProviders.id, {
    onDelete: "set null",
  }),
  fallbackProviderId: uuid("fallback_provider_id").references(() => aiProviders.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiProvider = typeof aiProviders.$inferSelect;
export type AiRoute = typeof aiRoutes.$inferSelect;
