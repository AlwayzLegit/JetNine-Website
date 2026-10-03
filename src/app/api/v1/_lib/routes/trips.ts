import { z } from "zod";
import { TRIP_LIST_TABS, getTrip, listTrips, withoutTripMoney } from "@/domain/trips/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { hideAmounts, omit, redactInvoice, redactMessages } from "../redact";

/**
 * Trips (booked flights) for the assistant. Client names, notes and
 * messages are client-written text, so both routes are marked untrusted.
 * What JetNine makes on a trip (revenue, operator cost, margin, card fees)
 * needs the `money` permission.
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
} satisfies Record<string, RouteDef>;
