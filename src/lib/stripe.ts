import "server-only";
import Stripe from "stripe";

/**
 * Stripe client + helpers. Ships dark without `STRIPE_SECRET_KEY` — the
 * pay-now Server Action returns a `STRIPE_NOT_CONFIGURED` error and the
 * webhook handler responds 503 so Stripe retries until the env var lands.
 *
 * Stripe API version is pinned. Bumping it is a deliberate change because
 * payloads can shift between versions; the SDK type-checks against this
 * version too.
 */

const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  _stripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return secret;
}

/**
 * Build the absolute base URL for return / cancel redirects. Stripe
 * requires absolute URLs; we derive from NEXT_PUBLIC_SITE_URL when set,
 * else fall back to the Vercel auto-assigned URL, else localhost.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

type CheckoutInput = {
  invoiceId: string;
  invoiceCode: string;
  totalUsd: number;
  customerEmail: string | null;
  description: string;
};

// Stripe per-line-item `unit_amount` ceiling is 99,999,999 cents
// (~$999,999.99). Ultra-long-range charters can exceed this — a $1.5M
// trip multiplied by 100 cents = 150,000,000, which Stripe rejects as
// `amount_too_large`. The caller catches the throw and returns a
// generic STRIPE_ERROR with no hint that splitting the invoice would
// fix it. We pre-validate against a slightly conservative ceiling
// ($999,999) and surface a typed error so the dispatcher (or the
// /account UI) can route the customer to wire or split the line.
const STRIPE_MAX_LINE_USD = 999_999;

/**
 * `StripeAmountTooLargeError` is thrown by the checkout helpers when
 * the requested amount would exceed Stripe's per-line-item cap. The
 * caller maps this to a typed error response.
 */
export class StripeAmountTooLargeError extends Error {
  constructor(amountUsd: number, maxUsd: number) {
    super(
      `Stripe per-line-item amount exceeds cap: ${amountUsd} > ${maxUsd}. ` +
        `Split into multiple line items or route to wire.`,
    );
    this.name = "StripeAmountTooLargeError";
  }
}

function assertStripeAmountInRange(amountUsd: number): void {
  if (amountUsd > STRIPE_MAX_LINE_USD) {
    throw new StripeAmountTooLargeError(amountUsd, STRIPE_MAX_LINE_USD);
  }
}

/**
 * Create a hosted Stripe Checkout session for the given invoice. Returns
 * the session id + redirect URL. We pass invoiceId in metadata so the
 * webhook can find the row to mark paid without trusting URL params.
 */
export async function createInvoiceCheckoutSession(input: CheckoutInput): Promise<{
  sessionId: string;
  url: string;
}> {
  assertStripeAmountInRange(input.totalUsd);
  const stripe = getStripe();
  const base = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.totalUsd * 100, // invoices store whole USD
          product_data: {
            name: `Invoice ${input.invoiceCode}`,
            description: input.description,
          },
        },
      },
    ],
    client_reference_id: input.invoiceId,
    metadata: {
      kind: "invoice_paid",
      invoice_id: input.invoiceId,
      invoice_code: input.invoiceCode,
    },
    payment_intent_data: {
      metadata: {
        kind: "invoice_paid",
        invoice_id: input.invoiceId,
        invoice_code: input.invoiceCode,
      },
    },
    customer_email: input.customerEmail ?? undefined,
    success_url: `${base}/account/invoices?paid=${input.invoiceId}`,
    cancel_url: `${base}/account/invoices?cancelled=${input.invoiceId}`,
  });

  if (!session.url) {
    throw new Error("Stripe checkout returned no URL");
  }
  return { sessionId: session.id, url: session.url };
}

/**
 * Retrieve an existing Checkout Session by id. Used by the Pay-resume
 * path: when an invoice already carries a real `cs_…` session, we ask
 * Stripe for its current state instead of minting a duplicate (which
 * could double-charge). Returns the lifecycle `status` (`open`,
 * `complete`, `expired`) and the hosted `url` (present while `open`).
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<{
  status: Stripe.Checkout.Session["status"];
  url: string | null;
}> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  return { status: session.status, url: session.url };
}

/**
 * Verify a webhook payload + signature header. Throws if invalid; the
 * route handler converts the throw into a 400 response so Stripe stops
 * retrying corrupt deliveries.
 */
export function constructWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new Error("missing Stripe-Signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
}

type MembershipTopUpInput = {
  memberId: string;
  membershipId: string;
  amountUsd: number;
  customerEmail: string | null;
};

/**
 * Create a Stripe Checkout session for adding funds to an existing
 * Card / Reserve. metadata.kind='membership_topup' so the webhook
 * routes correctly (alongside membership_purchase + invoice_paid).
 */
export async function createMembershipTopUpCheckoutSession(
  input: MembershipTopUpInput,
): Promise<{ sessionId: string; url: string }> {
  assertStripeAmountInRange(input.amountUsd);
  const stripe = getStripe();
  const base = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountUsd * 100,
          product_data: {
            name: "JetNine balance top-up",
            description: "Refundable funds added to your existing membership.",
          },
        },
      },
    ],
    client_reference_id: input.membershipId,
    metadata: {
      kind: "membership_topup",
      membership_id: input.membershipId,
      member_id: input.memberId,
      amount_usd: String(input.amountUsd),
    },
    payment_intent_data: {
      metadata: {
        kind: "membership_topup",
        membership_id: input.membershipId,
        member_id: input.memberId,
        amount_usd: String(input.amountUsd),
      },
    },
    customer_email: input.customerEmail ?? undefined,
    success_url: `${base}/account/memberships?topup=${input.membershipId}`,
    cancel_url: `${base}/account/memberships?cancelled=topup`,
  });

  if (!session.url) throw new Error("Stripe checkout returned no URL");
  return { sessionId: session.id, url: session.url };
}

type MembershipCheckoutInput = {
  membershipId: string;
  program: string;
  programLabel: string;
  depositUsd: number;
  memberId: string;
  customerEmail: string | null;
};

/**
 * Create a Stripe Checkout session for a membership deposit. Mirrors
 * createInvoiceCheckoutSession; the metadata.kind differentiates the
 * two so the webhook can route to the right handler.
 */
export async function createMembershipCheckoutSession(
  input: MembershipCheckoutInput,
): Promise<{ sessionId: string; url: string }> {
  assertStripeAmountInRange(input.depositUsd);
  const stripe = getStripe();
  const base = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.depositUsd * 100,
          product_data: {
            name: input.programLabel,
            description: `Refundable deposit for ${input.programLabel}.`,
          },
        },
      },
    ],
    client_reference_id: input.membershipId,
    metadata: {
      kind: "membership_purchase",
      membership_id: input.membershipId,
      program: input.program,
      member_id: input.memberId,
    },
    payment_intent_data: {
      metadata: {
        kind: "membership_purchase",
        membership_id: input.membershipId,
        program: input.program,
        member_id: input.memberId,
      },
    },
    customer_email: input.customerEmail ?? undefined,
    success_url: `${base}/account/memberships?activated=${input.membershipId}`,
    cancel_url: `${base}/account/memberships?cancelled=${input.membershipId}`,
  });

  if (!session.url) {
    throw new Error("Stripe checkout returned no URL");
  }
  return { sessionId: session.id, url: session.url };
}
