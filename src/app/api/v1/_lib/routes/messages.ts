import { z } from "zod";
import { inquiryStatusOp, markThreadReadOp, messageRetryOp } from "@/domain/messages/ops";
import {
  getThread,
  listCallNotes,
  listFailedDeliveries,
  listInquiries,
  listThreads,
} from "@/domain/messages/queries";
import { InquiryStatusBody, MessageRetryBody } from "@/domain/messages/schemas";
import { runOp } from "@/domain/ops/registry";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";
import { omit, redactMessages } from "../redact";

/**
 * Messages: texts, emails, notes and call logs, one thread per request,
 * trip or client. Everything here carries client-written text. The writes
 * go through the ops registry: resending a message reaches the client, so
 * a key that asks before acting always gets a 202 for it.
 */

const listThreadsRoute: RouteDef = {
  method: "GET",
  path: "/messages/threads",
  operationId: "listThreads",
  summary: "List message threads",
  description:
    "The 100 most recent threads (one per request, trip or client), newest first, with the last message's preview, whether anything is unread and who to reach. `q` matches the client's name, email or the thread's context line. `meta.unread` counts threads with unread messages before the search.",
  tag: "Messages",
  scope: "read",
  untrusted: true,
  query: z.object({ q: z.string().max(80).optional() }),
  run: async ({ query }) => {
    const list = await listThreads({ q: query.q as string | undefined });
    return ok({ data: list.threads, meta: { unread: list.unread } });
  },
};

const getThreadRoute: RouteDef = {
  method: "GET",
  path: "/messages/threads/{kind}/{id}",
  operationId: "getThread",
  summary: "Get one thread's messages",
  description:
    "Every message on a thread, oldest first. `kind` is quote, trip or member and `id` is that record's id. Delivery status and any provider error come along for outbound messages.",
  tag: "Messages",
  scope: "read",
  untrusted: true,
  run: async ({ params }) => {
    const thread = await getThread(params.kind, params.id);
    return thread
      ? ok({ data: { ...thread, messages: redactMessages(thread.messages) } })
      : err("not_found", "No thread for that kind and id.");
  },
};

const listInquiriesRoute: RouteDef = {
  method: "GET",
  path: "/messages/inquiries",
  operationId: "listInquiries",
  summary: "List website form messages",
  description:
    "Contact-form inquiries, newest first (up to 100). Open ones only unless `show=all`, which includes handled inquiries and who handled them.",
  tag: "Messages",
  scope: "read",
  untrusted: true,
  query: z.object({ show: z.enum(["open", "all"]).optional() }),
  run: async ({ query }) => {
    const rows = await listInquiries({ show: query.show as string | undefined });
    // Who handled it stays a name; teammates' email addresses do not leave.
    return ok({ data: rows.map((r) => ({ ...omit(r, ["handledByEmail"]), handledBy: r.handledByEmail ? "Desk" : null })) });
  },
};

const listFailedDeliveriesRoute: RouteDef = {
  method: "GET",
  path: "/messages/failed",
  operationId: "listFailedDeliveries",
  summary: "List messages that didn't send",
  description: "Outbound texts and emails that failed in the last 7 days (up to 50), with the provider's error.",
  tag: "Messages",
  scope: "read",
  untrusted: true,
  run: async () => ok({ data: await listFailedDeliveries() }),
};

const listCallNotesRoute: RouteDef = {
  method: "GET",
  path: "/messages/calls",
  operationId: "listCallNotes",
  summary: "List call notes",
  description:
    "The phone line's 50 most recent calls with the caller's number, outcome, summary and any message left. Empty when the voice tables are not installed.",
  tag: "Messages",
  scope: "read",
  untrusted: true,
  run: async () => ok({ data: (await listCallNotes()).map((c) => omit(c, ["recording_url"])) }),
};

const retryMessageRoute: RouteDef = {
  method: "POST",
  path: "/messages/{id}/retry",
  operationId: "retryMessage",
  summary: "Resend a message that didn't send",
  description:
    "Sends a failed outbound email, text or WhatsApp message again to the same address and records the new outcome on the message. 409 when the message is inbound, on another channel, has no address or body, or did not fail. Always goes to a person first for a key that asks before acting. `reason` is an optional line for the approver. Returns `status` (sent or failed) with the provider or the provider's error.",
  tag: "Messages",
  scope: "desk",
  approval: "always",
  body: MessageRetryBody,
  run: async ({ actor, params, body }) => {
    const { reason } = body as z.infer<typeof MessageRetryBody>;
    return opRouteOutput(await runOp(messageRetryOp, actor, { id: params.id }, { reason }));
  },
};

const markThreadReadRoute: RouteDef = {
  method: "POST",
  path: "/messages/threads/{kind}/{id}/read",
  operationId: "markThreadRead",
  summary: "Mark a thread read",
  description:
    "Marks every inbound message on the thread read, which clears it from the Unread tab and the sidebar count. `kind` is quote, trip or member and `id` is that record's id. A thread with nothing unread is a no-op. Returns how many messages changed.",
  tag: "Messages",
  scope: "desk",
  approval: "never",
  run: async ({ actor, params }) => opRouteOutput(await runOp(markThreadReadOp, actor, { kind: params.kind, id: params.id })),
};

const setInquiryStatusRoute: RouteDef = {
  method: "POST",
  path: "/messages/inquiries/{id}/status",
  operationId: "setInquiryStatus",
  summary: "Handle or reopen a website message",
  description:
    "`status` handled marks the contact-form inquiry done and records who handled it and when; `status` new reopens it and clears both.",
  tag: "Messages",
  scope: "desk",
  approval: "never",
  body: InquiryStatusBody,
  run: async ({ actor, params, body }) => {
    const input = body as z.infer<typeof InquiryStatusBody>;
    return opRouteOutput(await runOp(inquiryStatusOp, actor, { id: params.id, ...input }));
  },
};

export const MESSAGE_ROUTES = {
  listThreads: listThreadsRoute,
  getThread: getThreadRoute,
  listInquiries: listInquiriesRoute,
  listFailedDeliveries: listFailedDeliveriesRoute,
  listCallNotes: listCallNotesRoute,
  retryMessage: retryMessageRoute,
  markThreadRead: markThreadReadRoute,
  setInquiryStatus: setInquiryStatusRoute,
} satisfies Record<string, RouteDef>;
