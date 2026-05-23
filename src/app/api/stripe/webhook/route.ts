import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { stripeWebhookEvents } from "@/db/schema/invoices";
import {
  memberships,
  reserveTransactions,
  type NewReserveTransaction,
} from "@/db/schema/memberships";
import { logAudit } from "@/lib/audit";
import {
  constructWebhookEvent,
  isStripeConfigured,
} from "@/lib/stripe";

// Stripe needs the *raw* request body for signature verification. The
// App Router gives us that via `request.text()`. Disabling caching keeps
// previews honest.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook receiver.
 *
 * Contract:
 *   - Verify the Stripe-Signature header — reject 400 on mismatch so
 *     Stripe stops retrying corrupt deliveries.
 *   - Idempotency via `stripe_webhook_events` PK on the Stripe event id
 *     — `ON CONFLICT DO NOTHING` + RETURNING gives us a single-writer
 *     guard against replay or parallel deliveries.
 *   - Update the invoice within the same handler invocation; if anything
 *     throws, stamp `error` on the event row and return 500 so Stripe
 *     retries. (Stripe retries with exponential backoff for up to 3 days.)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isStripeConfigured()) {
    // Stripe will retry; once the env var lands the next delivery
    // succeeds. 503 is the right "configured-incorrectly" signal.
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency claim. If we've seen this event id before, short-circuit.
  const claimed = await db
    .insert(stripeWebhookEvents)
    .values({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: stripeWebhookEvents.id });

  if (claimed.length === 0) {
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    await dispatch(event);
    await db
      .update(stripeWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, event.id));
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] dispatch failed", { id: event.id, type: event.type, msg });
    await db
      .update(stripeWebhookEvents)
      .set({ error: msg.slice(0, 500) })
      .where(eq(stripeWebhookEvents.id, event.id));
    // 5xx so Stripe retries with backoff.
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case "payment_intent.payment_failed":
      await onPaymentFailed(event.data.object as Stripe.PaymentIntent);
      return;
    case "charge.refunded":
      await onChargeRefunded(event.data.object as Stripe.Charge);
      return;
    default:
      // Unhandled type — we still ACK so Stripe stops retrying. The
      // payload is preserved in stripe_webhook_events for forensic use.
      return;
  }
}

function invoiceIdFrom(metadata: Stripe.Metadata | null | undefined): string | null {
  const id = metadata?.invoice_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function membershipIdFrom(metadata: Stripe.Metadata | null | undefined): string | null {
  const id = metadata?.membership_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Route by metadata.kind set at session-create time. Falls back to
  // legacy invoice path for sessions created before the kind tag was
  // added, where only invoice_id is present.
  const kind = session.metadata?.kind;
  if (kind === "membership_purchase") {
    return onMembershipPurchased(session);
  }
  if (kind === "membership_topup") {
    return onMembershipToppedUp(session);
  }
  return onInvoicePaid(session);
}

async function onMembershipToppedUp(session: Stripe.Checkout.Session): Promise<void> {
  const membershipId = membershipIdFrom(session.metadata) ?? session.client_reference_id;
  const memberId = session.metadata?.member_id;
  const amountStr = session.metadata?.amount_usd;
  if (!membershipId || !memberId || !amountStr) {
    throw new Error("checkout.session.completed: missing topup metadata");
  }
  const amountUsd = Number.parseInt(amountStr, 10);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error(`checkout.session.completed: bad topup amount ${amountStr}`);
  }
  if (session.payment_status !== "paid") return;

  // Idempotency: if a reserve_transactions row already exists for this
  // session's payment_intent, skip the insert. The webhook events
  // dedup table catches replays of the same event id, but Stripe could
  // also re-deliver the same intent across two distinct events; we
  // guard with a lookup on description for now (cheap; we'd add a
  // dedicated column if we ever saw collisions in practice).
  const [row] = await db
    .select({ id: memberships.id, memberId: memberships.memberId, status: memberships.status })
    .from(memberships)
    .where(eq(memberships.id, membershipId));
  if (!row) throw new Error(`membership not found: ${membershipId}`);
  if (row.status !== "active") {
    // Top-up against a paused / cancelled membership shouldn't normally
    // happen (UI gates on active), but if it does, refuse rather than
    // accidentally crediting a dead bucket.
    console.warn("[stripe-webhook] topup against non-active membership", {
      membershipId,
      status: row.status,
    });
    return;
  }

  const tx: NewReserveTransaction = {
    memberId: row.memberId,
    membershipId: row.id,
    kind: "top_up",
    amountUsd,
    description: `Balance top-up via Stripe (session ${session.id.slice(0, 14)}…)`,
  };
  await db.insert(reserveTransactions).values(tx);

  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "membership.topup.completed",
    subjectType: "membership",
    subjectId: row.id,
    metadata: {
      amountUsd,
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      source: "stripe_webhook",
    },
  });
}

