import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, stripeWebhookEvents } from "@/db/schema/invoices";
import { memberships, reserveTransactions } from "@/db/schema/memberships";
import { syncMemberTier } from "@/domain/memberships/tier";
import type { PaymentStore } from "./store";

// The Postgres side of the payment store (OPS-162): the queries of the Stripe webhook, moved
// here as they were. Nothing about them changes on Postgres: paid_on is still current_date in
// SQL, and the activation is still one transaction that ends with syncMemberTier.

export function pgPaymentStore(): PaymentStore {
  return {
    async claimEvent({ id, type, payload }) {
      const claimed = await db
        .insert(stripeWebhookEvents)
        .values({ id, type, payload })
        .onConflictDoNothing()
        .returning({ id: stripeWebhookEvents.id });
      return claimed.length > 0;
    },

    async eventProcessedAt(id) {
      const [existing] = await db
        .select({ processedAt: stripeWebhookEvents.processedAt })
        .from(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.id, id));
      return existing?.processedAt ?? null;
    },

    async clearEventError(id) {
      await db.update(stripeWebhookEvents).set({ error: null }).where(eq(stripeWebhookEvents.id, id));
    },

    async markEventProcessed(id, at) {
      await db.update(stripeWebhookEvents).set({ processedAt: at }).where(eq(stripeWebhookEvents.id, id));
    },

    async markEventError(id, message) {
      await db.update(stripeWebhookEvents).set({ error: message }).where(eq(stripeWebhookEvents.id, id));
    },

    async membershipForTopUp(id) {
      const [row] = await db
        .select({ id: memberships.id, memberId: memberships.memberId, status: memberships.status })
        .from(memberships)
        .where(eq(memberships.id, id));
      return row;
    },

    async membershipForActivation(id) {
      const [row] = await db
        .select({
          id: memberships.id,
          memberId: memberships.memberId,
          depositUsd: memberships.depositUsd,
          program: memberships.program,
          status: memberships.status,
        })
        .from(memberships)
        .where(eq(memberships.id, id));
      return row;
    },

    async creditLedger(values) {
      await db.insert(reserveTransactions).values(values);
    },

    async markInvoicePaid({ invoiceId, paymentIntentId, sessionId, paidAt }) {
      const [row] = await db
        .update(invoices)
        .set({
          status: "paid",
          paidOn: sql`current_date`,
          paidAt,
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: sessionId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning({
          id: invoices.id,
          invoiceCode: invoices.invoiceCode,
          memberId: invoices.memberId,
          totalUsd: invoices.totalUsd,
          tripId: invoices.tripId,
        });
      return row ?? null;
    },

    async invoiceForFailedPayment(id) {
      const [inv] = await db
        .select({ invoiceCode: invoices.invoiceCode, memberId: invoices.memberId, tripId: invoices.tripId })
        .from(invoices)
        .where(eq(invoices.id, id));
      return inv;
    },

    async activateMembership({ id, previousStatus, paymentIntentId, sessionId, now }) {
      // One transaction: the tier follows the membership (OPS-102). If the tier write failed
      // after the status write, Stripe's retry would find the row already active and never fix
      // the tier.
      await db.transaction(async (tx) => {
        await tx
          .update(memberships)
          .set({
            status: "active",
            activatedAt: now,
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: sessionId,
            updatedAt: now,
          })
          .where(eq(memberships.id, id));
        await syncMemberTier(tx, id, previousStatus);
      });
    },

    async voidInvoiceByPaymentIntent(paymentIntentId, now) {
      const [row] = await db
        .update(invoices)
        .set({ status: "void", updatedAt: now })
        .where(eq(invoices.stripePaymentIntentId, paymentIntentId))
        .returning({ id: invoices.id, invoiceCode: invoices.invoiceCode });
      return row ?? null;
    },
  };
}
