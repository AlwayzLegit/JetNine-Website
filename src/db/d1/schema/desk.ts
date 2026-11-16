// D1 (SQLite) twin of src/db/schema/desk.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowDate } from "../helpers";
import { users } from "./users";

// ─── staff_notification_prefs ────────────────────────────────────────────
// Settings › Notifications. One row per staff user, created on first save
// (absent row = the defaults below). Read by the alert senders in
// src/lib/desk-notify.ts to decide who gets paged for what.

export const staffNotificationPrefs = sqliteTable("staff_notification_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** "A new request comes in" — text and email, any hour. */
  newRequest: integer("new_request", { mode: "boolean" }).notNull().default(true),
  /** "A reply is about to be late" — 10 minutes before the promise runs out. */
  replyDueSoon: integer("reply_due_soon", { mode: "boolean" }).notNull().default(true),
  /** "A client picks an option" — email, so you can confirm the booking. */
  clientPick: integer("client_pick", { mode: "boolean" }).notNull().default(true),
  /** "Morning summary" — one email at 7 AM with today's flights and open requests. */
  morningSummary: integer("morning_summary", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
});

// ─── desk_settings ───────────────────────────────────────────────────────
// Desk-wide key/value settings (owner-editable). Keys today:
//   reply_promise_minutes — number; the SLA stamped on new requests and
//                           the "within N minutes" promise shown to clients.

export const deskSettings = sqliteTable("desk_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
});


