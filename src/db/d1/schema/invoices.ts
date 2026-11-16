// D1 (SQLite) twin of src/db/schema/invoices.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate, todayText } from "../helpers";
import { invoiceKindEnum, invoiceStatusEnum } from "../../schema/invoices";
import { members } from "./members";
import { trips } from "./trips";

export const invoiceCodeSequence = sqliteTable("invoice_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // Auto-filled by trigger to `INV-YYYY-NNNN`.
    invoiceCode: text("invoice_code").notNull().default(""),

    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),

    kind: text("kind", { enum: invoiceKindEnum.enumValues }).notNull().default("charter"),

    issuedOn: text("issued_on")
      .notNull()
      .$defaultFn(todayText),
    dueOn: text("due_on"),
    // Dunning-cron claim stamps — at most one due-soon reminder and one
    // overdue notice per invoice (see /api/cron/invoice-watch).
    dueReminderSentAt: integer("due_reminder_sent_at", { mode: "timestamp_ms" }),
    overdueNotifiedAt: integer("overdue_notified_at", { mode: "timestamp_ms" }),
    paidOn: text("paid_on"),
    // Precise timestamp the webhook handler stamped. `paidOn` stays as the
    // calendar-day rollup for member-facing display.
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),

    // Stripe linkage — populated when a checkout session is created
    // (session id) and again on success when the underlying payment
    // intent is finalised. Unique partial indexes prevent duplicate
    // bindings across invoices.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    status: text("status", { enum: invoiceStatusEnum.enumValues }).notNull().default("draft"),

    // Money lives in integer USD cents-times-100 historically, but for v1
    // we keep dollar integers to match quotes.indicative_*_usd.
    subtotalUsd: integer("subtotal_usd"),
    fetUsd: integer("fet_usd"), // 7.5% federal excise tax
    segmentFeeUsd: integer("segment_fee_usd"), // $5.20 × pax
    totalUsd: integer("total_usd"),

    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("invoices_invoice_code_uq").on(t.invoiceCode),
    index("invoices_status_idx").on(t.status),
    index("invoices_member_idx").on(t.memberId, t.issuedOn),
    index("invoices_trip_idx").on(t.tripId),
    enumCheck("invoices_kind_enum", t.kind, invoiceKindEnum.enumValues),
    enumCheck("invoices_status_enum", t.status, invoiceStatusEnum.enumValues),
  ]);

/**
 * Idempotency log for Stripe webhook events. Primary key is the Stripe
 * event id (`evt_...`); the webhook handler inserts before processing so
 * a replayed event short-circuits instead of double-processing a payment.
 *
 * Server-only — anon / authenticated have no grants (see migration 0027).
 */
export const stripeWebhookEvents = sqliteTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    error: text("error"),
  },
  (t) => [index("stripe_webhook_events_type_idx").on(t.type, t.receivedAt)]);

