import { requestStage } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  lifecycleEmailGoesOut,
  loadRequestForMessage,
  loadRequestForSendOptions,
  loadRequestForStatus,
  postRequestMessage,
  sendRequestOptions,
  setRequestStatus,
  type RequestMessageState,
  type RequestStatusState,
  type SendOptionsState,
} from "./commands";
import {
  RequestMessageInput,
  RequestStatusInput,
  SendOptionsInput,
  TRANSMITTING_CHANNELS,
  type DeskMessageChannel,
} from "./schemas";

/**
 * Operations on requests (quotes). The risk rule is "does the client hear
 * about this?": a supervised key's call that would email, text or message
 * a client is queued for a person; a desk-side change runs at once.
 */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "an email", "a text" … for the approval card. */
export function channelWords(channel: DeskMessageChannel): string {
  switch (channel) {
    case "email":
      return "an email";
    case "sms":
      return "a text";
    case "whatsapp":
      return "a WhatsApp message";
    case "inapp":
      return "an in-app message";
    case "call":
      return "a call";
    case "voicemail":
      return "a voicemail";
  }
}

/** Email, text, WhatsApp and in-app all reach the client; call and voicemail are the desk's own notes. */
export function clientSeesChannel(channel: DeskMessageChannel): boolean {
  return TRANSMITTING_CHANNELS.has(channel) || channel === "inapp";
}

export function messageSummary(channel: DeskMessageChannel, to: string | null, what: string): string {
  const who = to ?? "the client";
  return clientSeesChannel(channel)
    ? `Send ${channelWords(channel)} to ${who} on ${what}`
    : `Note ${channelWords(channel)} with ${who} on ${what}`;
}

export function messagePreview(to: string | null, body: string): string {
  return to ? `To: ${to}\n${body}` : body;
}

export const requestStatusOp = defineOp<RequestStatusInput, RequestStatusState>({
  id: "request.status",
  scope: "desk",
  schema: RequestStatusInput,
  load: loadRequestForStatus,
  // Exactly when the lifecycle email would go out.
  risk: (input, state) => (lifecycleEmailGoesOut(input, state) ? "client" : null),
  summary: (input, state) => {
    const base = `Mark request ${state.quote.code} as “${requestStage(input.status).label}”`;
    return lifecycleEmailGoesOut(input, state) ? `${base}, which emails ${state.clientEmail}` : base;
  },
  preview: (input, state) => {
    if (!lifecycleEmailGoesOut(input, state)) return null;
    const code = state.quote.code;
    return input.status === "held"
      ? `Email to ${state.clientEmail}: we're holding an aircraft for you on request ${code}.`
      : `Email to ${state.clientEmail}: your request ${code} has expired — want fresh prices?`;
  },
  subject: (_input, state) => ({ type: "quote", id: state.quote.id, code: state.quote.code }),
  run: setRequestStatus,
  revalidate: (input) => ["/admin/requests", `/admin/requests/${input.id}`],
});

export const requestMessageOp = defineOp<RequestMessageInput, RequestMessageState>({
  id: "request.message",
  scope: "desk",
  schema: RequestMessageInput,
  load: loadRequestForMessage,
  risk: (input) => (clientSeesChannel(input.channel) ? "client" : null),
  summary: (input, state) => messageSummary(input.channel, state.finalTo, `request ${state.quote.code}`),
  preview: (input, state) => messagePreview(state.finalTo, input.body),
  subject: (_input, state) => ({ type: "quote", id: state.quote.id, code: state.quote.code }),
  editable: ["body"],
  run: postRequestMessage,
  revalidate: (input) => [`/admin/requests/${input.id}`],
});

export const requestSendOptionsOp = defineOp<SendOptionsInput, SendOptionsState>({
  id: "request.sendOptions",
  scope: "desk",
  schema: SendOptionsInput,
  load: loadRequestForSendOptions,
  risk: () => "client",
  summary: (_input, state) => {
    const n = state.sendable.length;
    return `Email ${n} option${n === 1 ? "" : "s"} to ${state.toEmail} for request ${state.quote.code}`;
  },
  preview: (_input, state) =>
    state.items
      .map((o) => {
        const facts = [o.yearOfMake ? String(o.yearOfMake) : null, o.paxCapacity ? `${o.paxCapacity} seats` : null]
          .filter(Boolean)
          .join(", ");
        return `Option ${o.optionNumber}: ${o.aircraftType ?? "aircraft"}${facts ? ` (${facts})` : ""} — ${usd.format(o.clientPriceUsd)}`;
      })
      .join("\n"),
  subject: (_input, state) => ({ type: "quote", id: state.quote.id, code: state.quote.code }),
  run: sendRequestOptions,
  revalidate: (input) => [`/admin/requests/${input.id}`],
});

export const REQUEST_OPS: AnyOp[] = [requestStatusOp, requestMessageOp, requestSendOptionsOp];
