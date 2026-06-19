"use server";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { logAudit } from "@/lib/audit";
import { requireUser, type CurrentUser } from "@/lib/auth";
import {
  createInvoiceCheckoutSession,
  isStripeConfigured,
  retrieveCheckoutSession,
  StripeAmountTooLargeError,
} from "@/lib/stripe";

export type PayResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PAYABLE_STATUSES = new Set(["due", "overdue"]);

// A claimed-but-not-yet-real session id looks like `pending:<uuid>` —
// the sentinel stamped between claim and the Stripe round-trip. A real
// hosted session id is `cs_…`. Distinguishing them is what lets the
// resume path know whether another tab is genuinely mid-flight (pending)
// or there's a reusable Stripe session to send the member back to (cs_).
function isPlaceholderSession(id: string | null): boolean {
  return !id || id.startsWith("pending:");
}

// How long to consider a stamped Stripe Checkout session "in flight"
// before allowing a retry. Stripe Checkout sessions expire after 24 h
// by default; 30 min covers the realistic abandon window. After this,
// the user can re-claim the invoice (and the orphaned session will
// either expire silently or land on Stripe's side without a webhook
// follow-up).
const CHECKOUT_CLAIM_TTL = sql`interval '30 minutes'`;

/**
 * Member-triggered pay-now. Validates ownership + status, creates a
 * Stripe Checkout session, persists the session id on the invoice, and
 * returns the redirect URL. Final paid-state lives in the webhook.
 *
 * Double-charge defense: the claim-then-create pattern serializes
 * Stripe-session creation per invoice. The first call atomically stamps
 * a placeholder session id (`pending:<uuid>`); a concurrent second call
 * sees the placeholder and refuses with PAYMENT_IN_PROGRESS. If we
 * crash mid-flight, the TTL above lets the user retry. Without this,
 * two tabs each receive a valid Stripe URL and the customer can be
 * charged twice — Stripe doesn't dedupe across distinct sessions for
 * the same metadata.
 */
export async function startInvoiceCheckout(invoiceId: string): Promise<PayResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
  }
  if (!invoiceId || typeof invoiceId !== "string") {
    return { ok: false, error: "INVALID_INVOICE_ID" };
  }

  const user = await requireUser("/account/invoices");

  // Confirm the invoice exists, is payable, and belongs to this user.
  const [row] = await db
    .select({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      status: invoices.status,
      totalUsd: invoices.totalUsd,
      memberId: invoices.memberId,
      memberUserId: members.userId,
    })
    .from(invoices)
    .leftJoin(members, eq(members.id, invoices.memberId))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (row.memberUserId !== user.id) return { ok: false, error: "FORBIDDEN" };
  if (!PAYABLE_STATUSES.has(row.status)) {
    return { ok: false, error: "INVOICE_NOT_PAYABLE" };
  }
  if (!row.totalUsd || row.totalUsd <= 0) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  return mintCheckout(
    {
      id: row.id,
      invoiceCode: row.invoiceCode,
      totalUsd: row.totalUsd,
      memberId: row.memberId,
    },
    user,
  );
}

type CheckoutRow = {
  id: string;
  invoiceCode: string;
  totalUsd: number;
  memberId: string;
};

/**
 * Claim → create → stamp → audit. Splitting this out from
 * `startInvoiceCheckout` lets the resume path re-enter it after clearing
 * an expired session. `attempt` bounds the resume→re-mint recursion so a
 * pathological race can't loop (one re-mint is enough; the second resume
 * always terminates on a pending sentinel or a fresh `open` session).
 */
