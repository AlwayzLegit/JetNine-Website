import "server-only";
import { cache } from "react";
import {
  NOTIFICATION_DEFAULTS,
  REPLY_PROMISE_CHOICES,
  REPLY_PROMISE_DEFAULT,
  REPLY_PROMISE_KEY,
} from "@/db/schema/desk";
import { settingsStore } from "@/domain/settings/store";

/**
 * Settings › Notifications and the desk-wide reply-time promise (Phase 5).
 *
 * Readers never throw: a missing table or a bad row falls back to the
 * defaults so a request still lands and an alert still goes somewhere.
 */

export type NotificationKind = keyof typeof NOTIFICATION_DEFAULTS;
export type NotificationPrefs = Record<NotificationKind, boolean>;

export const NOTIFICATION_KINDS = Object.keys(NOTIFICATION_DEFAULTS) as NotificationKind[];

export function isNotificationKind(v: string): v is NotificationKind {
  return (NOTIFICATION_KINDS as string[]).includes(v);
}

// ─── Reply-time promise ────────────────────────────────────────────────

/**
 * Minutes a new request gets before a reply is late. Cached per request
 * (React `cache`), defaults to 30, never throws.
 */
export const getReplyPromiseMinutes = cache(async (): Promise<number> => {
  try {
    const value = await settingsStore().getSetting(REPLY_PROMISE_KEY);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return REPLY_PROMISE_DEFAULT;
    return Math.round(n);
  } catch {
    return REPLY_PROMISE_DEFAULT;
  }
});

export function isReplyPromiseChoice(n: number): n is (typeof REPLY_PROMISE_CHOICES)[number] {
  return (REPLY_PROMISE_CHOICES as readonly number[]).includes(n);
}

export async function setReplyPromiseMinutes(minutes: number, updatedBy: string | null): Promise<void> {
  if (!isReplyPromiseChoice(minutes)) throw new Error("Reply promise must be 15, 30 or 60 minutes");
  await settingsStore().upsertSetting(REPLY_PROMISE_KEY, minutes, updatedBy, new Date());
}

// ─── Per-user notification preferences ────────────────────────────────

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const row = await settingsStore().getNotificationPrefs(userId);
    return row ? { ...row } : { ...NOTIFICATION_DEFAULTS };
  } catch {
    return { ...NOTIFICATION_DEFAULTS };
  }
}

/** Upserts the row; keys left out keep their stored (or default) value. */
export async function saveNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const current = await getNotificationPrefs(userId);
  const next: NotificationPrefs = { ...current, ...patch };
  await settingsStore().upsertNotificationPrefs(userId, next, patch, new Date());
  return next;
}

// ─── Who gets paged ───────────────────────────────────────────────────

/**
 * Emails of the staff users (dispatcher / admin / superadmin) whose toggle
 * for `kind` is on. A user with no prefs row counts as the default. Returns
 * [] on any failure so the caller falls back to the shared dispatch inbox.
 */
export async function recipientsFor(kind: NotificationKind): Promise<string[]> {
  try {
    const emails = await settingsStore().recipientEmails(kind);
    const seen = new Set<string>();
    for (const email of emails) {
      const e = email?.trim().toLowerCase();
      if (e && e.includes("@")) seen.add(e);
    }
    return [...seen];
  } catch (err) {
    console.error("[desk-settings] recipientsFor failed", kind, err);
    return [];
  }
}
