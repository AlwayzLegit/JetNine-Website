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

  // Idempotency claim. The dedup contract: an event is "processed" only
  // once processed_at is stamped. If a prior delivery inserted the event
  // row but never completed dispatch (lambda OOM, transient DB error,
  // deploy mid-flight), the retry MUST re-attempt — otherwise the row
  // sits forever with processed_at=NULL, Stripe stops retrying after
  // seeing a 200 dedup response, and the side effects (membership flip,
  // reserve credit, invoice paid) never happen even though Stripe
  // collected. The two-tier check below: try-insert + if-conflict-then
  // look up, dedup only on processed_at being set.
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
    const [existing] = await db
      .select({
        id: stripeWebhookEvents.id,
        processedAt: stripeWebhookEvents.processedAt,
      })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, event.id));
    if (existing?.processedAt) {
      return NextResponse.json({ received: true, deduped: true });
    }
    await db
      .update(stripeWebhookEvents)
      .set({ error: null })
      .where(eq(stripeWebhookEvents.id, event.id));
    console.warn("[stripe-webhook] retry of unfinished event", {
      id: event.id,
      type: event.type,
    });
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
    // 5xx so Stripe retries with backoff. The retry lands on the
    // claimed==0 + processedAt IS NULL branch and re-attempts dispatch.
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

