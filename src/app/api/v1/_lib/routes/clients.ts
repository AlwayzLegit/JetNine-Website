import { z } from "zod";
import { CLIENT_TABS, getClient, listClients } from "@/domain/clients/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * Clients (members). Money (lifetime billing, trip revenue, invoice totals)
 * only shows for keys with the "money" scope.
 */

const listClientsRoute: RouteDef = {
  method: "GET",
  path: "/clients",
  operationId: "listClients",
  summary: "List clients",
  description:
    "Up to 200 clients, by last name, with their membership, flight count, last and next flight, open requests and reserve balance. `tab` narrows to who flew in the last 90 days (recent), Card or Reserve holders (card) or clients with no trips yet (new); `q` searches names, emails and company. `meta.counts` has every tab's size. `lifetimeUsd` needs the money scope.",
  tag: "Clients",
  scope: "read",
  untrusted: true,
  query: z.object({
    tab: z.enum(CLIENT_TABS).optional(),
    q: z.string().max(80).optional(),
  }),
  run: async ({ actor, query }) => {
    const list = await listClients({ tab: query.tab as string | undefined, q: query.q as string | undefined });
    const money = actor.scopes.has("money");
    const data = list.clients.map(({ row, ...facts }) =>
      money ? { ...facts, row } : { ...facts, lifetimeUsd: null, row: { ...row, spent: "—" } },
    );
    return ok({ data, meta: { tab: list.tab, q: list.q, total: list.total, counts: list.counts } });
  },
};

const getClientRoute: RouteDef = {
  method: "GET",
  path: "/clients/{id}",
  operationId: "getClient",
  summary: "Get one client",
  description:
    "Everything the client page shows: profile, preferences, companions (names only — no birth dates or known-traveller numbers), usual routes, membership and reserve ledger, recent trips, requests and invoices. Trip revenue, invoice totals and billed-to-date need the money scope.",
  tag: "Clients",
  scope: "read",
  untrusted: true,
  run: async ({ actor, params }) => {
    const client = await getClient(params.id);
    if (!client) return err("not_found", "No client with that id.");
    if (actor.scopes.has("money")) return ok({ data: client });
    return ok({
      data: {
        ...omit(client, ["lifetimeInvoiced"]),
        trips: client.trips.map((t) => omit(t, ["revenueUsd"])),
        upcoming: client.upcoming ? omit(client.upcoming, ["revenueUsd"]) : null,
        invoices: client.invoices.map((i) => omit(i, ["totalUsd"])),
      },
    });
  },
};

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

export const CLIENT_ROUTES = {
  listClients: listClientsRoute,
  getClient: getClientRoute,
} satisfies Record<string, RouteDef>;
