import { replyPromiseWords } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  loadNothing,
  loadReplyPromise,
  sendTestEmailTo,
  setNotificationPref,
  setReplyPromise,
  type ReplyPromiseState,
} from "./commands";
import { NOTIFICATION_WORDS, NotificationPrefInput, ReplyPromiseInput, TestEmailInput } from "./schemas";

/**
 * Operations under Settings. The reply-time promise is desk-wide and a
 * `settings` matter: owners only, and a supervised key's change waits for
 * one. A person's notification toggles are their own, so any desk account
 * may flip them (the `desk` permission, which every staff role holds) and
 * a supervised key's flip still waits for an owner. The test email only
 * ever reaches the actor, so it runs at once.
 */

type Nothing = Record<string, never>;

const NOTIFICATIONS_PATH = "/admin/settings/notifications";

export const replyPromiseOp = defineOp<ReplyPromiseInput, ReplyPromiseState>({
  id: "settings.replyPromise",
  scope: "settings",
  schema: ReplyPromiseInput,
  load: loadReplyPromise,
  risk: () => "settings",
  summary: (input) => `Set the reply promise to ${replyPromiseWords(input.minutes)}`,
  preview: (input, state) =>
    state.before === input.minutes ? null : `reply promise: ${replyPromiseWords(state.before)} → ${replyPromiseWords(input.minutes)}`,
  subject: () => ({ type: "system", id: null, code: "reply_promise_minutes" }),
  run: setReplyPromise,
  revalidate: () => [NOTIFICATIONS_PATH, "/admin/requests"],
});

export const notificationPrefOp = defineOp<NotificationPrefInput, Nothing>({
  id: "settings.notificationPref",
  scope: "desk",
  schema: NotificationPrefInput,
  load: loadNothing,
  risk: () => "settings",
  summary: (input) => `Turn ${NOTIFICATION_WORDS[input.kind]} notifications ${input.on ? "on" : "off"} for yourself`,
  subject: (input) => ({ type: "system", id: null, code: `notification:${input.kind}` }),
  run: (actor, input) => setNotificationPref(actor, input),
  revalidate: () => [NOTIFICATIONS_PATH],
});

export const testEmailOp = defineOp<TestEmailInput, Nothing>({
  id: "settings.testEmail",
  scope: "settings",
  schema: TestEmailInput,
  load: loadNothing,
  // Only ever emails the actor themself.
  risk: () => null,
  summary: () => "Send a test email to yourself",
  subject: () => ({ type: "system", id: null, code: "email" }),
  run: (actor, input) => sendTestEmailTo(actor, input),
});

export const SETTINGS_OPS: AnyOp[] = [replyPromiseOp, notificationPrefOp, testEmailOp];
