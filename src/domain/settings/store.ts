import { d1Db, dbTarget } from "@/db";
import { NOTIFICATION_DEFAULTS } from "@/db/schema/desk";
import { d1SettingsStore } from "./store-d1";
import { pgSettingsStore } from "./store-pg";

// The desk settings' one door to the database (OPS-126): the key/value table
// desk_settings (the reply-time promise, voice call routing, social links) and
// the per-person notification choices in staff_notification_prefs, plus the
// "who gets paged" read. Every query on those two tables goes through a
// SettingsStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging
// first; the code refuses "d1" in production, see src/db/target.mjs).
// Left where they are on purpose: the team list and the emails-sent count
// (users and messages move with their own rows) and the audit log (OPS-123).

export type NotificationKind = keyof typeof NOTIFICATION_DEFAULTS;
export type NotificationPrefsRow = Record<NotificationKind, boolean>;

export interface SettingsStore {
  // ── desk_settings ──
  /** The stored value for a key, or undefined when there is no row. */
  getSetting(key: string): Promise<unknown | undefined>;
  /** Insert the key, or replace its value and who/when on a second write. */
  upsertSetting(key: string, value: unknown, updatedBy: string | null, updatedAt: Date): Promise<void>;

  // ── staff_notification_prefs ──
  /** One person's saved toggles, or undefined when they never saved (the defaults apply). */
  getNotificationPrefs(userId: string): Promise<NotificationPrefsRow | undefined>;
  /** Create the row with `next`, or on a second save set only the keys in `patch`. */
  upsertNotificationPrefs(
    userId: string,
    next: NotificationPrefsRow,
    patch: Partial<NotificationPrefsRow>,
    updatedAt: Date,
  ): Promise<void>;
  /**
   * Emails of the staff users (dispatcher, admin, superadmin) whose toggle for
   * `kind` is on; a user with no row counts as the default. Not trimmed or
   * deduplicated: the caller does that.
   */
  recipientEmails(kind: NotificationKind): Promise<string[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function settingsStore(): SettingsStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1SettingsStore(client);
  }
  return pgSettingsStore();
}
