import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { members } from "./members";
import { trips } from "./trips";

export const invoiceKindEnum = pgEnum("invoice_kind", [
  "charter",
  "credit",
  "refund",
  "top_up",
  "renewal",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "due",
  "paid",
  "overdue",
  "credit",
  "void",
]);

export const invoiceCodeSequence = pgTable("invoice_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auto-filled by trigger to `INV-YYYY-NNNN`.
    invoiceCode: text("invoice_code").notNull().default(""),

    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),

    kind: invoiceKindEnum("kind").notNull().default("charter"),

    issuedOn: date("issued_on")
      .notNull()
      .default(sql`current_date`),
    dueOn: date("due_on"),
    paidOn: date("paid_on"),
    // Precise timestamp the webhook handler stamped. `paidOn` stays as the
    // calendar-day rollup for member-facing display.
    paidAt: timestamp("paid_at", { withTimezone: true }),

    // Stripe linkage — populated when a checkout session is created
    // (session id) and again on success when the underlying payment
    // intent is finalised. Unique partial indexes prevent duplicate
    // bindings across invoices.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    status: invoiceStatusEnum("status").notNull().default("draft"),

    // Money lives in integer USD cents-times-100 historically, but for v1
    // we keep dollar integers to match quotes.indicative_*_usd.
    subtotalUsd: integer("subtotal_usd"),
    fetUsd: integer("fet_usd"), // 7.5% federal excise tax
    segmentFeeUsd: integer("segment_fee_usd"), // $5.20 × pax
    totalUsd: integer("total_usd"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("invoices_invoice_code_uq").on(t.invoiceCode),
    index("invoices_status_idx").on(t.status),
    index("invoices_member_idx").on(t.memberId, t.issuedOn),
    index("invoices_trip_idx").on(t.tripId),
  ],
);

/**
 * Idempotency log for Stripe webhook events. Primary key is the Stripe
 * event id (`evt_...`); the webhook handler inserts before processing so
 * a replayed event short-circuits instead of double-processing a payment.
 *
 * Server-only — anon / authenticated have no grants (see migration 0027).
 */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [index("stripe_webhook_events_type_idx").on(t.type, t.receivedAt)],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type NewStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
