import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── the site's own sign-in ──────────────────────────────────────────────
// Mirrors src/db/migrations/0056_site_sessions.sql. See src/lib/session.
// Server-only: RLS on, no policies, no grants for the public roles.

/** One row per signed-in browser. Only the SHA-256 of the cookie token is stored. */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("user_sessions_user_idx").on(t.userId), index("user_sessions_expires_idx").on(t.expiresAt)],
);

/** A password set after the move to the site's own sign-in (bcrypt). */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/**
 * One-time emailed links (OPS-94), mirrors src/db/migrations/0057_auth_tokens.sql.
 * Only the SHA-256 of the token is stored. Spent by one atomic UPDATE.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["signin", "reset", "invite"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("auth_tokens_user_purpose_idx").on(t.userId, t.purpose), index("auth_tokens_expires_idx").on(t.expiresAt)],
);

export type UserSession = typeof userSessions.$inferSelect;
