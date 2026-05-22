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

/**
 * Create a hosted Stripe Checkout session for the given invoice. Returns
 * the session id + redirect URL. We pass invoiceId in metadata so the
 * webhook can find the row to mark paid without trusting URL params.
 */
export async function createInvoiceCheckoutSession(input: CheckoutInput): Promise<{
  sessionId: string;
  url: string;
}> {
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
      invoice_id: input.invoiceId,
      invoice_code: input.invoiceCode,
    },
    payment_intent_data: {
      metadata: {
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
 * Verify a webhook payload + signature header. Throws if invalid; the
 * route handler converts the throw into a 400 response so Stripe stops
 * retrying corrupt deliveries.
 */
export function constructWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new Error("missing Stripe-Signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
}