// Stripe types `payment_intent` as `string | PaymentIntent | null` on
// both Session and Charge. Unwrap once instead of repeating the
// ternary at every callsite.
function paymentIntentIdOf(
  pi: Stripe.Checkout.Session["payment_intent"] | Stripe.Charge["payment_intent"],
): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : (pi.id ?? null);
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
  if (!membershipId || !memberId) {
    throw new Error("checkout.session.completed: missing topup metadata");
  }
  if (session.payment_status !== "paid") return;

  // Derive the credit amount from what Stripe actually charged
  // (`amount_total` is in cents), not from our own `metadata.amount_usd`.
  // Metadata can be edited from the Stripe Dashboard after creation
  // without re-charging the card — trusting it would let a compromised
  // Dashboard token credit a member with money they didn't pay. We do
  // still cross-check against the metadata to catch an upstream session
  // misconfiguration, but the credit value is always the charge value.
  if (typeof session.amount_total !== "number" || session.amount_total <= 0) {
    throw new Error(`checkout.session.completed: missing amount_total on topup ${session.id}`);
  }
  if (session.amount_total % 100 !== 0) {
    throw new Error(
      `checkout.session.completed: non-USD-integer amount_total ${session.amount_total} on topup ${session.id}`,
    );
  }
  const amountUsd = session.amount_total / 100;
  const metadataAmount = Number.parseInt(session.metadata?.amount_usd ?? "", 10);
  if (Number.isFinite(metadataAmount) && metadataAmount !== amountUsd) {
    console.warn("[stripe-webhook] topup amount mismatch (using amount_total)", {
      sessionId: session.id,
      amountTotalUsd: amountUsd,
      metadataAmountUsd: metadataAmount,
    });
  }

  const [row] = await db
    .select({ id: memberships.id, memberId: memberships.memberId, status: memberships.status })
    .from(memberships)
    .where(eq(memberships.id, membershipId));
  if (!row) throw new Error(`membership not found: ${membershipId}`);
  if (row.status !== "active") {
    // Race window: the activation webhook for this membership hasn't
    // landed yet (or landed and got rolled back). Throw so the dispatch
    // wrapper returns 500 and Stripe retries with backoff — by the time
    // the retry arrives, the activation event will have landed first
    // and this top-up will succeed. Previously this branch silently
    // returned 200, marking the event "processed" and stranding the
    // member's money.
    throw new Error(
      `topup arrived before membership ${membershipId} is active (status=${row.status}); retry`,
    );
  }

  // Idempotency on (stripePaymentIntentId, kind='top_up'). The webhook
  // event-id dedup catches re-deliveries of the SAME event id, but
  // Stripe Dashboard "Resend event" produces a NEW event id for the
  // same intent, and adding payment_intent.succeeded to the dispatch
  // switch later would do the same. The partial unique index
  // `reserve_tx_top_up_per_intent_uniq` (migration 0032) makes the
  // second insert a no-op (ON CONFLICT) rather than a double credit.
  const paymentIntentId = paymentIntentIdOf(session.payment_intent);
  const tx: NewReserveTransaction = {
    memberId: row.memberId,
    membershipId: row.id,
    kind: "top_up",
    amountUsd,
    description: `Balance top-up via Stripe (session ${session.id.slice(0, 14)}…)`,
    stripePaymentIntentId: paymentIntentId,
  };
  try {
    await db.insert(reserveTransactions).values(tx);
  } catch (err) {
    // Partial unique index fires when the same payment_intent surfaces
    // under a different event id (Dashboard resend). Swallow and treat
    // as a no-op — the original credit is already on the ledger.
    if ((err as { code?: string }).code === "23505") {
      console.warn("[stripe-webhook] topup dedup hit on payment_intent", {
        paymentIntentId,
        sessionId: session.id,
      });
      return;
    }
    throw err;
  }

  await logAudit({
    actorUserId: null,
    actorRole: "system",
    action: "membership.topup.completed",
    subjectType: "membership",
    subjectId: row.id,
    metadata: {
      amountUsd,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentIdOf(session.payment_intent),
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

  const paymentIntentId = paymentIntentIdOf(session.payment_intent);

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

  const paymentIntentId = paymentIntentIdOf(session.payment_intent);

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

  // Flip membership to active. The partial unique index
  // `memberships_active_per_member_uniq` (migration 0032) catches the
  // TOCTOU race where the buyMembership action created two paused rows
  // (member double-clicked / opened two tabs) and both made it through
  // Stripe Checkout. The second activation here bounces with 23505 —
  // log it (the operator needs to refund this duplicate charge in
  // Stripe) and exit clean. The first activation has already happened
  // and the member has a valid card on file.
  try {
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
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      console.error(
        "[stripe-webhook] duplicate membership activation — refund required",
        {
          membershipId,
          memberId: row.memberId,
          paymentIntentId,
          sessionId: session.id,
        },
      );
      await logAudit({
        actorUserId: null,
        actorRole: "system",
        action: "membership.activation.duplicate_refund_required",
        subjectType: "membership",
        subjectId: membershipId,
        metadata: {
          memberId: row.memberId,
          stripePaymentIntentId: paymentIntentId,
          stripeSessionId: session.id,
          program: row.program,
          depositUsd: row.depositUsd,
        },
      });
      return;
    }
    throw err;
  }

  // Top-up the reserve ledger with the deposit. Positive amount = inflow.
  // Stamp the payment_intent for the partial unique index dedup so a
  // Dashboard-resent activation event doesn't double the member's deposit.
  const tx: NewReserveTransaction = {
    memberId: row.memberId,
    membershipId: row.id,
    kind: "top_up",
    amountUsd: row.depositUsd,
    description: `${row.program} activation deposit`,
    stripePaymentIntentId: paymentIntentId,
  };
  try {
    await db.insert(reserveTransactions).values(tx);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      console.warn("[stripe-webhook] activation dedup hit on payment_intent", {
        paymentIntentId,
        membershipId,
      });
    } else {
      throw err;
    }
  }

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
  const paymentIntentId = paymentIntentIdOf(charge.payment_intent);
  if (!paymentIntentId) return;

  // Only flip to 'void' on a FULL refund. Partial refunds — common for
  // dispute resolution, incidental adjustments, fee write-offs — must
  // NOT void the entire invoice: doing so corrupts revenue reporting
  // (the trip still happened, the customer paid for most of it) and
  // confuses the member ("my $50k charter is void?"). For partials we
  // just audit; ops decides how to record the adjustment manually.
  const isFullRefund = charge.amount_refunded >= charge.amount;
  if (!isFullRefund) {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: "invoice.refunded.partial",
      subjectType: "invoice",
      // We don't have the invoice id yet without an extra query; the
      // payment_intent in metadata is the bridge for the report tool.
      subjectId: null,
      metadata: {
        stripePaymentIntentId: paymentIntentId,
        chargeId: charge.id,
        amountCharged: charge.amount,
        amountRefunded: charge.amount_refunded,
        source: "stripe_webhook",
      },
    });
    return;
  }

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
