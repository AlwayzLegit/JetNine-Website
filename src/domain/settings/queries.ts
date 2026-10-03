import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { legacyKeyUsage, type LegacyKeyUsage } from "@/domain/api-keys/commands";
import {
  NOTIFICATION_DEFAULTS,
  REPLY_PROMISE_CHOICES,
  REPLY_PROMISE_DEFAULT,
  REPLY_PROMISE_KEY,
  deskSettings as deskSettingsTable,
} from "@/db/schema/desk";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { deskRole, personName, type DeskRole } from "@/lib/desk-status";
import { snapshot, type HealthSnapshot } from "@/lib/health";

/**
 * Settings: desk-wide facts shared by the admin pages and /api/v1. Nothing
 * here returns a secret, a per-user preference or an env value; the health
 * snapshot is the same shape /api/health already serves publicly.
 */

// ─── Desk settings ────────────────────────────────────────────────────

export type DeskSettings = {
  /** Minutes a new request gets before a reply is late. */
  replyPromiseMinutes: number;
  replyPromiseChoices: readonly number[];
  /** What a staff member gets paged for until they change their toggles. */
  notificationDefaults: typeof NOTIFICATION_DEFAULTS;
};

/** Same read as src/lib/desk-settings.ts getReplyPromiseMinutes, minus the React cache. Never throws. */
export async function replyPromiseMinutes(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: deskSettingsTable.value })
      .from(deskSettingsTable)
      .where(eq(deskSettingsTable.key, REPLY_PROMISE_KEY))
      .limit(1);
    const n = Number(row?.value);
    if (!Number.isFinite(n) || n <= 0) return REPLY_PROMISE_DEFAULT;
    return Math.round(n);
  } catch {
    return REPLY_PROMISE_DEFAULT;
  }
}

export async function deskSettings(): Promise<DeskSettings> {
  return {
    replyPromiseMinutes: await replyPromiseMinutes(),
    replyPromiseChoices: REPLY_PROMISE_CHOICES,
    notificationDefaults: NOTIFICATION_DEFAULTS,
  };
}

// ─── Team ─────────────────────────────────────────────────────────────

export type TeamMember = {
  id: string;
  email: string;
  /** Database role: dispatcher, admin or superadmin. */
  role: string;
  /** The two words the desk uses: owner or team. */
  deskRole: DeskRole;
  /** Display name when set, else first + last, else the email's local part. */
  name: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** Everyone who can open the desk, owners first then by name. Emails included: owners only at the API. */
export async function listTeam(): Promise<TeamMember[]> {
  const rows = await db
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
    .where(inArray(users.role, ["dispatcher", "admin", "superadmin"]))
    .orderBy(
      // Owners first, then by name.
      sql`case when ${users.role} in ('admin','superadmin') then 0 else 1 end`,
      asc(staff.displayName),
      asc(users.lastName),
      asc(users.firstName),
    );

  const out: TeamMember[] = [];
  for (const r of rows) {
    const dr = deskRole(r.role);
    if (!dr) continue;
    out.push({
      id: r.id,
      email: r.email,
      role: r.role,
      deskRole: dr,
      name: r.displayName?.trim() || personName(r.firstName, r.lastName, r.email.split("@")[0]),
      displayName: r.displayName,
      firstName: r.firstName,
      lastName: r.lastName,
    });
  }
  return out;
}

// ─── Health ───────────────────────────────────────────────────────────

export type HealthReport = HealthSnapshot & {
  /** Outbound emails marked sent today (Los Angeles day); null when the messages table is unreadable. */
  emailsSentToday: number | null;
  /** The old BLOG_ADMIN_API_KEY: still set, when it was last used, and whether it can go. */
  legacyBlogKey: LegacyKeyUsage;
};

export async function emailsSentToday(): Promise<number | null> {
  try {
    const [row] = await db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from public.messages
      where channel = 'email' and direction = 'out' and delivery_status = 'sent'
        and (occurred_at at time zone 'America/Los_Angeles')::date
            = (now() at time zone 'America/Los_Angeles')::date
    `);
    return row?.n ?? 0;
  } catch {
    return null;
  }
}

export async function healthSnapshot(): Promise<HealthReport> {
  const [snap, sent, legacyBlogKey] = await Promise.all([snapshot(), emailsSentToday(), legacyKeyUsage()]);
  return { ...snap, emailsSentToday: sent, legacyBlogKey };
}
