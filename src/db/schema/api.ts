import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── api_keys ────────────────────────────────────────────────────────────
// Minted and revoked from Settings › API keys (owner only). Only a sha256
// of the token is stored. A key acts as its creator, capped by `scopes`.
// See src/lib/api-keys.ts (token format, scopes) and src/lib/api-auth.ts.

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull().unique(),
    tokenHash: text("token_hash").notNull().unique(),
    last4: text("last4").notNull(),
    scopes: text("scopes").array().notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(120),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: text("last_used_ip"),
    lastUsedUa: text("last_used_ua"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    index("api_keys_created_by_idx").on(t.createdBy),
    check("api_keys_name_check", sql`char_length(${t.name}) between 1 and 60`),
    check(
      "api_keys_scopes_check",
      sql`cardinality(${t.scopes}) > 0 and ${t.scopes} <@ array['read','content','desk','clients','money','settings','admin','agent']::text[]`,
    ),
    check("api_keys_rate_limit_per_min_check", sql`${t.rateLimitPerMin} between 1 and 2000`),
    // The assistant's key always asks before anything client-facing.
    check("api_keys_agent_supervised", sql`not ('agent' = any(${t.scopes})) or ${t.requiresApproval}`),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;

// ─── api_requests ────────────────────────────────────────────────────────
// One row per /api/v1 call (and per legacy blog-key call). 30-day retention.

export const apiRequests = pgTable(
  "api_requests",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    keyId: uuid("key_id").references(() => apiKeys.id, { onDelete: "cascade" }),
    legacy: boolean("legacy").notNull().default(false),
    method: text("method").notNull(),
    route: text("route").notNull(),
    status: smallint("status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    ip: text("ip"),
    ua: text("ua"),
    runId: uuid("run_id"),
    requestId: text("request_id"),
    at: timestamp("at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("api_requests_key_at_idx").on(t.keyId, t.at.desc()), index("api_requests_at_idx").on(t.at)],
);

export type ApiRequestRow = typeof apiRequests.$inferSelect;
