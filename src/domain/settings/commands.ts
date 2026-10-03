import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { auditFields, type Actor } from "@/domain/actor";
import { err, ok, type Result } from "@/domain/result";
import { replyPromiseMinutes } from "./queries";
import type { NotificationPrefInput, ReplyPromiseInput } from "./schemas";

/**
 * Settings commands, shared by the admin's Server Actions, the API and the
 * approval queue through the ops in ./ops.ts. Nothing here checks the
 * session or revalidates: the op declares its paths and `runOp` handles
 * both.
 *
 * `@/lib/desk-settings` is a `server-only` module, so it is imported on
 * demand inside the command bodies: scripts/check-api.mts loads the route
 * registry under tsx, where `server-only` does not resolve.
 */

type Nothing = Record<string, never>;

// ─── Reply-time promise ──────────────────────────────────────────────────

export type ReplyPromiseState = { before: number };

export async function loadReplyPromise(): Promise<Result<ReplyPromiseState>> {
  return ok({ before: await replyPromiseMinutes() });
}

/** Desk-wide. No change → nothing is written and nothing is audited, as before. */
export async function setReplyPromise(
  actor: Actor,
  input: ReplyPromiseInput,
  state: ReplyPromiseState,
): Promise<Result<{ minutes: number; before: number; changed: boolean }>> {
  const { minutes } = input;
  const before = state.before;
  if (before === minutes) return ok({ minutes, before, changed: false });

  const { setReplyPromiseMinutes } = await import("@/lib/desk-settings");
  try {
    await setReplyPromiseMinutes(minutes, actor.userId);
  } catch (e) {
    // Migration 0050 not applied yet: keep the page up; the default holds.
    console.error("[settings/notifications] reply promise save failed", e);
    return err("unavailable", "The reply promise could not be saved. Try again.");
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "system.reply_promise.update",
    subjectType: "system",
    subjectCode: "reply_promise_minutes",
    diff: { minutes: { before, after: minutes } },
    metadata: a.metadata,
  });

  return ok({ minutes, before, changed: true });
}

// ─── A person's own notification toggles ─────────────────────────────────

export async function loadNothing(): Promise<Result<Nothing>> {
  return ok({});
}

export type NotificationPrefState = { name: string };

/** The person whose toggle this is, for the approval card. */
export async function loadNotificationPref(input: NotificationPrefInput): Promise<Result<NotificationPrefState>> {
  const [row] = await db
    .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!row) return err("not_found", "That person is not on the desk.");
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email.split("@")[0];
  return ok({ name });
}

/**
 * A person's own toggle. The input names the person (always the caller,
 * set by the route or Server Action); when a person approves a key's
 * proposal, it is the key's person whose toggle changes, never the
 * approver's.
 */
export async function setNotificationPref(
  actor: Actor,
  input: NotificationPrefInput,
): Promise<Result<{ kind: NotificationPrefInput["kind"]; on: boolean }>> {
  if (!actor.userId) return err("forbidden", "Notification settings belong to a person; this key does not act as one.");
  if (actor.via !== "approval" && input.userId !== actor.userId) {
    return err("forbidden", "You can only change your own notifications.");
  }

  const { saveNotificationPrefs } = await import("@/lib/desk-settings");
  try {
    await saveNotificationPrefs(input.userId, { [input.kind]: Boolean(input.on) });
  } catch (e) {
    console.error("[settings/notifications] save failed", e);
    return err("unavailable", "Could not save. Try again.");
  }
  return ok({ kind: input.kind, on: input.on });
}

// ─── Test email ──────────────────────────────────────────────────────────

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Settings › Connections › Email › "Send a test". Emails the actor through
 * the same layer the desk uses for clients. Never reaches anyone else.
 */
export async function sendTestEmailTo(
  actor: Actor,
): Promise<Result<{ ok: boolean; provider: "resend" | "postmark" | "logger" | null; to: string }>> {
  if (!actor.userId) return err("forbidden", "A test email goes to a person; this key does not act as one.");

  const [user] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!user) return err("not_found", "No account found for you.");

  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  const result = await sendEmail({
    to: user.email,
    subject: "JetNine desk · test email",
    text: [
      `${user.firstName ?? "Hi"},`,
      "",
      `This is a test from Settings › Connections, sent ${when} Los Angeles time.`,
      "If you are reading it, email from the desk is working.",
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;">${user.firstName ? escape(user.firstName) : "Hi"},</p>
        <p style="margin:0 0 16px;font-size:15px;">This is a test from Settings › Connections, sent ${escape(when)} Los Angeles time.</p>
        <p style="margin:0;font-size:15px;">If you are reading it, email from the desk is working.</p>
      </div>`.trim(),
  });

  return ok({ ok: result.ok, provider: result.ok ? result.provider : null, to: user.email });
}
