// D1 (SQLite) twin of src/db/schema/members.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { memberStatusEnum, memberTierEnum } from "../../schema/enums";
import { staff } from "./staff";
import { users } from "./users";

// Counter behind member_code (M-YYYY-NNNN). Its Postgres twin arrives with OPS-101
// (the table has existed in Postgres since migration 0001); nextCode() advances it.
export const memberCodeSequence = sqliteTable("member_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

/**
 * A member is a paying customer with a profile. One row per user_id at most.
 * member_code format: M-YYYY-NNNN (generated server-side at insert).
 */
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),

    memberCode: text("member_code").notNull(),

    legalName: text("legal_name"),
    preferredName: text("preferred_name"),
    birthDate: text("birth_date"),
    mobileE164: text("mobile_e164"),

    companyName: text("company_name"),
    roleTitle: text("role_title"),

    billingEntityName: text("billing_entity_name"),
    billingAddress: text("billing_address", { mode: "json" }).$type<{
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal?: string;
      country?: string;
    } | null>(),

    // Encrypted-at-rest tax ID. pgcrypto policy lives in the RLS migration.
    taxIdEnc: text("tax_id_enc"),

    tier: text("tier", { enum: memberTierEnum.enumValues }).notNull().default("on_demand"),
    tierSince: text("tier_since"),
    memberSince: text("member_since"),

    status: text("status", { enum: memberStatusEnum.enumValues }).notNull().default("active"),

    primaryDispatcherId: text("primary_dispatcher_id").references(
      () => staff.id,
      { onDelete: "set null" },
    ),

    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(false),

    // Denormalized counters refreshed on trip completion. Source of truth
    // is the trips table; these exist for dashboard read-speed.
    lifetimeTripsCache: integer("lifetime_trips_cache").notNull().default(0),
    lifetimeHoursCache: integer("lifetime_hours_cache").notNull().default(0),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    uniqueIndex("members_member_code_uq").on(t.memberCode),
    index("members_tier_idx").on(t.tier),
    index("members_status_idx").on(t.status),
    index("members_dispatcher_idx").on(t.primaryDispatcherId),
    enumCheck("members_tier_enum", t.tier, memberTierEnum.enumValues),
    enumCheck("members_status_enum", t.status, memberStatusEnum.enumValues),
  ]);

/**
 * Append-only history of which dispatcher owns which member. Newest row
 * with is_primary=true and ended_on=null wins; members.primary_dispatcher_id
 * caches it for fast lookup.
 */
export const dispatcherAssignments = sqliteTable(
  "dispatcher_assignments",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
    startedOn: text("started_on").notNull(),
    endedOn: text("ended_on"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("dispatcher_assignments_member_idx").on(t.memberId, t.endedOn),
    index("dispatcher_assignments_staff_idx").on(t.staffId),
  ]);

