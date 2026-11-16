// D1 (SQLite) twin of src/db/schema/api.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { desc, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { newId, nowDate } from "../helpers";
import { users } from "./users";

const ALLOWED_SCOPES = ["read", "content", "desk", "clients", "money", "settings", "admin", "agent"];

// True when the JSON array text holds only allowed scope names: strip each
// allowed quoted name, then nothing but brackets, commas and spaces may remain.
const SCOPES_ONLY_ALLOWED = (col: unknown) => {
  let expr = sql`${col}`;
  for (const scope of ALLOWED_SCOPES) expr = sql`replace(${expr}, ${sql.raw(`'"${scope}"'`)}, '')`;
  return sql`replace(replace(replace(replace(${expr}, '[', ''), ']', ''), ',', ''), ' ', '') = ''`;
};

// ─── api_keys ────────────────────────────────────────────────────────────
// Minted and revoked from Settings › API keys (owner only). Only a sha256
// of the token is stored. A key acts as its creator, capped by `scopes`.
// See src/lib/api-keys.ts (token format, scopes) and src/lib/api-auth.ts.

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    prefix: text("prefix").notNull().unique(),
    tokenHash: text("token_hash").notNull().unique(),
    last4: text("last4").notNull(),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
    requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(true),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(120),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    lastUsedIp: text("last_used_ip"),
    lastUsedUa: text("last_used_ua"),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedBy: text("revoked_by").references(() => users.id, { onDelete: "set null" }),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    index("api_keys_created_by_idx").on(t.createdBy),
    check("api_keys_name_check", sql`length(${t.name}) between 1 and 60`),
    // SQLite forbids subqueries in CHECK, so the array tests use json_array_length
    // and string checks on the stored JSON text (see SCOPES_ONLY_ALLOWED above).
    check("api_keys_scopes_check", sql`json_array_length(${t.scopes}) > 0 and ${SCOPES_ONLY_ALLOWED(t.scopes)}`),
    check("api_keys_rate_limit_per_min_check", sql`${t.rateLimitPerMin} between 1 and 2000`),
    // The assistant's key always asks before anything client-facing.
    check("api_keys_agent_supervised", sql`instr(${t.scopes}, '"agent"') = 0 or ${t.requiresApproval}`),
  ]);


// ─── api_requests ────────────────────────────────────────────────────────
// One row per /api/v1 call (and per legacy blog-key call). 30-day retention.

export const apiRequests = sqliteTable(
  "api_requests",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    keyId: text("key_id").references(() => apiKeys.id, { onDelete: "cascade" }),
    legacy: integer("legacy", { mode: "boolean" }).notNull().default(false),
    method: text("method").notNull(),
    route: text("route").notNull(),
    status: integer("status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    ip: text("ip"),
    ua: text("ua"),
    runId: text("run_id"),
    requestId: text("request_id"),
    at: integer("at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [index("api_requests_key_at_idx").on(t.keyId, desc(t.at)), index("api_requests_at_idx").on(t.at)]);

