import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { NOTIFICATION_DEFAULTS, deskSettings, staffNotificationPrefs } from "@/db/schema/desk";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import type { NotificationKind, SettingsStore } from "./store";

// The Postgres side of the settings store (OPS-126): the queries that lived in
// src/lib/desk-settings.ts, src/domain/settings/queries.ts and
// src/domain/settings/commands.ts, moved as they were.

/** DB roles that may open the desk. */
const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

/** DB roles that count as owners. */
const OWNER_ROLES = ["admin", "superadmin"] as const;

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

    async teamRows() {
      return db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: staff.displayName,
        })
        .from(users)
        .leftJoin(staff, eq(staff.userId, users.id))
        .where(inArray(users.role, [...STAFF_ROLES]))
        .orderBy(
          // Owners first, then by name.
          sql`case when ${users.role} in ('admin','superadmin') then 0 else 1 end`,
          asc(staff.displayName),
          asc(users.lastName),
          asc(users.firstName),
        );
    },

    async userNameEmail(userId) {
      const [row] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return row;
    },

    // OPS-204: the two reads of src/domain/team/commands.ts, moved as they were.
    async teammate(id) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: staff.displayName,
        })
        .from(users)
        .leftJoin(staff, eq(staff.userId, users.id))
        .where(eq(users.id, id))
        .limit(1);
      return row;
    },

    async ownersOtherThan(userId) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.role, [...OWNER_ROLES]), ne(users.id, userId)));
      return rows.length;
    },
  };
}
