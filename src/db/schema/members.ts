import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { memberStatusEnum, memberTierEnum } from "./enums";
import { staff } from "./staff";
import { users } from "./users";

/**
 * A member is a paying customer with a profile. One row per user_id at most.
 * member_code format: M-YYYY-NNNN (generated server-side at insert).
 */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),

    memberCode: text("member_code").notNull(),

    legalName: text("legal_name"),
    preferredName: text("preferred_name"),
    birthDate: date("birth_date"),
    mobileE164: text("mobile_e164"),

    companyName: text("company_name"),
    roleTitle: text("role_title"),

    billingEntityName: text("billing_entity_name"),
    billingAddress: jsonb("billing_address").$type<{
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal?: string;
      country?: string;
    } | null>(),

    // Encrypted-at-rest tax ID. pgcrypto policy lives in the RLS migration.
    taxIdEnc: text("tax_id_enc"),

    tier: memberTierEnum("tier").notNull().default("on_demand"),
    tierSince: date("tier_since"),
    memberSince: date("member_since"),

    status: memberStatusEnum("status").notNull().default("active"),

    primaryDispatcherId: uuid("primary_dispatcher_id").references(
      () => staff.id,
      { onDelete: "set null" },
    ),

    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),

    // Denormalized counters refreshed on trip completion. Source of truth
    // is the trips table; these exist for dashboard read-speed.
    lifetimeTripsCache: integer("lifetime_trips_cache").notNull().default(0),
    lifetimeHoursCache: integer("lifetime_hours_cache").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("members_member_code_uq").on(t.memberCode),
    index("members_tier_idx").on(t.tier),
    index("members_status_idx").on(t.status),
    index("members_dispatcher_idx").on(t.primaryDispatcherId),
  ],
);

/**
 * Append-only history of which dispatcher owns which member. Newest row
 * with is_primary=true and ended_on=null wins; members.primary_dispatcher_id
 * caches it for fast lookup.
 */
export const dispatcherAssignments = pgTable(
  "dispatcher_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(true),
    startedOn: date("started_on").notNull(),
    endedOn: date("ended_on"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("dispatcher_assignments_member_idx").on(t.memberId, t.endedOn),
    index("dispatcher_assignments_staff_idx").on(t.staffId),
  ],
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type DispatcherAssignment = typeof dispatcherAssignments.$inferSelect;