async function mintCheckout(
  row: CheckoutRow,
  user: CurrentUser,
  attempt = 0,
): Promise<PayResult> {
  // Claim the invoice for checkout. Conditional UPDATE wins exactly one
  // writer when two tabs race. The `pending:<uuid>` placeholder is a
  // sentinel — the real session id replaces it on the post-Stripe stamp
  // below, and the TTL clause lets a stale claim be reclaimed.
  const claimToken = `pending:${crypto.randomUUID()}`;
  const claimed = await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: claimToken, updatedAt: new Date() })
    .where(
      and(
        eq(invoices.id, row.id),
        eq(invoices.memberId, row.memberId),
        inArray(invoices.status, ["due", "overdue"]),
        or(
          isNull(invoices.stripeCheckoutSessionId),
          sql`${invoices.updatedAt} < now() - ${CHECKOUT_CLAIM_TTL}`,
        ),
      ),
    )
    .returning({ id: invoices.id });

  if (claimed.length === 0) {
    // Another writer holds a fresh claim. Rather than dead-ending the
    // member on PAYMENT_IN_PROGRESS, inspect what's actually there: a
    // resumable open session, an already-complete payment, or a stale
    // session we can clear and replace.
    return resumeCheckout(row, user, attempt);
  }

  let session: { sessionId: string; url: string };
  try {
    session = await createInvoiceCheckoutSession({
      invoiceId: row.id,
      invoiceCode: row.invoiceCode,
      totalUsd: row.totalUsd,
      customerEmail: user.email,
      description: `JetNine charter invoice ${row.invoiceCode}`,
    });
  } catch (err) {
    // Release the claim so the user can retry without waiting out the TTL.
    await db
      .update(invoices)
      .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
      .where(
        and(eq(invoices.id, row.id), eq(invoices.stripeCheckoutSessionId, claimToken)),
      );
    if (err instanceof StripeAmountTooLargeError) {
      // Ops surfaces this on the trip sheet and routes to wire + the
      // customer sees a hint instead of a generic "something broke".
      console.warn("stripe invoice exceeds per-line cap", {
        invoiceId: row.id,
        totalUsd: row.totalUsd,
      });
      return { ok: false, error: "INVOICE_TOO_LARGE_FOR_STRIPE" };
    }
    console.error("stripe checkout creation failed", err);
    return { ok: false, error: "STRIPE_ERROR" };
  }

  // Replace the placeholder with the real session id. Constrained to the
  // claim token so a webhook that arrived during the Stripe round-trip
  // (unlikely but possible if metadata routes oddly) doesn't get clobbered.
  await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: session.sessionId, updatedAt: new Date() })
    .where(
      and(eq(invoices.id, row.id), eq(invoices.stripeCheckoutSessionId, claimToken)),
    );

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "invoice.checkout.start",
    subjectType: "invoice",
    subjectId: row.id,
    subjectCode: row.invoiceCode,
    metadata: {
      stripeSessionId: session.sessionId,
      amountUsd: row.totalUsd,
    },
  });

  return { ok: true, url: session.url };
}

/**
 * Resume path: an existing claim is in the way. Re-read the stored
 * session and decide:
 *   - still `due`/`overdue` + a real `cs_…` session that's still `open`
 *     → redirect the member back to it (resume; no new charge minted)
 *   - session `complete` (or invoice already `paid`) → tell them it's done
 *   - session `expired`, or only a stale `pending:` sentinel past its
 *     window → clear it and mint a fresh session
 *   - a fresh `pending:` sentinel → another tab is genuinely mid-flight
 */
async function resumeCheckout(
  row: CheckoutRow,
  user: CurrentUser,
  attempt: number,
): Promise<PayResult> {
  const [cur] = await db
    .select({
      sessionId: invoices.stripeCheckoutSessionId,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, row.id))
    .limit(1);

  if (!cur) return { ok: false, error: "NOT_FOUND" };

  if (cur.status === "paid") {
    return { ok: false, error: "PAYMENT_ALREADY_COMPLETE" };
  }
  if (!PAYABLE_STATUSES.has(cur.status)) {
    return { ok: false, error: "INVOICE_NOT_PAYABLE" };
  }

  // Only a placeholder sentinel and still fresh (the claim above already
  // failed the TTL test) → a real concurrent attempt is mid-flight.
  if (isPlaceholderSession(cur.sessionId)) {
    return { ok: false, error: "PAYMENT_IN_PROGRESS" };
  }

  let remote: { status: string | null; url: string | null };
  try {
    remote = await retrieveCheckoutSession(cur.sessionId!);
  } catch (err) {
    console.error("stripe session retrieve failed", err);
    return { ok: false, error: "STRIPE_ERROR" };
  }

  if (remote.status === "open" && remote.url) {
    await logAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: "invoice.checkout.resume",
      subjectType: "invoice",
      subjectId: row.id,
      subjectCode: row.invoiceCode,
      metadata: { stripeSessionId: cur.sessionId, amountUsd: row.totalUsd },
    });
    return { ok: true, url: remote.url };
  }

  if (remote.status === "complete") {
    // Paid on Stripe's side; the webhook will flip the row to `paid`.
    return { ok: false, error: "PAYMENT_ALREADY_COMPLETE" };
  }

  // Expired (or an unexpected null status). Clear the stale binding —
  // guarded to the exact id we just read so we don't clobber a racer —
  // then mint a fresh session. Bounded to a single re-mint.
  await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
    .where(
      and(eq(invoices.id, row.id), eq(invoices.stripeCheckoutSessionId, cur.sessionId!)),
    );

  if (attempt >= 1) {
    return { ok: false, error: "PAYMENT_IN_PROGRESS" };
  }
  return mintCheckout(row, user, attempt + 1);
}
