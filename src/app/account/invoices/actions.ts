"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import {
  createInvoiceCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripe";

export type PayResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PAYABLE_STATUSES = new Set(["due", "overdue"]);

/**
 * Member-triggered pay-now. Validates ownership + status, creates a
 * Stripe Checkout session, persists the session id on the invoice, and
 * returns the redirect URL. Final paid-state lives in the webhook.
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
    console.error("stripe checkout creation failed", err);
    return { ok: false, error: "STRIPE_ERROR" };
  }

  // Stash the session id so a subsequent webhook can correlate even if the
  // metadata arrives out of order. Doesn't change status — that's the
  // webhook's job on `checkout.session.completed`.
  await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: session.sessionId, updatedAt: new Date() })
    .where(and(eq(invoices.id, row.id), eq(invoices.memberId, row.memberId)));

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
