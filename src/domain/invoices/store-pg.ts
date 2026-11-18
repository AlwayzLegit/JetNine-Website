import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { reserveTransactions, type NewReserveTransaction } from "@/db/schema/memberships";
import { tripLegs, trips } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import type { InvoiceStore } from "./store";

// The Postgres side of the invoice store (OPS-161): the queries of the cancel refunds, the invoice
// editor, the invoice watch cron and the client's invoice page and pay button, moved here as they
// were. Nothing about them changes on Postgres: the refund is still one transaction caught on the
// unique index, the claims still read current_date and now() in SQL.

const CLAIM_RETURNING = {
  id: invoices.id,
  invoiceCode: invoices.invoiceCode,
  memberId: invoices.memberId,
  totalUsd: invoices.totalUsd,
  dueOn: invoices.dueOn,
  tripId: invoices.tripId,
};

export function pgInvoiceStore(): InvoiceStore {
  return {
    async memberContact(memberId) {
      const [m] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, memberId));
      return m?.email ? { email: m.email, firstName: m.firstName } : null;
    },

    async tripCode(tripId) {
      const [t] = await db.select({ tripCode: trips.tripCode }).from(trips).where(eq(trips.id, tripId));
      return t?.tripCode ?? null;
    },

    async unrefundedDraws(tripId) {
      return db
        .select({
          id: reserveTransactions.id,
          memberId: reserveTransactions.memberId,
          membershipId: reserveTransactions.membershipId,
          amountUsd: reserveTransactions.amountUsd,
          invoiceId: reserveTransactions.invoiceId,
        })
        .from(reserveTransactions)
        .where(
          and(
            eq(reserveTransactions.tripId, tripId),
            eq(reserveTransactions.kind, "charter_draw"),
            sql`not exists (
          select 1 from ${reserveTransactions} r
          where r.trip_id = ${reserveTransactions.tripId}
            and r.invoice_id is not distinct from ${reserveTransactions.invoiceId}
            and r.kind = 'refund'
        )`,
          ),
        );
    },

    async postDrawRefunds({ tripId, refunds, voidInvoiceIds, note }) {
      await db.transaction(async (tx) => {
        for (const r of refunds) {
          const refundRow: NewReserveTransaction = {
            memberId: r.memberId,
            membershipId: r.membershipId,
            kind: "refund",
            amountUsd: r.amountUsd,
            description: r.description,
            tripId,
            invoiceId: r.invoiceId,
          };
          await tx.insert(reserveTransactions).values(refundRow);
        }

        if (voidInvoiceIds.length > 0) {
          await tx
            .update(invoices)
            .set({
              status: "void",
              notes: sql`coalesce(${invoices.notes} || E'\n', '') || ${note}`,
              updatedAt: new Date(),
            })
            .where(inArray(invoices.id, voidInvoiceIds));
        }
      });
    },

    async paidInvoicesOfTrip(tripId) {
      return db
        .select({
          id: invoices.id,
          invoiceCode: invoices.invoiceCode,
          memberId: invoices.memberId,
          totalUsd: invoices.totalUsd,
          stripePaymentIntentId: invoices.stripePaymentIntentId,
        })
        .from(invoices)
        .where(and(eq(invoices.tripId, tripId), eq(invoices.status, "paid")));
    },

    async voidPaidInvoice(id) {
      await db
        .update(invoices)
        .set({ status: "void", updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.status, "paid")));
    },

    async invoiceById(id) {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
      return inv;
    },

    async updateDraftInvoice(id, patch) {
      const updated = await db
        .update(invoices)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.status, "draft")))
        .returning({ id: invoices.id });
      return updated.length > 0;
    },

    // `today` and `until` are for the D1 adapter: here the database's own current_date is read.
    async claimOverdue({ limit, now }) {
      return db
        .update(invoices)
        .set({ status: "overdue", overdueNotifiedAt: now, updatedAt: now })
        .where(
          sql`${invoices.id} in (
        select id from ${invoices}
        where ${invoices.status} = 'due'
          and ${invoices.dueOn} is not null
          and ${invoices.dueOn} < current_date
          and ${invoices.overdueNotifiedAt} is null
        order by ${invoices.dueOn} asc
        limit ${limit}
      )`,
        )
        .returning(CLAIM_RETURNING);
    },

    async claimDueSoon({ limit, now }) {
      return db
        .update(invoices)
        .set({ dueReminderSentAt: now, updatedAt: now })
        .where(
          sql`${invoices.id} in (
        select id from ${invoices}
        where ${invoices.status} = 'due'
          and ${invoices.dueOn} is not null
          and ${invoices.dueOn} >= current_date
          and ${invoices.dueOn} <= current_date + 2
          and ${invoices.dueReminderSentAt} is null
        order by ${invoices.dueOn} asc
        limit ${limit}
      )`,
        )
        .returning(CLAIM_RETURNING);
    },

    async memberInvoices(memberId, limit) {
      return db
        .select({
          id: invoices.id,
          invoiceCode: invoices.invoiceCode,
          kind: invoices.kind,
          status: invoices.status,
          issuedOn: invoices.issuedOn,
          dueOn: invoices.dueOn,
          paidOn: invoices.paidOn,
          subtotalUsd: invoices.subtotalUsd,
          fetUsd: invoices.fetUsd,
          segmentFeeUsd: invoices.segmentFeeUsd,
          totalUsd: invoices.totalUsd,
          tripId: invoices.tripId,
          tripCode: trips.tripCode,
        })
        .from(invoices)
        .leftJoin(trips, eq(trips.id, invoices.tripId))
        .where(eq(invoices.memberId, memberId))
        .orderBy(desc(invoices.issuedOn))
        .limit(limit);
    },

    async tripRouteLegs(tripIds) {
      if (tripIds.length === 0) return [];
      return db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromCity: tripLegs.fromCity,
          fromIata: tripLegs.fromIata,
          toCity: tripLegs.toCity,
          toIata: tripLegs.toIata,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, tripIds))
        .orderBy(asc(tripLegs.tripId), asc(tripLegs.legNumber));
    },

    async invoiceWithOwner(id) {
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
        .where(eq(invoices.id, id))
        .limit(1);
      return row;
    },

    // `staleBeforeMs` is for the D1 adapter: here the claim goes stale after the same 30 minutes, read in SQL.
    async claimCheckout({ id, memberId, token }) {
      const claimed = await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: token, updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.memberId, memberId),
            inArray(invoices.status, ["due", "overdue"]),
            or(isNull(invoices.stripeCheckoutSessionId), sql`${invoices.updatedAt} < now() - interval '30 minutes'`),
          ),
        )
        .returning({ id: invoices.id });
      return claimed.length > 0;
    },

    async releaseCheckout(id, token) {
      await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.stripeCheckoutSessionId, token)));
    },

    async stampCheckout(id, token, sessionId) {
      await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.stripeCheckoutSessionId, token)));
    },

    async checkoutState(id) {
      const [cur] = await db
        .select({ sessionId: invoices.stripeCheckoutSessionId, status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1);
      return cur;
    },

    async clearCheckout(id, sessionId) {
      await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: null, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.stripeCheckoutSessionId, sessionId)));
    },
  };
}
