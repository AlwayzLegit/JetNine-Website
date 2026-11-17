import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { NOTIFICATION_DEFAULTS, deskSettings, staffNotificationPrefs } from "@/db/schema/desk";
import { users } from "@/db/schema/users";
import type { NotificationKind, SettingsStore } from "./store";

// The Postgres side of the settings store (OPS-126): the queries that lived in
// src/lib/desk-settings.ts, src/domain/settings/queries.ts and
// src/domain/settings/commands.ts, moved as they were.

/** DB roles that may open the desk. */
const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

const PREF_COLUMN = {
  newRequest: staffNotificationPrefs.newRequest,
  replyDueSoon: staffNotificationPrefs.replyDueSoon,
  clientPick: staffNotificationPrefs.clientPick,
  morningSummary: staffNotificationPrefs.morningSummary,
} as const;

export function pgSettingsStore(): SettingsStore {
  return {
    async getSetting(key) {
      const [row] = await db
        .select({ value: deskSettings.value })
        .from(deskSettings)
        .where(eq(deskSettings.key, key))
        .limit(1);
      return row?.value;
    },

    async upsertSetting(key, value, updatedBy, updatedAt) {
      await db
        .insert(deskSettings)
        .values({ key, value, updatedBy, updatedAt })
        .onConflictDoUpdate({ target: deskSettings.key, set: { value, updatedBy, updatedAt } });
    },

    async getNotificationPrefs(userId) {
      const [row] = await db
        .select({
          newRequest: staffNotificationPrefs.newRequest,
          replyDueSoon: staffNotificationPrefs.replyDueSoon,
          clientPick: staffNotificationPrefs.clientPick,
          morningSummary: staffNotificationPrefs.morningSummary,
        })
        .from(staffNotificationPrefs)
        .where(eq(staffNotificationPrefs.userId, userId))
        .limit(1);
      return row ? { ...row } : undefined;
    },

    async upsertNotificationPrefs(userId, next, patch, updatedAt) {
      await db
        .insert(staffNotificationPrefs)
        .values({ userId, ...next, updatedAt })
        .onConflictDoUpdate({
          target: staffNotificationPrefs.userId,
          set: { ...patch, updatedAt },
        });
    },

    async recipientEmails(kind: NotificationKind) {
      const col = PREF_COLUMN[kind];
      const fallback = NOTIFICATION_DEFAULTS[kind];
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .leftJoin(staffNotificationPrefs, eq(staffNotificationPrefs.userId, users.id))
        .where(and(inArray(users.role, [...STAFF_ROLES]), sql`coalesce(${col}, ${fallback}) = true`));
      return rows.map((r) => r.email);
    },
  };
}
