import { and, desc, eq, sql } from "drizzle-orm";
import type { db as DbType } from "@/db";
import { invoices } from "@/db/schema/invoices";
import {
  memberships,
  reserveTransactions,
  type NewReserveTransaction,
} from "@/db/schema/memberships";

// Helpers accept either the top-level Drizzle client or a transaction
// handle. Both share the select/insert/update API we use; pulling the
// exact PgTransaction type out of Drizzle is fragile, so we widen via
// the parameter shape of db.transaction's callback.
type Tx = Parameters<Parameters<typeof DbType.transaction>[0]>[0];
type DbOrTx = typeof DbType | Tx;

/**
 * Look up the member's currently-active membership (Card or Reserve).
 * Returns null if they're on-demand only.
 */
export async function getActiveMembership(
  client: DbOrTx,
  memberId: string,
): Promise<{
  id: string;
  program: string;
} | null> {
  const [row] = await client
    .select({ id: memberships.id, program: memberships.program })
    .from(memberships)
    .where(and(eq(memberships.memberId, memberId), eq(memberships.status, "active")))
    .orderBy(desc(memberships.activatedOn))
    .limit(1);
  return row ?? null;
}

/**
 * Signed sum of all reserve transactions for the member. Top-ups are
 * positive; charter_draw + most adjustments are negative. Positive
 * result = available balance.
 */
export async function getReserveBalance(
  client: DbOrTx,
  memberId: string,
): Promise<number> {
  const [row] = await client
    .select({ total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)` })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, memberId));
  return Number(row?.total ?? 0);
}

export type DrawdownOutcome =
  | { drew: false; reason: "NO_ACTIVE_MEMBERSHIP" | "INSUFFICIENT_BALANCE" | "INVOICE_NO_TOTAL" }
  | {
      drew: true;
      amountUsd: number;
      reserveTxId: string;
      remainingBalanceUsd: number;
    };

/**
 * Attempt to draw the full invoice amount from the member's reserve
 * balance. Designed to run inside the same transaction that creates
 * the invoice (or finalizes it from 'draft' to 'due') so the
 * draw + invoice-paid update commit atomically.
 *
 * Policy decisions baked in:
 *   - All-or-nothing. If balance < invoice total, no draw happens and
 *     the invoice routes through normal Stripe payment. (Partial draws
 *     are conceptually fine but complicate the UI — defer until we
 *     actually see a member halfway through their balance.)
 *   - Drawn invoices flip directly to 'paid' with paid_on=current_date.
 *     The customer never sees a Pay-now button for them.
 *   - Doesn't fire if the invoice has no total_usd (draft estimate
 *     without pricing — dispatcher hasn't finalized).
 */
export async function attemptInvoiceDrawdown(
  tx: DbOrTx,
  args: {
    invoiceId: string;
    memberId: string;
    tripId: string | null;
    totalUsd: number | null;
  },
): Promise<DrawdownOutcome> {
  if (!args.totalUsd || args.totalUsd <= 0) {
    return { drew: false, reason: "INVOICE_NO_TOTAL" };
  }

  // Serialize all drawdown attempts for this member within the current
  // transaction. Postgres default isolation is READ COMMITTED, so two
  // concurrent convertQuoteToTrip calls would otherwise both observe
  // the pre-draw balance and both pass the `balance < total` check —
  // ending the day with a negative reserve. The advisory lock is keyed
  // on memberId (hashtext → bigint), held until COMMIT, and contends
  // with itself across sessions but with nothing else in the DB.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`reserve:${args.memberId}`}))`,
  );

  const membership = await getActiveMembership(tx, args.memberId);
  if (!membership) {
    return { drew: false, reason: "NO_ACTIVE_MEMBERSHIP" };
  }

  const balance = await getReserveBalance(tx, args.memberId);
  if (balance < args.totalUsd) {
    return { drew: false, reason: "INSUFFICIENT_BALANCE" };
  }

  const drawValues: NewReserveTransaction = {
    memberId: args.memberId,
    membershipId: membership.id,
    kind: "charter_draw",
    // Signed ledger: drawdowns are negative.
    amountUsd: -args.totalUsd,
    description: `Charter draw — invoice ${args.invoiceId}`,
    tripId: args.tripId,
    invoiceId: args.invoiceId,
  };
  const [drawRow] = await tx
    .insert(reserveTransactions)
    .values(drawValues)
    .returning({ id: reserveTransactions.id });

  await tx
    .update(invoices)
    .set({
      status: "paid",
      paidOn: sql`current_date`,
      paidAt: new Date(),
      notes: sql`coalesce(${invoices.notes} || E'\n', '') || ${`Auto-drawn from reserve membership ${membership.id} — $${args.totalUsd.toLocaleString()}`}`,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, args.invoiceId));

  return {
    drew: true,
    amountUsd: args.totalUsd,
    reserveTxId: drawRow.id,
    remainingBalanceUsd: balance - args.totalUsd,
  };
}
