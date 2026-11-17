// D1 (SQLite) table for the fixed-window rate limiter (OPS-123). There is no Drizzle twin on
// Postgres: there the table (request_rate_limits, migration 0021) is only reached with raw SQL
// and is in no Drizzle schema. Here it is a Drizzle table so the D1 limiter and its test use
// typed statements. Same SQL table and column names as on Postgres; the key differs (one text
// primary key, because the D1 copy tool needs a single-column key), and nothing is ever copied
// from Postgres: counters live for minutes.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const requestRateLimits = sqliteTable(
  "request_rate_limits",
  {
    /** bucket + "|" + the window start in epoch ms: one row per bucket and window. */
    id: text("id").primaryKey(),
    bucket: text("bucket").notNull(),
    windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [index("request_rate_limits_window_idx").on(t.windowStart)],
);
