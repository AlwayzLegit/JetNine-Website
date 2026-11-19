import { d1Db, dbTarget } from "@/db";
import { NOTIFICATION_DEFAULTS } from "@/db/schema/desk";
import type { staff } from "@/db/schema/staff";
import type { users } from "@/db/schema/users";
import { d1SettingsStore } from "./store-d1";
import { pgSettingsStore } from "./store-pg";

// The desk settings' one door to the database (OPS-126): the key/value table
// desk_settings (the reply-time promise, voice call routing, social links) and
// the per-person notification choices in staff_notification_prefs, plus the
// "who gets paged" read. Every query on those two tables goes through a
// SettingsStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging
// first; the code refuses "d1" in production, see src/db/target.mjs).
// Since OPS-165 the team list (teamRows) and the two one-person name reads
// (userNameEmail) are here too. Since OPS-204 the two team op reads
// (teammate, ownersOtherThan) are here too. Left where they are on purpose: the emails-sent
// count (messages move with their own rows) and the audit log (OPS-123).

export type NotificationKind = keyof typeof NOTIFICATION_DEFAULTS;
export type NotificationPrefsRow = Record<NotificationKind, boolean>;

/** One person of the desk's team list: the user row and the staff display name. */
export type TeamRow = {
  id: string;
  email: string;
  role: (typeof users.$inferSelect)["role"];
  firstName: (typeof users.$inferSelect)["firstName"];
  lastName: (typeof users.$inferSelect)["lastName"];
  /** Null when the person has no staff row (the join is a left join). */
  displayName: (typeof staff.$inferSelect)["displayName"] | null;
};

/** The person a team op acts on: the user row and the staff display name, whatever the role. */
export type TeammateRow = TeamRow;

/** One person's name and email, for the notification card and the test email. */
export type UserNameEmail = {
  email: string;
  firstName: (typeof users.$inferSelect)["firstName"];
  lastName: (typeof users.$inferSelect)["lastName"];
};

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

  // ── the team list and one person's name (OPS-165) ──
  /**
   * Everyone who can open the desk (dispatcher, admin, superadmin): owners first, then by display
   * name, last name and first name, ascending, with missing names last (as Postgres sorts them).
   */
  teamRows(): Promise<TeamRow[]>;
  /** One user's email and names, or undefined when there is no such user. */
  userNameEmail(userId: string): Promise<UserNameEmail | undefined>;

  // ── the two reads of a team op (OPS-204) ──
  /** One user with the staff display name (left join), any role, or undefined when there is no such user. */
  teammate(id: string): Promise<TeammateRow | undefined>;
  /** How many owners (admin or superadmin) there are other than `userId`: the "at least one owner" guard. */
  ownersOtherThan(userId: string): Promise<number>;
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
