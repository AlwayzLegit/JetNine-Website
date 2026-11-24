// D1 only (OPS-242): the site chat's daily counters. One row per Pacific day and
// nothing else: no transcript, no visitor text, no address. There is no Postgres
// twin (production reads D1 since the cutover, OPS-206); the parity test names it
// as D1-only.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatDaily = sqliteTable("chat_daily", {
  /** Pacific date, yyyy-mm-dd. */
  day: text("day").primaryKey(),
  sessions: integer("sessions").notNull().default(0),
  messages: integer("messages").notNull().default(0),
  handoffs: integer("handoffs").notNull().default(0),
  guardHits: integer("guard_hits").notNull().default(0),
  fallbacks: integer("fallbacks").notNull().default(0),
});
