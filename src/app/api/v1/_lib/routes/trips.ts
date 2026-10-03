import { z } from "zod";
import { runOp } from "@/domain/ops/registry";
import { err, ok } from "@/domain/result";
import { tripMessageOp, tripStatusOp } from "@/domain/trips/ops";
import { TRIP_LIST_TABS, getTrip, listTrips, withoutTripMoney } from "@/domain/trips/queries";
import { TripMessageBody, TripStatusBody } from "@/domain/trips/schemas";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";
import { hideAmounts, omit, redactInvoice, redactMessages } from "../redact";

/**
 * Trips (booked flights) for the assistant. Client names, notes and
 * messages are client-written text, so the reads are marked untrusted.
 * What JetNine makes on a trip (revenue, operator cost, margin, card fees)
 * needs the `money` permission. The writes go through the ops registry:
 * a key that asks before acting gets a 202 when the client would see it
 * or money would move.
 */
export const TRIP_ROUTES = {
  listTrips: {
    method: "GET",
    path: "/trips",
    operationId: "listTrips",
    summary: "List trips",
    description:
      "The 100 newest trips, split into upcoming and flown by the first leg's day (Los Angeles calendar) and status, grouped the way the desk sees them: next 30 days / later, or flown in the last 90 days / earlier. `tab` is upcoming (default), past or all. `q` searches the client's name or email and the legs' cities. `flyingToday` lists upcoming trips flying today. Each row carries plain-word route, aircraft and to-do lines plus the first leg's facts.",
    tag: "Trips",
    scope: "read",
    untrusted: true,
    query: z.object({
      tab: z.enum(TRIP_LIST_TABS).optional(),
      q: z.string().max(80).optional(),
    }),
    run: async ({ actor, query }) => {
      const list = await listTrips({ tab: query.tab as string | undefined, q: query.q as string | undefined });
      const money = actor.scopes.has("money");
      const scrub = <T extends { todo: string; invoice: { totalUsd: number | null } | null }>(it: T): T =>
        money ? it : { ...it, todo: hideAmounts(it.todo), invoice: it.invoice ? omit(it.invoice, ["totalUsd"]) : null };
      return ok({
        data: {
          today: list.today,
          groups: list.groups.map((g) => ({ ...g, items: g.items.map(scrub) })),
          flyingToday: list.flyingToday.map(scrub),
          counts: list.counts,
        },
        meta: { tab: list.tab, q: list.q, total: list.items.length },
      });
    },
  },
  getTrip: {
    method: "GET",
    path: "/trips/{id}",
    operationId: "getTrip",
    summary: "Get one trip",
    description:
      "The trip with its legs, the client, the invoice, the request it came from, the aircraft and operator (or the option the client picked when the trip has no aircraft yet) and the message thread. Revenue, operator cost, margin and card fees are included only with the `money` permission.",
    tag: "Trips",
    scope: "read",
    untrusted: true,
    run: async ({ actor, params }) => {
      const t = await getTrip(params.id);
      if (!t) return err("not_found", "No trip with that id.");
      const money = actor.scopes.has("money");
      return ok({
        data: {
          ...t,
          trip: money ? t.trip : withoutTripMoney(t.trip),
          invoice: t.invoice ? redactInvoice(t.invoice, money) : null,
          messages: redactMessages(t.messages),
        },
        meta: { money },
      });
    },
  },
  postTripMessage: {
    method: "POST",
    path: "/trips/{id}/messages",
    operationId: "postTripMessage",
    summary: "Post a message on a trip",
    description:
      "Adds an outbound message to the trip's thread. `channel` is email, sms or whatsapp (sent to the client), inapp (shown to the client in their account), or call / voicemail (the desk's own note of a conversation; never sent and never needs approval). `toAddress` defaults to the client's email or phone for the channel. `body` is plain text, at most 4000 characters. A key that asks before acting gets a 202 for anything the client would see; a person may edit the text before approving. `reason` is an optional line for the approver. Returns the message id.",
    tag: "Trips",
    scope: "desk",
    approval: "conditional",
    body: TripMessageBody,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof TripMessageBody>;
      return opRouteOutput(await runOp(tripMessageOp, actor, { id: params.id, ...input }, { reason }), 201);
    },
  },
  setTripStatus: {
    method: "POST",
    path: "/trips/{id}/status",
    operationId: "setTripStatus",
    summary: "Change a trip's status",
    description:
      "Moves the trip to `status` (draft, confirmed, crew_briefed, boarding, airborne, wheels_down, completed, cancelled_wx, cancelled_other, diverted, irregular_ops). Airborne stamps wheels-up; wheels_down and completed stamp wheels-down. Cancelling (cancelled_wx or cancelled_other) refunds the client — every reserve draw and card payment on the trip — and emails them; confirmed, boarding, completed, diverted and irregular_ops email the client (and text them if they opted in). So a key that asks before acting gets a 202 for a cancellation (an owner decides) or a client-facing milestone (anyone on the desk decides) when the status actually changes; the other statuses, and a repeat of the current one, change at once. `reason` is an optional line for the approver.",
    tag: "Trips",
    scope: "desk",
    approval: "conditional",
    body: TripStatusBody,
    run: async ({ actor, params, body }) => {
      const { reason, ...input } = body as z.infer<typeof TripStatusBody>;
      return opRouteOutput(await runOp(tripStatusOp, actor, { id: params.id, ...input }, { reason }));
    },
  },
} satisfies Record<string, RouteDef>;
