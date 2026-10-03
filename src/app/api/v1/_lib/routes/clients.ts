import { z } from "zod";
import { clientInviteOp, clientLedgerAddOp } from "@/domain/clients/ops";
import { CLIENT_TABS, getClient, listClients } from "@/domain/clients/queries";
import { ClientInviteBody, ClientLedgerAddBody } from "@/domain/clients/schemas";
import { runOp } from "@/domain/ops/registry";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";
import { dropMoney, hideAmounts, omit, redactInvoice, redactMembership } from "../redact";

/**
 * Clients (members). Money (lifetime billing, trip revenue, invoice totals)
 * only shows for keys with the "money" scope. The writes go through the
 * ops registry: a ledger entry needs `money` and an owner's OK for a key
 * that asks before acting; an invitation needs `clients` and a person's OK,
 * since it emails the client.
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
      money
        ? { ...facts, row }
        : {
            ...dropMoney(facts),
            row: { ...row, spent: "—", memberNote: hideAmounts(row.memberNote), membership: hideAmounts(row.membership) },
          },
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
    const money = actor.scopes.has("money");
    const base = {
      ...client,
      programs: client.programs.map((m) => redactMembership(m, money)),
      activeProgram: client.activeProgram ? redactMembership(client.activeProgram, money) : null,
      invoices: client.invoices.map((i) => redactInvoice(i, money)),
    };
    if (money) return ok({ data: base });
    return ok({
      data: {
        ...omit(base, ["lifetimeInvoiced", "balance"]),
        trips: base.trips.map(dropMoney),
        upcoming: base.upcoming ? dropMoney(base.upcoming) : null,
        ledger: base.ledger.map(dropMoney),
      },
    });
  },
};

const inviteClientRoute: RouteDef = {
  method: "POST",
  path: "/clients",
  operationId: "inviteClient",
  summary: "Invite a new client",
  description:
    "Creates a client profile for `email` and, when they have no sign-in yet, has Supabase email them an invitation to set one up. `firstName`, `lastName`, `phoneE164` (+15551234567) and `companyName` are optional; `tier` defaults to on_demand. Needs the `clients` permission. 409 when a client is already on file for that email; 503 when the invitation could not be sent. Always goes to a person first for a key that asks before acting. `reason` is an optional line for the approver. Returns the new client's id and member code, their user id and whether a sign-in was created.",
  tag: "Clients",
  scope: "clients",
  approval: "always",
  body: ClientInviteBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof ClientInviteBody>;
    return opRouteOutput(await runOp(clientInviteOp, actor, input, { reason }), 201);
  },
};

const addClientLedgerEntryRoute: RouteDef = {
  method: "POST",
  path: "/clients/{id}/ledger",
  operationId: "addClientLedgerEntry",
  summary: "Add a reserve ledger entry",
  description:
    "Appends an entry to the client's reserve ledger. `kind` is top_up, credit_accrual or refund (money in), charter_draw (money out) or adjustment (either way); `amount` is whole dollars, the magnitude for every kind but adjustment, which takes the signed value. Up to five million dollars. `description` defaults to \"<kind> via dispatch\". The entry attributes to the client's active membership when they have one. Needs the `money` permission. 404 when no client has that id. Always goes to an owner first for a key that asks before acting. `reason` is an optional line for the approver. Returns the entry id, the signed amount and the client's new balance.",
  tag: "Clients",
  scope: "money",
  approval: "always",
  body: ClientLedgerAddBody,
  successStatus: 201,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof ClientLedgerAddBody>;
    return opRouteOutput(await runOp(clientLedgerAddOp, actor, { id: params.id, ...input }, { reason }), 201);
  },
};

export const CLIENT_ROUTES = {
  listClients: listClientsRoute,
  inviteClient: inviteClientRoute,
  getClient: getClientRoute,
  addClientLedgerEntry: addClientLedgerEntryRoute,
} satisfies Record<string, RouteDef>;
