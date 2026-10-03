import { z } from "zod";
import { runOp } from "@/domain/ops/registry";
import { requestMessageOp, requestSendOptionsOp, requestStatusOp } from "@/domain/requests/ops";
import {
  REQUEST_LIST_TABS,
  getRequest,
  listRequests,
  withoutOptionMoney,
} from "@/domain/requests/queries";
import { RequestMessageBody, RequestStatusBody, SendOptionsBody } from "@/domain/requests/schemas";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";
import { redactMessages, redactQuote } from "../redact";

/**
 * Requests (quotes) for the assistant. Contact details, notes and messages
 * are client-written text, so the reads are marked untrusted. Operator
 * cost, markup and dispatcher notes on sourced options need the `money`
 * permission. The writes go through the ops registry: a key that asks
 * before acting gets a 202 whenever the client would hear about it.
 */
export const REQUEST_ROUTES = {
  listRequests: {
    method: "GET",
    path: "/requests",
    operationId: "listRequests",
    summary: "List requests by stage",
    description:
      "Open requests, bookings from the last 14 days and closed requests from the last 30 days, grouped by stage the way the desk sees them. `tab` picks a stage (reply = needs a reply, working, sent = options out, booked, closed, all = everything but closed; default reply). `q` searches the contact's name or email and any leg's city, airport or code. Each group carries its rows with legs and option counts; `tabs` carries the count per stage. At most 200 rows.",
    tag: "Requests",
    scope: "read",
    untrusted: true,
    query: z.object({
      tab: z.enum(REQUEST_LIST_TABS).optional(),
      q: z.string().max(80).optional(),
    }),
    run: async ({ query }) => {
      const list = await listRequests({ tab: query.tab as string | undefined, q: query.q as string | undefined });
      return ok({
        data: list,
        meta: { tab: list.tab, q: list.q, total: list.total, truncated: list.truncated },
      });
    },
  },
  getRequest: {
    method: "GET",
    path: "/requests/{id}",
    operationId: "getRequest",
    summary: "Get one request",
    description:
      "The request with its legs, the linked client (if any) and how many times they have flown, the assigned dispatcher, the message thread, soft holds on aircraft (and other requests' holds on the same aircraft) and the sourced options. Option cost, markup and dispatcher notes are included only with the `money` permission.",
    tag: "Requests",
    scope: "read",
    untrusted: true,
    run: async ({ actor, params }) => {
      const r = await getRequest(params.id);
      if (!r) return err("not_found", "No request with that id.");
      const money = actor.scopes.has("money");
      return ok({
        data: {
          quote: redactQuote(r.quote, money),
          legs: r.legs,
          member: r.member,
          assignee: r.assignee,
          timesFlown: r.timesFlown,
          messages: redactMessages(r.messages),
          holds: r.holds,
          otherHolds: r.otherHolds,
          options: money ? r.sourcedOptions : r.sourcedOptions.map(withoutOptionMoney),
          totalDistanceNm: r.totalDistanceNm,
          longestLegNm: r.longestLegNm,
          stage: r.stage,
          replyDue: r.replyDue,
        },
        meta: { money },
      });
    },
  },
  setRequestStatus: {
    method: "POST",
    path: "/requests/{id}/status",
    operationId: "setRequestStatus",
    summary: "Change a request's stage",
    description:
      "Moves the request to `status` (submitted, triaged, sourcing, options_sent, held, accepted, converted, declined, expired, cancelled). Marking a request held or expired emails the client, so a key that asks before acting gets a 202 for those two and a person decides in Messages › Needs your OK; every other stage changes at once. `reason` is an optional line for the approver.",
    tag: "Requests",
    scope: "desk",
    approval: "conditional",
    body: RequestStatusBody,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof RequestStatusBody>;
      return opRouteOutput(await runOp(requestStatusOp, actor, { id: params.id, ...input }, { reason }));
    },
  },
  postRequestMessage: {
    method: "POST",
    path: "/requests/{id}/messages",
    operationId: "postRequestMessage",
    summary: "Post a message on a request",
    description:
      "Adds an outbound message to the request's thread. `channel` is email, sms or whatsapp (sent to the client), inapp (shown to the client in their account), or call / voicemail (the desk's own note of a conversation; never sent and never needs approval). `toAddress` defaults to the client's email or phone for the channel. `body` is plain text, at most 4000 characters. A key that asks before acting gets a 202 for anything the client would see; a person may edit the text before approving. `reason` is an optional line for the approver. Returns the message id.",
    tag: "Requests",
    scope: "desk",
    approval: "conditional",
    body: RequestMessageBody,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof RequestMessageBody>;
      return opRouteOutput(await runOp(requestMessageOp, actor, { id: params.id, ...input }, { reason }), 201);
    },
  },
  sendRequestOptions: {
    method: "POST",
    path: "/requests/{id}/send-options",
    operationId: "sendRequestOptions",
    summary: "Email the sourced options to the client",
    description:
      "Emails every vetted, priced option on the request to the client as a quote sheet, records the send on the thread, marks those options as sent and moves the request to options_sent when it is still earlier than that. 409 when no option is both vetted and priced; 422 when the request has no client email. Always goes to a person first for a key that asks before acting. `reason` is an optional line for the approver. Returns how many options went, to whom, and whether the email was sent or only queued.",
    tag: "Requests",
    scope: "desk",
    approval: "always",
    body: SendOptionsBody,
    run: async ({ actor, params, body }) => {
      const { reason } = body as z.infer<typeof SendOptionsBody>;
      return opRouteOutput(await runOp(requestSendOptionsOp, actor, { id: params.id }, { reason }));
    },
  },
} satisfies Record<string, RouteDef>;
