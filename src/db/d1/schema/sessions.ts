// D1 (SQLite) twin of src/db/schema/sessions.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { newId, nowDate } from "../helpers";
import { users } from "./users";

// ─── the site's own sign-in ──────────────────────────────────────────────
// Mirrors src/db/migrations/0056_site_sessions.sql. See src/lib/session.
// Server-only: RLS on, no policies, no grants for the public roles.

/** One row per signed-in browser. Only the SHA-256 of the cookie token is stored. */
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("user_sessions_user_idx").on(t.userId), index("user_sessions_expires_idx").on(t.expiresAt)]);

/** A password set after the move to the site's own sign-in (bcrypt). */
export const userCredentials = sqliteTable("user_credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
});

