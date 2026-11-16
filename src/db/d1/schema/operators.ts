// D1 (SQLite) twin of src/db/schema/operators.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { operatorStatusEnum, operatorVettingArgusEnum } from "../../schema/operators";

// ─── Enums ───────────────────────────────────────────────────────────────

// ─── operators ───────────────────────────────────────────────────────────

export const operators = sqliteTable(
  "operators",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    certNumber: text("cert_number"),
    faaPart: text("faa_part").notNull().default("135"),

    homeAirportIcao: text("home_airport_icao"),
    yearsPartner: integer("years_partner"),
    isPreferred: integer("is_preferred", { mode: "boolean" }).notNull().default(false),

    status: text("status", { enum: operatorStatusEnum.enumValues }).notNull().default("active"),

    // Vetting — three big audit programs. We keep the highest individual rating
    // as a column for easy filtering; the rest in the jsonb blob.
    argusRating: text("argus_rating", { enum: operatorVettingArgusEnum.enumValues }).notNull().default("none"),
    wyvernWingman: integer("wyvern_wingman", { mode: "boolean" }).notNull().default(false),
    isbaoStage: integer("isbao_stage"),
    vettingExtras: text("vetting_extras", { mode: "json" }).$type<Record<string, unknown> | null>(),

    argusRenewsOn: text("argus_renews_on"),
    wyvernRenewsOn: text("wyvern_renews_on"),
    isbaoRenewsOn: text("isbao_renews_on"),
    insuranceRenewsOn: text("insurance_renews_on"),
    nextAuditOn: text("next_audit_on"),

    liabilityLimitUsd: integer("liability_limit_usd", { mode: "number" }),
    paymentTerms: text("payment_terms"),
    volumeDiscountPct: text("volume_discount_pct"),
    rateLock: integer("rate_lock", { mode: "boolean" }).notNull().default(false),

    notes: text("notes"),
    suspendedReason: text("suspended_reason"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("operators_status_idx").on(t.status),
    index("operators_preferred_idx").on(t.isPreferred),
    index("operators_argus_idx").on(t.argusRating),
    uniqueIndex("operators_cert_number_uq").on(t.certNumber),
    enumCheck("operators_status_enum", t.status, operatorStatusEnum.enumValues),
    enumCheck("operators_argus_rating_enum", t.argusRating, operatorVettingArgusEnum.enumValues),
  ]);

// ─── operator_contacts ───────────────────────────────────────────────────

export const operatorContacts = sqliteTable(
  "operator_contacts",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    phoneE164: text("phone_e164"),
    email: text("email"),
    isEscalation: integer("is_escalation", { mode: "boolean" }).notNull().default(false),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [index("operator_contacts_operator_idx").on(t.operatorId)]);

