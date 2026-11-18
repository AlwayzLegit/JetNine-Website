import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import type { NewReserveTransaction } from "@/db/schema/memberships";
import { isUniqueViolation } from "@/db/unique";
import { invoiceStore } from "@/domain/invoices/store";
import { paymentStore } from "@/domain/payments/store";
import { logAudit } from "@/lib/audit";
import { tierWords } from "@/lib/desk-status";
import {
  sendDispatchAlert,
  sendMembershipActivatedEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendTopUpReceiptEmail,
} from "@/lib/email";
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
    event = await constructWebhookEvent(rawBody, signature);
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
  // The queries go through the payment store (OPS-162): Postgres, or D1 where DB_TARGET is d1.
  const payments = paymentStore();
  const claimed = await payments.claimEvent({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (!claimed) {
    if (await payments.eventProcessedAt(event.id)) {
      return NextResponse.json({ received: true, deduped: true });
    }
    await payments.clearEventError(event.id);
    console.warn("[stripe-webhook] retry of unfinished event", {
      id: event.id,
      type: event.type,
    });
  }

  try {
    await dispatch(event);
    await payments.markEventProcessed(event.id, new Date());
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] dispatch failed", { id: event.id, type: event.type, msg });
    await payments.markEventError(event.id, msg.slice(0, 500));
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
  // Route by metadata.kind set at session-create time. We require
  // either an explicit kind OR an unambiguous invoice_id in metadata —
  // a session with missing metadata + a stray client_reference_id
  // shouldn't get force-routed through onInvoicePaid (where the
  // membership UUID in client_reference_id would be treated as an
  // invoice UUID and either throw or, astronomically rarely, collide
  // with a real invoice). The webhook layer catches the throw and
  // returns 500 → Stripe retries; ops investigates.
  const kind = session.metadata?.kind;
  if (kind === "membership_purchase") {
    return onMembershipPurchased(session);
  }
  if (kind === "membership_topup") {
    return onMembershipToppedUp(session);
  }
  if (kind === "invoice_paid" || invoiceIdFrom(session.metadata)) {
    return onInvoicePaid(session);
  }
  throw new Error(
    `checkout.session.completed: missing metadata.kind and metadata.invoice_id (session ${session.id})`,
  );
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

  const row = await paymentStore().membershipForTopUp(membershipId);
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
    await paymentStore().creditLedger(tx);
  } catch (err) {
    // Partial unique index fires when the same payment_intent surfaces
    // under a different event id (Dashboard resend). Swallow and treat
    // as a no-op — the original credit is already on the ledger.
    if (isUniqueViolation(err)) {
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

  // Receipt + desk ping — money arrived; both sides should hear it.
  try {
    const contact = await memberContact(row.memberId);
    if (contact) {
      await sendTopUpReceiptEmail({
        to: contact.email,
        firstName: contact.firstName,
        amountUsd,
      });
    }
    await sendDispatchAlert({
      subject: `[RESERVE] Top-up received — $${Math.round(amountUsd).toLocaleString("en-US")}`,
      headline: "A client topped up their reserve.",
      lines: [`$${Math.round(amountUsd).toLocaleString("en-US")} added to their reserve, paid by card through Stripe.`],
      link: { label: "Open clients", url: "https://jetnine.com/admin/clients" },
    });
  } catch (err) {
    console.error("[stripe-webhook] top-up notifications failed (non-fatal)", err);
  }
}

// Member contact for customer-facing sends. Null when the member has no
// linked auth user (shouldn't happen post-invite, but never throw here —
// notification lookups must not fail a webhook).
async function memberContact(
  memberId: string | null,
): Promise<{ email: string; firstName: string } | null> {
  if (!memberId) return null;
  try {
    const m = await invoiceStore().memberContact(memberId);
    return m?.email ? { email: m.email, firstName: m.firstName || "Hello" } : null;
  } catch {
    return null;
  }
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

  const paid = await paymentStore().markInvoicePaid({
    invoiceId,
    paymentIntentId,
    sessionId: session.id,
    paidAt: new Date(),
  });

  if (!paid) {
    throw new Error(`invoice not found: ${invoiceId}`);
  }
  const updated = [paid];

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

  // Receipt to the customer + ping to the desk. Money moved — both sides
  // of the counter should hear about it. Best-effort: a failed email must
  // never 500 the webhook (Stripe would retry an already-applied event).
  try {
    let tripCode: string | null = null;
    if (updated[0].tripId) {
      tripCode = await invoiceStore().tripCode(updated[0].tripId);
    }
    const contact = await memberContact(updated[0].memberId);
    if (contact) {
      await sendPaymentReceiptEmail({
        to: contact.email,
        firstName: contact.firstName,
        invoiceCode: updated[0].invoiceCode,
        tripCode,
        amountUsd: updated[0].totalUsd,
      });
    }
    await sendDispatchAlert({
      subject: `[${updated[0].invoiceCode}] Payment received${updated[0].totalUsd != null ? ` — $${Math.round(updated[0].totalUsd).toLocaleString("en-US")}` : ""}`,
      headline: "An invoice was paid.",
      lines: [
        `Paid by card through Stripe.`,
        `Reference ${updated[0].invoiceCode}${tripCode ? ` · trip ${tripCode}` : ""}`,
      ],
      link: updated[0].tripId
        ? { label: "Open the trip", url: `https://jetnine.com/admin/trips/${updated[0].tripId}` }
        : undefined,
    });
  } catch (err) {
    console.error("[stripe-webhook] paid notifications failed (non-fatal)", err);
  }
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

  // The card bounced and the invoice silently stays `due` — tell the
  // customer (so they can retry or wire) and the desk (so a big booking
  // doesn't quietly stall). Best-effort.
  try {
    const inv = await paymentStore().invoiceForFailedPayment(invoiceId);
    if (inv) {
      const contact = await memberContact(inv.memberId);
      if (contact) {
        await sendPaymentFailedEmail({
          to: contact.email,
          firstName: contact.firstName,
          invoiceCode: inv.invoiceCode,
          reason: intent.last_payment_error?.message?.slice(0, 140) ?? null,
        });
      }
      await sendDispatchAlert({
        subject: `[${inv.invoiceCode}] Card payment didn't go through`,
        headline: "A card payment didn't go through.",
        lines: [
          `What Stripe said: ${intent.last_payment_error?.message ?? "no reason given"}.`,
          `The invoice is still due.${contact ? " The client was emailed to try again or pay by bank wire." : ""}`,
          `Reference ${inv.invoiceCode}`,
        ],
        link: inv.tripId
          ? { label: "Open the trip", url: `https://jetnine.com/admin/trips/${inv.tripId}` }
          : undefined,
      });
    }
  } catch (err) {
    console.error("[stripe-webhook] failed-payment notifications failed (non-fatal)", err);
  }
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
  const row = await paymentStore().membershipForActivation(membershipId);

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
    // One step: the tier follows the membership (OPS-102). If the tier write
    // failed after the status write, Stripe's retry would find the row already
    // active and never fix the tier. The store does both in one transaction on
    // Postgres and one batch on D1.
    await paymentStore().activateMembership({
      id: membershipId,
      memberId: row.memberId,
      previousStatus: row.status,
      paymentIntentId,
      sessionId: session.id,
      now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
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
      // A double charge needing a MANUAL refund was previously only a
      // console.error — page the desk.
      try {
        await sendDispatchAlert({
          subject: "Action needed — a membership was charged twice, refund needed",
          headline: "A membership was charged twice.",
          lines: [
            `${tierWords(row.program)}: the $${Math.round(row.depositUsd).toLocaleString("en-US")} deposit was charged a second time. Refund it by hand in Stripe.`,
            `For Stripe: payment ${paymentIntentId ?? "unknown"} · checkout session ${session.id} · membership ${membershipId}`,
          ],
        });
      } catch (err) {
        console.error("[stripe-webhook] duplicate-charge alert failed (non-fatal)", err);
      }
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
    await paymentStore().creditLedger(tx);
  } catch (err) {
    if (isUniqueViolation(err)) {
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
  // Welcome + desk ping. The activation previously happened in silence.
  try {
    const contact = await memberContact(row.memberId);
    if (contact) {
      await sendMembershipActivatedEmail({
        to: contact.email,
        firstName: contact.firstName,
        program: row.program,
        depositUsd: row.depositUsd,
      });
    }
    await sendDispatchAlert({
      subject: `[MEMBERSHIP] ${tierWords(row.program)} bought — $${Math.round(row.depositUsd).toLocaleString("en-US")} deposit`,
      headline: "A client bought a membership.",
      lines: [`${tierWords(row.program)}. The $${Math.round(row.depositUsd).toLocaleString("en-US")} deposit is in their reserve.`],
      link: { label: "Open clients", url: "https://jetnine.com/admin/clients" },
    });
  } catch (err) {
    console.error("[stripe-webhook] activation notifications failed (non-fatal)", err);
  }
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

  const voided = await paymentStore().voidInvoiceByPaymentIntent(paymentIntentId, new Date());

  if (!voided) return; // no matching invoice — ignore
  const updated = [voided];

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
