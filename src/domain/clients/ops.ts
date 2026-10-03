import { tierWords } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  appendLedgerEntry,
  inviteClient,
  loadClientForLedgerAdd,
  loadForClientInvite,
  signedLedgerAmount,
  type ClientInviteState,
  type ClientLedgerAddState,
} from "./commands";
import { ClientInviteInput, ClientLedgerAddInput, type MemberTier, type ReserveTxKind } from "./schemas";

/**
 * Operations on clients (members). A ledger entry moves the client's money,
 * so an owner decides; an invitation emails the client, so a supervised
 * key's call waits for a person on the desk.
 */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const LEDGER_KIND_WORDS: Record<ReserveTxKind, string> = {
  top_up: "top-up",
  credit_accrual: "credit",
  refund: "refund",
  charter_draw: "charter draw",
  adjustment: "adjustment",
};

/** "an on-demand client", "a JetNine Card · 100 hours client". */
export function inviteTierWords(tier: MemberTier): string {
  return tier === "on_demand" ? "an on-demand client" : `a ${tierWords(tier)} client`;
}

export const clientLedgerAddOp = defineOp<ClientLedgerAddInput, ClientLedgerAddState>({
  id: "client.ledger.add",
  scope: "money",
  schema: ClientLedgerAddInput,
  load: loadClientForLedgerAdd,
  // Every entry changes what the client can draw on: an owner decides.
  risk: () => "money",
  summary: (input, state) =>
    `Add a ${usd.format(signedLedgerAmount(input.kind, input.amount))} ${LEDGER_KIND_WORDS[input.kind]} to ${state.clientName}'s reserve`,
  preview: (input) => (input.description?.trim() ? `Description: ${input.description.trim()}` : null),
  subject: (_input, state) => ({ type: "member", id: state.member.id, code: state.member.memberCode }),
  run: appendLedgerEntry,
  revalidate: (input) => [`/admin/clients/${input.id}`, "/account/members"],
});

export const clientInviteOp = defineOp<ClientInviteInput, ClientInviteState>({
  id: "client.invite",
  scope: "clients",
  schema: ClientInviteInput,
  load: loadForClientInvite,
  // Supabase emails the invitation the moment this runs.
  risk: () => "client",
  summary: (input) => `Invite ${input.email} as ${inviteTierWords(input.tier)}`,
  preview: (input, state) =>
    state.existingAuthUserId
      ? `${input.email} already has a sign-in; this adds their client profile without a new invitation email.`
      : `Sends a sign-in invitation email to ${input.email}.`,
  // The row does not exist yet.
  subject: () => ({ type: "member", id: null, code: null }),
  run: (actor, input) => inviteClient(actor, input),
  // The new client's page has never rendered, so the list is all there is to refresh.
  revalidate: () => ["/admin/clients"],
});

export const CLIENT_OPS: AnyOp[] = [clientLedgerAddOp, clientInviteOp];
