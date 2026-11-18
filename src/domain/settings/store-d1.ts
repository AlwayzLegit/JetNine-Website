import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { deskSettings, staffNotificationPrefs } from "@/db/d1/schema/desk";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import { NOTIFICATION_DEFAULTS } from "@/db/schema/desk";
import type { NotificationKind, SettingsStore } from "./store";

// The D1 (SQLite) side of the settings store (OPS-126). Same methods and the
// same results as store-pg.ts, on the D1 twin tables (src/db/d1/schema,
// OPS-100). The client is passed in so a test can hand it a real SQLite.

// The D1 client from d1Db(). A test casts a sqlite-proxy over node:sqlite to it.
type D1Client = DrizzleD1Database;

/** DB roles that may open the desk. */
const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

const PREF_COLUMN = {
  newRequest: staffNotificationPrefs.newRequest,
  replyDueSoon: staffNotificationPrefs.replyDueSoon,
  clientPick: staffNotificationPrefs.clientPick,
  morningSummary: staffNotificationPrefs.morningSummary,
} as const;

export function d1SettingsStore(db: D1Client): SettingsStore {
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
      // The value goes in as the JS value: the JSON-mode column stringifies it.
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
      // SQLite has no boolean: the column holds 0 or 1, and no row means the default.
      const fallback = NOTIFICATION_DEFAULTS[kind] ? 1 : 0;
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .leftJoin(staffNotificationPrefs, eq(staffNotificationPrefs.userId, users.id))
        .where(and(inArray(users.role, [...STAFF_ROLES]), sql`coalesce(${col}, ${fallback}) = 1`));
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
          // Owners first, then by name. SQLite sorts NULL first in ascending order and Postgres
          // last, so each name is ordered by "is null" first to put a missing name last.
          sql`case when ${users.role} in ('admin','superadmin') then 0 else 1 end`,
          sql`${staff.displayName} is null`,
          asc(staff.displayName),
          sql`${users.lastName} is null`,
          asc(users.lastName),
          sql`${users.firstName} is null`,
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
  };
}
