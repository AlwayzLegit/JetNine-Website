import { z } from "zod";
import { NOTIFICATION_DEFAULTS, REPLY_PROMISE_CHOICES } from "@/db/schema/desk";

/**
 * Input shapes for the settings operations: the desk-wide reply-time
 * promise, a person's own notification toggles, and the test email from
 * Settings › Connections. `*Input` is what an op takes (and what a stored
 * proposal is re-parsed with at approval time); `*Body` is the API body,
 * which adds an optional `reason` for the approver.
 *
 * Keep this file free of `server-only` imports: scripts/check-api.mts
 * loads the route registry under tsx. The choices and kinds come from the
 * schema module, the same source src/lib/desk-settings.ts reads.
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

export type NotificationKind = keyof typeof NOTIFICATION_DEFAULTS;
export const NOTIFICATION_KINDS = Object.keys(NOTIFICATION_DEFAULTS) as [NotificationKind, ...NotificationKind[]];

/** The four toggles in the words the Notifications page uses for them. */
export const NOTIFICATION_WORDS: Record<NotificationKind, string> = {
  newRequest: "new request",
  replyDueSoon: "reply due soon",
  clientPick: "client pick",
  morningSummary: "morning summary",
};

export const ReplyPromiseInput = z.object({
  minutes: z
    .literal([...REPLY_PROMISE_CHOICES], { error: "Reply promise must be 15, 30 or 60 minutes" })
    .describe("Minutes a new request gets before a reply is late: 15, 30 or 60."),
});
export type ReplyPromiseInput = z.infer<typeof ReplyPromiseInput>;

export const NotificationPrefInput = z.object({
  /** Whose toggle: always the caller (the key's creator), set by the route or action, never from a request body. */
  userId: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS, { error: "Unknown setting" }),
  on: z.boolean(),
});
export type NotificationPrefInput = z.infer<typeof NotificationPrefInput>;

export const TestEmailInput = z.object({});
export type TestEmailInput = z.infer<typeof TestEmailInput>;

/**
 * PATCH /settings/desk: one change per call — either the reply promise or
 * exactly one notification toggle. The route refuses a body that asks for
 * both, or for more than one toggle, so every call maps to one op and one
 * answer (done or queued).
 */
export const DeskSettingsBody = z.object({
  replyPromiseMinutes: ReplyPromiseInput.shape.minutes.optional(),
  notifications: z
    .partialRecord(z.enum(NOTIFICATION_KINDS), z.boolean())
    .optional()
    .describe("One toggle for the person the key acts as, e.g. { \"newRequest\": false }."),
  reason,
});
export type DeskSettingsBody = z.infer<typeof DeskSettingsBody>;
