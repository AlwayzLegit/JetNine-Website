import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────

export const operatorStatusEnum = pgEnum("operator_status", [
  "active",
  "audit_due",
  "hold",
  "suspended",
  "banned",
]);

export const operatorVettingArgusEnum = pgEnum("operator_vetting_argus", [
  "platinum",
  "gold",
  "silver",
  "none",
]);

// ─── operators ───────────────────────────────────────────────────────────

export const operators = pgTable(
  "operators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    certNumber: text("cert_number"),
    faaPart: text("faa_part").notNull().default("135"),

    homeAirportIcao: text("home_airport_icao"),
    yearsPartner: integer("years_partner"),
    isPreferred: boolean("is_preferred").notNull().default(false),

    status: operatorStatusEnum("status").notNull().default("active"),

    // Vetting — three big audit programs. We keep the highest individual rating
    // as a column for easy filtering; the rest in the jsonb blob.
    argusRating: operatorVettingArgusEnum("argus_rating").notNull().default("none"),
    wyvernWingman: boolean("wyvern_wingman").notNull().default(false),
    isbaoStage: integer("isbao_stage"),
    vettingExtras: jsonb("vetting_extras").$type<Record<string, unknown> | null>(),

    argusRenewsOn: date("argus_renews_on"),
    wyvernRenewsOn: date("wyvern_renews_on"),
    isbaoRenewsOn: date("isbao_renews_on"),
    insuranceRenewsOn: date("insurance_renews_on"),
    nextAuditOn: date("next_audit_on"),

    liabilityLimitUsd: bigint("liability_limit_usd", { mode: "number" }),
    paymentTerms: text("payment_terms"),
    volumeDiscountPct: numeric("volume_discount_pct", { precision: 5, scale: 2 }),
    rateLock: boolean("rate_lock").notNull().default(false),

    notes: text("notes"),
    suspendedReason: text("suspended_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("operators_status_idx").on(t.status),
    index("operators_preferred_idx").on(t.isPreferred),
    index("operators_argus_idx").on(t.argusRating),
    uniqueIndex("operators_cert_number_uq").on(t.certNumber),
  ],
);

// ─── operator_contacts ───────────────────────────────────────────────────

export const operatorContacts = pgTable(
  "operator_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    phoneE164: text("phone_e164"),
    email: text("email"),
    isEscalation: boolean("is_escalation").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("operator_contacts_operator_idx").on(t.operatorId)],
);

export type Operator = typeof operators.$inferSelect;
export type NewOperator = typeof operators.$inferInsert;
export type OperatorContact = typeof operatorContacts.$inferSelect;
