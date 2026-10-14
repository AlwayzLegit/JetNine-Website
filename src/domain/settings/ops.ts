import { replyPromiseWords } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { loadNotificationPref, type NotificationPrefState,
  loadNothing,
  loadReplyPromise,
  loadSocialLinks,
  loadVoiceRouting,
  sendTestEmailTo,
  setNotificationPref,
  setReplyPromise,
  setSocialLinks,
  setVoiceRouting,
  type ReplyPromiseState,
  type SocialLinksState,
  type VoiceRoutingState,
} from "./commands";
import { NOTIFICATION_WORDS, NotificationPrefInput, ReplyPromiseInput, SocialLinksInput, TestEmailInput, VoiceRoutingInput } from "./schemas";
import { socialLinksWords } from "@/lib/social-links";
import { routingWords } from "@/lib/voice-routing";

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

export const notificationPrefOp = defineOp<NotificationPrefInput, NotificationPrefState>({
  id: "settings.notificationPref",
  scope: "desk",
  schema: NotificationPrefInput,
  load: loadNotificationPref,
  risk: () => "settings",
  summary: (input, state) => `Turn ${NOTIFICATION_WORDS[input.kind]} notifications ${input.on ? "on" : "off"} for ${state.name}`,
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
  run: (actor) => sendTestEmailTo(actor),
});

export const VOICE_PATH = "/admin/settings/voice";

/** Who an inbound call rings before the agent answers. Desk-wide: owners only. */
export const voiceRoutingOp = defineOp<VoiceRoutingInput, VoiceRoutingState>({
  id: "settings.voiceRouting",
  scope: "settings",
  schema: VoiceRoutingInput,
  load: loadVoiceRouting,
  risk: () => "settings",
  summary: (input) =>
    `Call routing: ${routingWords({ ...input, ringFirst: input.ringFirst && input.numbers.length > 0 })}`,
  preview: (input, state) => {
    const before = routingWords(state.before);
    const after = routingWords({ ...input, ringFirst: input.ringFirst && input.numbers.length > 0 });
    return before === after ? null : `call routing: ${before} → ${after}`;
  },
  subject: () => ({ type: "system", id: null, code: "voice_routing" }),
  run: setVoiceRouting,
  revalidate: () => [VOICE_PATH],
});

export const SOCIAL_PATH = "/admin/settings/social";

/** The profiles in the footer and the Organization's sameAs. Desk-wide: owners only. */
export const socialLinksOp = defineOp<SocialLinksInput, SocialLinksState>({
  id: "settings.socialLinks",
  scope: "settings",
  schema: SocialLinksInput,
  load: loadSocialLinks,
  risk: () => "settings",
  summary: (input) => `Set the footer's social links: ${socialLinksWords(input)}`,
  preview: (input, state) => {
    const before = socialLinksWords(state.before);
    const after = socialLinksWords(input);
    return before === after ? null : `social links: ${before} → ${after}`;
  },
  subject: () => ({ type: "system", id: null, code: "social_links" }),
  run: setSocialLinks,
  revalidate: () => [SOCIAL_PATH],
  // The footer is on every prerendered public page.
  revalidateTags: () => ["social-links"],
});

export const SETTINGS_OPS: AnyOp[] = [replyPromiseOp, notificationPrefOp, testEmailOp, voiceRoutingOp, socialLinksOp];
