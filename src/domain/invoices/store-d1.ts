import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { chunks } from "@/db/d1/helpers";
import { invoices } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { reserveTransactions } from "@/db/d1/schema/memberships";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import type { Invoice } from "@/db/schema/invoices";
import type { InvoiceStore, RouteLegRow } from "./store";

// The D1 (SQLite) side of the invoice store (OPS-161). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so a
// test can hand it a real SQLite.
//
// Differences from Postgres:
// - No interactive transaction. The cancel refund is one db.batch(), which D1 runs as one
//   transaction: the refund inserts, then the invoices voided. The unique index
//   reserve_tx_refund_per_draw_uniq (D1 migration 0005) is the guard: a racing cancel makes an
//   insert throw "UNIQUE constraint failed" and the whole batch rolls back, as the Postgres
//   transaction does on 23505.
// - `is not distinct from` is SQLite's `IS`; E'\n' is char(10).
// - Day columns (due_on, issued_on) are text "YYYY-MM-DD", so the cron's day tests compare against
//   a date the app passes (UTC, as current_date is on the Postgres database). Timestamps are
//   integer milliseconds; drizzle maps a Date for a column.
// - D1 allows 100 bound values per statement: id lists are written and read in chunks of 50.
// - The claims are one `update ... where id in (select ... limit ?) returning`, one statement, so
//   an overlapping run cannot claim the same invoice twice. The Checkout claim is one conditional
//   update; the stale test compares updated_at to the instant the caller passes.

type D1Client = DrizzleD1Database;

const CLAIM_RETURNING = {
  id: invoices.id,
  invoiceCode: invoices.invoiceCode,
  memberId: invoices.memberId,
  totalUsd: invoices.totalUsd,
  dueOn: invoices.dueOn,
  tripId: invoices.tripId,
};

export function d1InvoiceStore(db: D1Client): InvoiceStore {
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
          select 1 from "reserve_transactions" r
          where r."trip_id" = "reserve_transactions"."trip_id"
            and r."invoice_id" is "reserve_transactions"."invoice_id"
            and r."kind" = 'refund'
        )`,
          ),
        );
    },

    // One batch: the refund inserts, then the invoices voided (ids in chunks of 50). Any failure,
    // the unique index of a racing cancel included, rolls the whole batch back.
    async postDrawRefunds({ tripId, refunds, voidInvoiceIds, note }) {
      const now = new Date();
      const inserts = refunds.map((r) =>
        db.insert(reserveTransactions).values({
          memberId: r.memberId,
          membershipId: r.membershipId,
          kind: "refund",
          amountUsd: r.amountUsd,
          description: r.description,
          tripId,
          invoiceId: r.invoiceId,
        }),
      );
      const voids = chunks(voidInvoiceIds).map((part) =>
        db
          .update(invoices)
          .set({
            status: "void",
            notes: sql`coalesce(${invoices.notes} || char(10), '') || ${note}`,
            updatedAt: now,
          })
          .where(inArray(invoices.id, part)),
      );
      const statements = [...inserts, ...voids];
      if (statements.length === 0) return;
      await db.batch(statements as unknown as [(typeof inserts)[number]]);
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
      return inv as Invoice | undefined;
    },

    async updateDraftInvoice(id, patch) {
      const updated = await db
        .update(invoices)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.status, "draft")))
        .returning({ id: invoices.id });
      return updated.length > 0;
    },

    async claimOverdue({ today, limit, now }) {
      return db
        .update(invoices)
        .set({ status: "overdue", overdueNotifiedAt: now, updatedAt: now })
        .where(
          sql`"invoices"."id" in (
        select "id" from "invoices"
        where "status" = 'due'
          and "due_on" is not null
          and "due_on" < ${today}
          and "overdue_notified_at" is null
        order by "due_on" asc
        limit ${limit}
      )`,
        )
        .returning(CLAIM_RETURNING);
    },

    async claimDueSoon({ today, until, limit, now }) {
      return db
        .update(invoices)
        .set({ dueReminderSentAt: now, updatedAt: now })
        .where(
          sql`"invoices"."id" in (
        select "id" from "invoices"
        where "status" = 'due'
          and "due_on" is not null
          and "due_on" >= ${today}
          and "due_on" <= ${until}
          and "due_reminder_sent_at" is null
        order by "due_on" asc
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
      const out: RouteLegRow[] = [];
      for (const part of chunks(tripIds)) {
        out.push(
          ...(await db
            .select({
              tripId: tripLegs.tripId,
              legNumber: tripLegs.legNumber,
              fromCity: tripLegs.fromCity,
              fromIata: tripLegs.fromIata,
              toCity: tripLegs.toCity,
              toIata: tripLegs.toIata,
            })
            .from(tripLegs)
            .where(inArray(tripLegs.tripId, part))
            .orderBy(asc(tripLegs.tripId), asc(tripLegs.legNumber))),
        );
      }
      // The chunks come back one after another: put them in the order the one Postgres query sorts.
      return out.sort((a, b) => (a.tripId < b.tripId ? -1 : a.tripId > b.tripId ? 1 : a.legNumber - b.legNumber));
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

    async claimCheckout({ id, memberId, token, staleBeforeMs }) {
      const claimed = await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: token, updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.memberId, memberId),
            inArray(invoices.status, ["due", "overdue"]),
            or(isNull(invoices.stripeCheckoutSessionId), lt(invoices.updatedAt, new Date(staleBeforeMs))),
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
