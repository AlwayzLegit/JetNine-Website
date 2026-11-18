import { and, eq, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { invoices, stripeWebhookEvents } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { PROGRAM_TO_TIER } from "@/domain/memberships/tier";
import type { PaymentStore } from "./store";

// The D1 (SQLite) side of the payment store (OPS-162). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so a
// test can hand it a real SQLite.
//
// Differences from Postgres:
// - No interactive transaction. The activation is one db.batch(), which D1 runs as one
//   transaction: the membership turned active, then the member's tier. A unique violation in the
//   first statement (another active membership for the member, or the session or the payment used
//   by another membership) rolls the second back, as the Postgres transaction does on 23505.
// - No trigger and no syncMemberTier read: the tier and tier_since are known before the write
//   (the program's tier, and the membership's own activated_on), so both fit in the batch.
// - paid_on is the UTC day "YYYY-MM-DD" worked out in the app (Postgres reads current_date, which
//   is UTC on that database too). Timestamps are integer milliseconds; drizzle maps a Date.
// - The event payload is JSON text (mode json).

type D1Client = DrizzleD1Database;

export function d1PaymentStore(db: D1Client): PaymentStore {
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
      await db.insert(reserveTransactions).values(values as typeof reserveTransactions.$inferInsert);
    },

    async markInvoicePaid({ invoiceId, paymentIntentId, sessionId, paidAt }) {
      const [row] = await db
        .update(invoices)
        .set({
          status: "paid",
          paidOn: paidAt.toISOString().slice(0, 10),
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

    async activateMembership({ id, memberId, paymentIntentId, sessionId, now }) {
      const [m] = await db
        .select({ program: memberships.program })
        .from(memberships)
        .where(eq(memberships.id, id));
      if (!m) throw new Error(`membership not found: ${id}`);
      const tier = PROGRAM_TO_TIER[m.program];

      await db.batch([
        // (a) The status. A second active membership for the member, or a session or payment
        // already used by another membership, throws "UNIQUE constraint failed" here and the
        // batch rolls back.
        db
          .update(memberships)
          .set({
            status: "active",
            activatedAt: now,
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: sessionId,
            updatedAt: now,
          })
          .where(and(eq(memberships.id, id), ne(memberships.status, "active"))),
        // (b) The tier follows the membership (OPS-102): the program's tier, and tier_since from
        // the membership's activated_on, only while that membership is active.
        db
          .update(members)
          .set({
            tier,
            tierSince: sql`(select ${memberships.activatedOn} from ${memberships} where ${memberships.id} = ${id})`,
          })
          .where(
            and(
              eq(members.id, memberId),
              sql`exists (select 1 from ${memberships} where ${memberships.id} = ${id} and ${memberships.status} = 'active')`,
            ),
          ),
      ]);
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
