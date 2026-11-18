import { d1Db, dbTarget } from "@/db";
import type { Invoice } from "@/db/schema/invoices";
import { d1InvoiceStore } from "./store-d1";
import { pgInvoiceStore } from "./store-pg";

// The invoices domain's one door to the database outside the Stripe webhook (OPS-161): the
// cancel refunds and the invoice editor of src/domain/trips/commands.ts, the invoice watch cron
// (src/app/api/cron/invoice-watch/route.ts), and the client's invoice page and pay button
// (src/app/account/invoices/page.tsx and actions.ts). There is one adapter per database, chosen
// per request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging
// first; the code refuses "d1" in production, see src/db/target.mjs).
//
// Not in this store, on purpose: the Stripe webhook (src/app/api/stripe/webhook/route.ts, the
// next row, OPS-162), and convert to trip with its reserve draw (OPS-157, the request store).

/**
 * How long a Checkout claim counts as in flight before another tab may take it over. The
 * Postgres adapter spells the same 30 minutes as `interval '30 minutes'` in SQL; the D1 adapter
 * compares against the instant the caller passes (see claimCheckout). Keep the two the same.
 */
export const CHECKOUT_CLAIM_TTL_MS = 30 * 60 * 1000;

/** A client's email and first name; null when the member has no email. */
export type MemberContact = { email: string; firstName: string | null };

/** A charter draw on the reserve ledger that has no refund yet (stored as a negative amount). */
export type DrawRow = {
  id: string;
  memberId: string;
  membershipId: string | null;
  amountUsd: number;
  invoiceId: string | null;
};

/** One refund row to post on the reserve ledger. The store adds the trip and the kind "refund". */
export type RefundRow = {
  memberId: string;
  membershipId: string | null;
  amountUsd: number;
  description: string;
  invoiceId: string | null;
};

/** A paid invoice of a trip, for the card refund. */
export type PaidInvoiceRow = {
  id: string;
  invoiceCode: string;
  memberId: string;
  totalUsd: number | null;
  stripePaymentIntentId: string | null;
};

/** What the invoice editor writes on a draft. `dueOn` and `status` are left out when unchanged. */
export type DraftInvoicePatch = {
  subtotalUsd: number | null;
  fetUsd: number | null;
  segmentFeeUsd: number | null;
  totalUsd: number | null;
  notes: string | null;
  dueOn?: string;
  status?: "due";
};

/** An invoice the dunning cron claimed. */
export type ClaimedInvoice = {
  id: string;
  invoiceCode: string;
  memberId: string;
  totalUsd: number | null;
  dueOn: string | null;
  tripId: string | null;
};

/** One row of the client's invoice list. */
export type AccountInvoiceRow = {
  id: string;
  invoiceCode: string;
  kind: string;
  status: string;
  issuedOn: string;
  dueOn: string | null;
  paidOn: string | null;
  subtotalUsd: number | null;
  fetUsd: number | null;
  segmentFeeUsd: number | null;
  totalUsd: number | null;
  tripId: string | null;
  tripCode: string | null;
};

export type RouteLegRow = {
  tripId: string;
  legNumber: number;
  fromCity: string | null;
  fromIata: string | null;
  toCity: string | null;
  toIata: string | null;
};

/** An invoice with the user who owns it (through the member), for the pay button's checks. */
export type InvoiceWithOwner = {
  id: string;
  invoiceCode: string;
  status: string;
  totalUsd: number | null;
  memberId: string;
  memberUserId: string | null;
};

export interface InvoiceStore {
  /** The client's email and first name behind a member id; null for none or when there is no email. */
  memberContact(memberId: string): Promise<MemberContact | null>;
  /** A trip's code; null for no such trip. */
  tripCode(tripId: string): Promise<string | null>;

  /** The trip's charter draws that have no matching refund yet (matched on trip and invoice, null-safe). */
  unrefundedDraws(tripId: string): Promise<DrawRow[]>;
  /**
   * Post the refunds on the reserve ledger and void the linked invoices with `note` added on a
   * new line of their notes, all or nothing. Throws the unique violation (read it with
   * isUniqueViolation) when a refund for one of these draws is already there: a racing cancel won.
   */
  postDrawRefunds(args: { tripId: string; refunds: RefundRow[]; voidInvoiceIds: string[]; note: string }): Promise<void>;
  /** The trip's paid invoices. */
  paidInvoicesOfTrip(tripId: string): Promise<PaidInvoiceRow[]>;
  /** Void an invoice, only while it is still paid. */
  voidPaidInvoice(id: string): Promise<void>;

  /** One invoice, all columns; undefined for none. */
  invoiceById(id: string): Promise<Invoice | undefined>;
  /** Write the figures to a draft invoice, only while it is still a draft. True when it wrote. */
  updateDraftInvoice(id: string, patch: DraftInvoicePatch): Promise<boolean>;

  /**
   * Turn due invoices that are past `today` and not yet notified into overdue, stamping them,
   * oldest due date first, at most `limit`. Returns the rows it claimed. `today` is the UTC
   * date "YYYY-MM-DD" (the Postgres adapter reads current_date in SQL).
   */
  claimOverdue(args: { today: string; limit: number; now: Date }): Promise<ClaimedInvoice[]>;
  /** Stamp the reminder on due invoices due from `today` to `until` (both "YYYY-MM-DD"), at most `limit`. */
  claimDueSoon(args: { today: string; until: string; limit: number; now: Date }): Promise<ClaimedInvoice[]>;

  /** The client's newest invoices (at most `limit`) with the trip's code. */
  memberInvoices(memberId: string, limit: number): Promise<AccountInvoiceRow[]>;
  /** The legs of these trips by trip and leg number, for the route words. */
  tripRouteLegs(tripIds: string[]): Promise<RouteLegRow[]>;

  /** The invoice with its member's user id; undefined for none. */
  invoiceWithOwner(id: string): Promise<InvoiceWithOwner | undefined>;
  /**
   * Claim the invoice for Checkout: stamp `token` as its session id, only while it is due or
   * overdue, the member's own, and has no session or one not touched since `staleBeforeMs`.
   * True when this call won the claim.
   */
  claimCheckout(args: { id: string; memberId: string; token: string; staleBeforeMs: number }): Promise<boolean>;
  /** Clear the session id, only while it still equals `token` (a failed Stripe call gives the claim back). */
  releaseCheckout(id: string, token: string): Promise<void>;
  /** Replace the claim token with the real session id, only while the claim is still ours. */
  stampCheckout(id: string, token: string, sessionId: string): Promise<void>;
  /** The invoice's session id and status; undefined for none. */
  checkoutState(id: string): Promise<{ sessionId: string | null; status: string } | undefined>;
  /** Clear a session id that Stripe says is expired, only while it still equals `sessionId`. */
  clearCheckout(id: string, sessionId: string): Promise<void>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function invoiceStore(): InvoiceStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1InvoiceStore(client);
  }
  return pgInvoiceStore();
}