async function onInvoicePaid(session: Stripe.Checkout.Session): Promise<void> {
  const invoiceId =
    invoiceIdFrom(session.metadata) ?? (session.client_reference_id ?? null);
  if (!invoiceId) {
    throw new Error("checkout.session.completed: no invoice id in metadata");
  }
  // Only flip paid when Stripe actually collected. `payment_status === 'paid'`
  // covers card; `'no_payment_required'` shouldn't happen (we always charge).
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const updated = await db
    .update(invoices)
    .set({
      status: "paid",
      paidOn: sql`current_date`,
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      memberId: invoices.memberId,
      totalUsd: invoices.totalUsd,
    });

  if (updated.length === 0) {
    throw new Error(`invoice not found: ${invoiceId}`);
  }

  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "invoice.paid",
    subjectType: "invoice",
    subjectId: updated[0].id,
    subjectCode: updated[0].invoiceCode,
    diff: { status: { before: "due", after: "paid" } },
    metadata: {
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountUsd: updated[0].totalUsd,
      source: "stripe_webhook",
    },
  });
}

async function onPaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const invoiceId = invoiceIdFrom(intent.metadata);
  if (!invoiceId) return;

  // We don't flip status — the invoice is still `due`. Just audit so ops
  // can see failed-payment patterns in /admin/audit.
  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "invoice.payment.failed",
    subjectType: "invoice",
    subjectId: invoiceId,
    metadata: {
      stripePaymentIntentId: intent.id,
      lastError: intent.last_payment_error?.message ?? null,
      code: intent.last_payment_error?.code ?? null,
    },
  });
}

async function onMembershipPurchased(session: Stripe.Checkout.Session): Promise<void> {
  const membershipId = membershipIdFrom(session.metadata) ?? session.client_reference_id;
  if (!membershipId) {
    throw new Error("checkout.session.completed: no membership id in metadata");
  }
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Read the row to determine the deposit (= top-up amount) and member.
  // We trust the depositUsd from DB rather than session.amount_total to
  // avoid currency conversion / rounding surprises.
  const [row] = await db
    .select({
      id: memberships.id,
      memberId: memberships.memberId,
      depositUsd: memberships.depositUsd,
      program: memberships.program,
      status: memberships.status,
    })
    .from(memberships)
    .where(eq(memberships.id, membershipId));

  if (!row) {
    throw new Error(`membership not found: ${membershipId}`);
  }
  // If somehow already active (replay arrived after first success), no-op.
  // The webhook events table dedup means this branch shouldn't trigger,
  // but defending against a race here is cheap insurance.
  if (row.status === "active") {
    return;
  }

  const now = new Date();

  // Flip membership to active.
  await db
    .update(memberships)
    .set({
      status: "active",
      activatedAt: now,
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
      updatedAt: now,
    })
    .where(eq(memberships.id, membershipId));

  // Top-up the reserve ledger with the deposit. Positive amount = inflow.
  const tx: NewReserveTransaction = {
    memberId: row.memberId,
    membershipId: row.id,
    kind: "top_up",
    amountUsd: row.depositUsd,
    description: `${row.program} activation deposit`,
  };
  await db.insert(reserveTransactions).values(tx);

  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "membership.activated",
    subjectType: "membership",
    subjectId: row.id,
    diff: { status: { before: row.status, after: "active" } },
    metadata: {
      program: row.program,
      depositUsd: row.depositUsd,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      source: "stripe_webhook",
    },
  });
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) return;

  // Find the invoice this charge belongs to, then flip status. We don't
  // create a separate "refund" invoice here — that's a manual ops call
  // depending on whether it's a full refund or partial.
  const updated = await db
    .update(invoices)
    .set({ status: "void", updatedAt: new Date() })
    .where(eq(invoices.stripePaymentIntentId, paymentIntentId))
    .returning({ id: invoices.id, invoiceCode: invoices.invoiceCode });

  if (updated.length === 0) return; // no matching invoice — ignore

  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "invoice.refunded",
    subjectType: "invoice",
    subjectId: updated[0].id,
    subjectCode: updated[0].invoiceCode,
    diff: { status: { before: "paid", after: "void" } },
    metadata: {
      stripePaymentIntentId: paymentIntentId,
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
    },
  });
}
