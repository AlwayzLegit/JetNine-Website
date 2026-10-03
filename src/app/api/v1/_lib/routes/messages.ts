import { z } from "zod";
import {
  getThread,
  listCallNotes,
  listFailedDeliveries,
  listInquiries,
  listThreads,
} from "@/domain/messages/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * Messages: texts, emails, notes and call logs, one thread per request,
 * trip or client. Everything here carries client-written text.
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
    return thread ? ok({ data: thread }) : err("not_found", "No thread for that kind and id.");
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
  run: async ({ query }) => ok({ data: await listInquiries({ show: query.show as string | undefined }) }),
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
  run: async () => ok({ data: await listCallNotes() }),
};

export const MESSAGE_ROUTES = {
  listThreads: listThreadsRoute,
  getThread: getThreadRoute,
  listInquiries: listInquiriesRoute,
  listFailedDeliveries: listFailedDeliveriesRoute,
  listCallNotes: listCallNotesRoute,
} satisfies Record<string, RouteDef>;
