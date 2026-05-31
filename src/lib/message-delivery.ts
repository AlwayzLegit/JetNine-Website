// Shared thread-message dispatch — picks the right transport
// (email / SMS / WhatsApp) for a `messages` row based on its
// `channel`. Used by every dispatcher-side composer + the
// failed-delivery retry surface.
//
// Why a helper: the channel switch was duplicated verbatim in
// postQuoteMessage, postTripMessage, and retryMessageDelivery —
// three places at risk of drifting when a future channel (e.g.
// MMS) gets added.
//
// Each transport returns the same shape `{ ok, provider, messageId? }`
// (or `{ ok: false, error }`), so callers can apply the outcome
// to the persisted `messages` row without branching on channel.

import { sendThreadMessageEmail } from "@/lib/email";
import { sendThreadMessageSms, sendThreadMessageWhatsApp } from "@/lib/twilio";

export type ThreadChannel = "email" | "sms" | "whatsapp";

export type ThreadDispatchInput = {
  to: string;
  subjectCode: string;
  body: string;
  /** Email subject suffix; ignored for SMS / WhatsApp. */
  subjectSummary?: string;
};

export type ThreadDispatchResult =
  | { ok: true; provider: string; messageId?: string }
  | { ok: false; error: string };

/**
 * Dispatch one outbound thread message via the channel's transport.
 * The caller is responsible for inserting the `messages` row first
 * (so a failed send still leaves a record) and for stamping the
 * result onto the row after this returns.
 */
export async function dispatchThreadMessage(
  channel: ThreadChannel,
  input: ThreadDispatchInput,
): Promise<ThreadDispatchResult> {
  switch (channel) {
    case "email":
      return sendThreadMessageEmail({
        to: input.to,
        subjectCode: input.subjectCode,
        subjectSummary: input.subjectSummary,
        body: input.body,
      });
    case "whatsapp":
      return sendThreadMessageWhatsApp({
        to: input.to,
        subjectCode: input.subjectCode,
        body: input.body,
      });
    case "sms":
      return sendThreadMessageSms({
        to: input.to,
        subjectCode: input.subjectCode,
        body: input.body,
      });
  }
}
