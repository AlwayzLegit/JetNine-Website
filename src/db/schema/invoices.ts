import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
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

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
