import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cateringTierEnum } from "./enums";
import { invoices } from "./invoices";
import { members } from "./members";
import { trips } from "./trips";

// ─── Enums ───────────────────────────────────────────────────────────────

export const membershipProgramEnum = pgEnum("membership_program", [
  "on_demand",
  "card_100",
  "card_250",
  "card_500",
  "reserve_50",
  "reserve_100",
  "reserve_250",
  "reserve_500_apply",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "paused",
  "expired",
  "cancelled",
]);

export const reserveTxKindEnum = pgEnum("reserve_tx_kind", [
  "top_up",
  "charter_draw",
  "credit_accrual",
  "refund",
  "adjustment",
]);

// ─── memberships ─────────────────────────────────────────────────────────
// One row per program purchase. A member may have multiple historical rows
// but at most one with status='active'. Enforced by the partial unique
// index below.

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    program: membershipProgramEnum("program").notNull(),

    // Pricing & terms
    depositUsd: integer("deposit_usd").notNull(),
    cashbackPct: numeric("cashback_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    calloutHours: integer("callout_hours").notNull(),
    rateLockMonths: integer("rate_lock_months").notNull().default(24),

    // Allowances
    cateringIncludedTier: cateringTierEnum("catering_included_tier"),
    cateringAllowanceUsd: integer("catering_allowance_usd").notNull().default(0),
    groundAllowanceUsd: integer("ground_allowance_usd").notNull().default(0),

    namedCardholdersLimit: integer("named_cardholders_limit").notNull().default(1),
    emptyLegAdvanceMinutes: integer("empty_leg_advance_minutes").notNull().default(30),

    activatedOn: date("activated_on")
      .notNull()
      .default(sql`current_date`),
    expiresOn: date("expires_on"),
    autoRenew: boolean("auto_renew").notNull().default(false),
    nextRenewalDate: date("next_renewal_date"),

    status: membershipStatusEnum("status").notNull().default("active"),

    // Stripe linkage — populated when a self-serve purchase creates
    // the Checkout session, then completed by the webhook on payment
    // success. See migration 0030.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("memberships_member_idx").on(t.memberId, t.status),
    index("memberships_program_idx").on(t.program),
  ],
);

// ─── reserve_transactions (signed ledger) ────────────────────────────────
// Balance = sum(amount_usd) per member. Top-ups + credit accruals + refunds
// are positive; charter_draws + most adjustments are negative. The ledger
// is append-only; reversals are explicit adjustment rows so the audit
// trail stays intact.

export const reserveTransactions = pgTable(
  "reserve_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),

    kind: reserveTxKindEnum("kind").notNull(),
    amountUsd: integer("amount_usd").notNull(), // signed; positive = inflow
    description: text("description"),

    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("reserve_transactions_member_idx").on(t.memberId, t.occurredAt),
    index("reserve_transactions_membership_idx").on(t.membershipId),
    index("reserve_transactions_trip_idx").on(t.tripId),
    index("reserve_transactions_invoice_idx").on(t.invoiceId),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type ReserveTransaction = typeof reserveTransactions.$inferSelect;
export type NewReserveTransaction = typeof reserveTransactions.$inferInsert;
