// D1 (SQLite) twin of src/db/schema/memberships.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate, todayText } from "../helpers";
import { membershipProgramEnum, membershipStatusEnum, reserveTxKindEnum } from "../../schema/memberships";
import { cateringTierEnum } from "../../schema/enums";
import { invoices } from "./invoices";
import { members } from "./members";
import { trips } from "./trips";

// ─── Enums ───────────────────────────────────────────────────────────────

// ─── memberships ─────────────────────────────────────────────────────────
// One row per program purchase. A member may have multiple historical rows
// but at most one with status='active'. Enforced by the partial unique
// index below.

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    program: text("program", { enum: membershipProgramEnum.enumValues }).notNull(),

    // Pricing & terms
    depositUsd: integer("deposit_usd").notNull(),
    cashbackPct: text("cashback_pct")
      .notNull()
      .default("0"),
    calloutHours: integer("callout_hours").notNull(),
    rateLockMonths: integer("rate_lock_months").notNull().default(24),

    // Allowances
    cateringIncludedTier: text("catering_included_tier", { enum: cateringTierEnum.enumValues }),
    cateringAllowanceUsd: integer("catering_allowance_usd").notNull().default(0),
    groundAllowanceUsd: integer("ground_allowance_usd").notNull().default(0),

    namedCardholdersLimit: integer("named_cardholders_limit").notNull().default(1),
    emptyLegAdvanceMinutes: integer("empty_leg_advance_minutes").notNull().default(30),

    activatedOn: text("activated_on")
      .notNull()
      .$defaultFn(todayText),
    expiresOn: text("expires_on"),
    autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
    nextRenewalDate: text("next_renewal_date"),

    status: text("status", { enum: membershipStatusEnum.enumValues }).notNull().default("active"),

    // Stripe linkage — populated when a self-serve purchase creates
    // the Checkout session, then completed by the webhook on payment
    // success. See migration 0030.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),

    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    index("memberships_member_idx").on(t.memberId, t.status),
    index("memberships_program_idx").on(t.program),
    // Migration 0032 (Postgres), carried over by OPS-149: at most one active membership per member.
    uniqueIndex("memberships_active_per_member_uniq").on(t.memberId).where(sql`${t.status} = 'active'`),
    // Migration 0030 (Postgres), carried over by OPS-162: one Checkout session and one Stripe payment
    // per membership. The webhook's activation relies on them against a double charge.
    uniqueIndex("memberships_stripe_session_uq")
      .on(t.stripeCheckoutSessionId)
      .where(sql`${t.stripeCheckoutSessionId} is not null`),
    uniqueIndex("memberships_stripe_pi_uq")
      .on(t.stripePaymentIntentId)
      .where(sql`${t.stripePaymentIntentId} is not null`),
    enumCheck("memberships_program_enum", t.program, membershipProgramEnum.enumValues),
    enumCheck("memberships_catering_included_tier_enum", t.cateringIncludedTier, cateringTierEnum.enumValues),
    enumCheck("memberships_status_enum", t.status, membershipStatusEnum.enumValues),
  ]);

// ─── reserve_transactions (signed ledger) ────────────────────────────────
// Balance = sum(amount_usd) per member. Top-ups + credit accruals + refunds
// are positive; charter_draws + most adjustments are negative. The ledger
// is append-only; reversals are explicit adjustment rows so the audit
// trail stays intact.

export const reserveTransactions = sqliteTable(
  "reserve_transactions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    membershipId: text("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),

    kind: text("kind", { enum: reserveTxKindEnum.enumValues }).notNull(),
    amountUsd: integer("amount_usd").notNull(), // signed; positive = inflow
    description: text("description"),

    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),

    // Stripe payment_intent that produced this row (top_ups only today).
    // The partial unique index `reserve_tx_top_up_per_intent_uniq` enforces
    // one-row-per-intent so a Dashboard "Resend event" or any future webhook
    // route that surfaces the same intent under a different event id can't
    // double-credit the member's balance.
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("reserve_transactions_member_idx").on(t.memberId, t.occurredAt),
    index("reserve_transactions_membership_idx").on(t.membershipId),
    index("reserve_transactions_trip_idx").on(t.tripId),
    index("reserve_transactions_invoice_idx").on(t.invoiceId),
    // Migration 0032 (Postgres), carried over by OPS-149: one top-up per Stripe payment intent, one refund per draw.
    uniqueIndex("reserve_tx_top_up_per_intent_uniq")
      .on(t.stripePaymentIntentId)
      .where(sql`${t.kind} = 'top_up' and ${t.stripePaymentIntentId} is not null`),
    uniqueIndex("reserve_tx_refund_per_draw_uniq")
      .on(t.tripId, t.invoiceId)
      .where(sql`${t.kind} = 'refund' and ${t.tripId} is not null and ${t.invoiceId} is not null`),
    enumCheck("reserve_transactions_kind_enum", t.kind, reserveTxKindEnum.enumValues),
  ]);

