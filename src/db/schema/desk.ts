import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── staff_notification_prefs ────────────────────────────────────────────
// Settings › Notifications. One row per staff user, created on first save
// (absent row = the defaults below). Read by the alert senders in
// src/lib/desk-notify.ts to decide who gets paged for what.

export const staffNotificationPrefs = pgTable("staff_notification_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** "A new request comes in" — text and email, any hour. */
  newRequest: boolean("new_request").notNull().default(true),
  /** "A reply is about to be late" — 10 minutes before the promise runs out. */
  replyDueSoon: boolean("reply_due_soon").notNull().default(true),
  /** "A client picks an option" — email, so you can confirm the booking. */
  clientPick: boolean("client_pick").notNull().default(true),
  /** "Morning summary" — one email at 7 AM with today's flights and open requests. */
  morningSummary: boolean("morning_summary").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type StaffNotificationPrefs = typeof staffNotificationPrefs.$inferSelect;

export const NOTIFICATION_DEFAULTS = {
  newRequest: true,
  replyDueSoon: true,
  clientPick: true,
  morningSummary: false,
} as const;

// ─── desk_settings ───────────────────────────────────────────────────────
// Desk-wide key/value settings (owner-editable). Keys today:
//   reply_promise_minutes — number; the SLA stamped on new requests and
//                           the "within N minutes" promise shown to clients.

export const deskSettings = pgTable("desk_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type DeskSetting = typeof deskSettings.$inferSelect;

export const REPLY_PROMISE_KEY = "reply_promise_minutes";
export const REPLY_PROMISE_DEFAULT = 30;
export const REPLY_PROMISE_CHOICES = [15, 30, 60] as const;
