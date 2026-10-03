import { z } from "zod";
import {
  REQUEST_LIST_TABS,
  getRequest,
  listRequests,
  withoutOptionMoney,
} from "@/domain/requests/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * Requests (quotes) for the assistant. Contact details, notes and messages
 * are client-written text, so both routes are marked untrusted. Operator
 * cost, markup and dispatcher notes on sourced options need the `money`
 * permission.
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
          quote: r.quote,
          legs: r.legs,
          member: r.member,
          assignee: r.assignee,
          timesFlown: r.timesFlown,
          messages: r.messages,
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
} satisfies Record<string, RouteDef>;
