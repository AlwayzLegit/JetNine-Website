import { z } from "zod";
import { runOp } from "@/domain/ops/registry";
import {
  requestAssignOp,
  requestConvertOp,
  requestHoldCreateOp,
  requestHoldReleaseOp,
  requestLinkClientOp,
  requestMessageOp,
  requestOptionAddOp,
  requestOptionChooseOp,
  requestOptionRemoveOp,
  requestOptionUpdateOp,
  requestSendOptionsOp,
  requestStatusOp,
} from "@/domain/requests/ops";
import {
  REQUEST_LIST_TABS,
  getRequest,
  listRequests,
  withoutOptionMoney,
} from "@/domain/requests/queries";
import {
  HoldCreateBody,
  OptionAddBody,
  OptionRefBody,
  OptionUpdateBody,
  RequestAssignBody,
  RequestConvertBody,
  RequestLinkClientBody,
  RequestMessageBody,
  RequestStatusBody,
  SendOptionsBody,
} from "@/domain/requests/schemas";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";
import { redactMessages, redactQuote } from "../redact";

/**
 * Requests (quotes) for the assistant. Contact details, notes and messages
 * are client-written text, so the reads are marked untrusted. Operator
 * cost, markup and dispatcher notes on sourced options need the `money`
 * permission. The writes go through the ops registry: a key that asks
 * before acting gets a 202 whenever the client would hear about it;
 * desk-side changes (assignment, client link, holds, options) run at once.
 * Booking a request (convert) moves money and needs the `money` permission.
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
  assignRequest: {
    method: "PATCH",
    path: "/requests/{id}/assignee",
    operationId: "assignRequest",
    summary: "Assign a request to a dispatcher",
    description:
      "Sets who on the desk owns the request. `staffId` is a dispatcher's staff id (see the request's `assignee`, or the team list), or null to leave it unassigned. 422 when no dispatcher has that id. Nothing reaches the client, so this never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    body: RequestAssignBody,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof RequestAssignBody>;
      return opRouteOutput(await runOp(requestAssignOp, actor, { id: params.id, ...input }, { reason }));
    },
  },
  linkRequestClient: {
    method: "PATCH",
    path: "/requests/{id}/client",
    operationId: "linkRequestClient",
    summary: "Link a request to a client",
    description:
      "Links the request to a client account (`memberId`), or unlinks it with null. Needs the `clients` permission. 409 once the request has been converted to a trip: the trip and invoice already carry the client. 422 when no client has that id. Returns the client's member code. Nothing reaches the client, so this never waits for approval.",
    tag: "Requests",
    scope: "clients",
    approval: "never",
    body: RequestLinkClientBody,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof RequestLinkClientBody>;
      return opRouteOutput(await runOp(requestLinkClientOp, actor, { id: params.id, ...input }, { reason }));
    },
  },
  createRequestHold: {
    method: "POST",
    path: "/requests/{id}/holds",
    operationId: "createRequestHold",
    summary: "Soft-hold an aircraft for a request",
    description:
      "Puts a soft hold on `aircraftId` for this request, from the first leg's departure to four hours after the last leg's. Several requests may hold the same aircraft; a person resolves the conflict when one is booked. 409 when the request is already accepted, declined, expired, cancelled or converted, when the aircraft is sold, when the legs have no usable date, or when this request already holds this aircraft. Returns the hold's `blockId` and when it ends. Never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    body: HoldCreateBody,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof HoldCreateBody>;
      return opRouteOutput(await runOp(requestHoldCreateOp, actor, { id: params.id, ...input }, { reason }), 201);
    },
  },
  releaseRequestHold: {
    method: "DELETE",
    path: "/requests/{id}/holds/{blockId}",
    operationId: "releaseRequestHold",
    summary: "Release a soft hold",
    description:
      "Removes one of this request's soft holds (`blockId` from the request's `holds`). 404 when the hold does not exist; 409 when the block is not a soft hold on this request. Never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    run: async ({ actor, params }) =>
      opRouteOutput(await runOp(requestHoldReleaseOp, actor, { id: params.id, blockId: params.blockId })),
  },
  addRequestOption: {
    method: "POST",
    path: "/requests/{id}/options",
    operationId: "addRequestOption",
    summary: "Add a sourced option",
    description:
      "Adds an airframe option to the request, numbered after the last one. Every field is optional. `operatorNameRaw` is matched against the operators list: a matched, vetted operator passes the safety floor; an unmatched or ineligible one leaves the option unsendable until a person screens it. `operatorCostUsd`, `markupType`, `markupValue` and `dispatcherNotes` need the `money` permission (403 otherwise); the client price is cost plus markup (percent, default 12, or flat dollars). Returns the option id and number. Never waits for approval; the client only hears about options through send-options.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    body: OptionAddBody,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof OptionAddBody>;
      return opRouteOutput(await runOp(requestOptionAddOp, actor, { id: params.id, ...input }, { reason }), 201);
    },
  },
  updateRequestOption: {
    method: "PATCH",
    path: "/requests/{id}/options/{optionId}",
    operationId: "updateRequestOption",
    summary: "Update a sourced option",
    description:
      "Changes an option on this request; fields left out keep their value, and the operator match, safety floor and client price are worked out again from the result. `operatorCostUsd`, `markupType`, `markupValue` and `dispatcherNotes` need the `money` permission (403 otherwise). 404 when the option is not on this request. Never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    body: OptionUpdateBody,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof OptionUpdateBody>;
      return opRouteOutput(
        await runOp(requestOptionUpdateOp, actor, { id: params.id, optionId: params.optionId, ...input }, { reason }),
      );
    },
  },
  chooseRequestOption: {
    method: "POST",
    path: "/requests/{id}/options/{optionId}/choose",
    operationId: "chooseRequestOption",
    summary: "Choose the option the client is taking",
    description:
      "Marks one option as the chosen one (any other choice on the request is cleared) and shortlists it; the chosen option prices the trip and invoice when the request is converted. 409 when the operator is unmatched or fails the safety floor, or when the option has no client price yet. 404 when the option is not on this request. Never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    body: OptionRefBody,
    run: async ({ actor, params, body }) => {
      const { reason } = (body ?? {}) as z.infer<typeof OptionRefBody>;
      return opRouteOutput(await runOp(requestOptionChooseOp, actor, { id: params.id, optionId: params.optionId }, { reason }));
    },
  },
  removeRequestOption: {
    method: "DELETE",
    path: "/requests/{id}/options/{optionId}",
    operationId: "removeRequestOption",
    summary: "Remove a sourced option",
    description: "Deletes an option from this request. 404 when the option is not on this request. Never waits for approval.",
    tag: "Requests",
    scope: "desk",
    approval: "never",
    run: async ({ actor, params }) =>
      opRouteOutput(await runOp(requestOptionRemoveOp, actor, { id: params.id, optionId: params.optionId })),
  },
  convertRequest: {
    method: "POST",
    path: "/requests/{id}/convert",
    operationId: "convertRequest",
    summary: "Book a request as a trip",
    description:
      "Converts the request into a confirmed trip with its legs and opens the invoice, priced from the chosen option (or the indicative midpoint when none is chosen) plus 7.5% FET and the segment fee. When the client holds a Card or Reserve with enough balance the invoice is drawn from it at once and marked paid; otherwise it stays a draft for the desk to review and finalize. Releases the request's soft holds, marks it converted and emails the client a booking confirmation. Needs the `money` permission. 409 when the request is already converted or is cancelled, expired or declined; 422 when no client is linked or the request has no legs. Always goes to an owner first for a key that asks before acting. `reason` is an optional line for the approver. Returns the trip id and code and the invoice id.",
    tag: "Requests",
    scope: "money",
    approval: "always",
    body: RequestConvertBody,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const { reason } = (body ?? {}) as z.infer<typeof RequestConvertBody>;
      return opRouteOutput(await runOp(requestConvertOp, actor, { id: params.id }, { reason }), 201);
    },
  },
} satisfies Record<string, RouteDef>;
