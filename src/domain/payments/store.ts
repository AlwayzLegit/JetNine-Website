import { d1Db, dbTarget } from "@/db";
import type { NewReserveTransaction } from "@/db/schema/memberships";
import { d1PaymentStore } from "./store-d1";
import { pgPaymentStore } from "./store-pg";

// The payments domain's one door to the database (OPS-162): every query of the Stripe webhook
// (src/app/api/stripe/webhook/route.ts): the event claim, the invoice turned paid, the reserve
// credits, the membership activation with its tier, and the void on a full refund. There is one
// adapter per database, chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see src/db/target.mjs).
//
// The client's email and the trip code the receipts need are not here: they come from the invoice
// store (OPS-161), which already answers them on both databases.

export type MembershipFacts = {
  id: string;
  memberId: string;
  status: string;
};

export type MembershipForActivation = MembershipFacts & {
  depositUsd: number;
  program: string;
};

/** The invoice a payment turned paid. */
export type PaidInvoiceFacts = {
  id: string;
  invoiceCode: string;
  memberId: string;
  totalUsd: number | null;
  tripId: string | null;
};

/** What the failed-payment mails need about the invoice. */
export type FailedPaymentInvoice = {
  invoiceCode: string;
  memberId: string;
  tripId: string | null;
};

export type VoidedInvoice = { id: string; invoiceCode: string };

export interface PaymentStore {
  /** Record a Stripe event once. True when this call inserted it, false when it was already there. */
  claimEvent(args: { id: string; type: string; payload: Record<string, unknown> }): Promise<boolean>;
  /** When the event was applied; null when it was recorded but not finished (or unknown). */
  eventProcessedAt(id: string): Promise<Date | null>;
  /** Clear the error of a retried event. */
  clearEventError(id: string): Promise<void>;
  /** Stamp the event as applied. */
  markEventProcessed(id: string, at: Date): Promise<void>;
  /** Stamp the error (already cut to 500 characters by the caller). */
  markEventError(id: string, message: string): Promise<void>;

  /** The membership behind a top-up; undefined for none. */
  membershipForTopUp(id: string): Promise<MembershipFacts | undefined>;
  /** The membership behind a purchase, with its deposit and program; undefined for none. */
  membershipForActivation(id: string): Promise<MembershipForActivation | undefined>;
  /**
   * Add one row to the reserve ledger. Throws the unique violation (read it with isUniqueViolation)
   * when the same Stripe payment intent was already credited as a top-up.
   */
  creditLedger(values: NewReserveTransaction): Promise<void>;

  /**
   * Turn the invoice paid: paid_on is today (the UTC day), paid_at `paidAt`, and both Stripe ids
   * stamped. Returns the row, or null for no such invoice.
   */
  markInvoicePaid(args: {
    invoiceId: string;
    paymentIntentId: string | null;
    sessionId: string;
    paidAt: Date;
  }): Promise<PaidInvoiceFacts | null>;
  /** The invoice behind a failed payment; undefined for none. */
  invoiceForFailedPayment(id: string): Promise<FailedPaymentInvoice | undefined>;

  /**
   * Activate the membership and set the member's tier from its program, in one step (one
   * transaction on Postgres, one batch on D1). Throws the unique violation when the member already
   * has another active membership, or when the session or the payment was already used by another
   * membership; nothing is changed then.
   */
  activateMembership(args: {
    id: string;
    memberId: string;
    previousStatus: string;
    paymentIntentId: string | null;
    sessionId: string;
    now: Date;
  }): Promise<void>;

  /** Void the invoice paid with this payment intent. Returns the row, or null for none. */
  voidInvoiceByPaymentIntent(paymentIntentId: string, now: Date): Promise<VoidedInvoice | null>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function paymentStore(): PaymentStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1PaymentStore(client);
  }
  return pgPaymentStore();
}
