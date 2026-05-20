import { pgEnum } from "drizzle-orm/pg-core";

// ─── Identity ─────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "member",
  "dispatcher",
  "admin",
  "superadmin",
  "operator_contact",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "paused",
  "closed",
]);

export const memberTierEnum = pgEnum("member_tier", [
  "on_demand",
  "card_100",
  "card_250",
  "card_500",
  "reserve_50",
  "reserve_100",
  "reserve_250",
  "reserve_500_apply",
]);

export const staffDeskEnum = pgEnum("staff_desk", [
  "west",
  "east",
  "overnight",
  "sourcing",
  "float",
  "lead",
]);

export const staffStatusEnum = pgEnum("staff_status", [
  "on",
  "break",
  "off",
  "on_call",
]);

// ─── Aviation supply (placeholders — populated in phase B) ────────────────
export const aircraftCategoryEnum = pgEnum("aircraft_category", [
  "turboprop",
  "light",
  "midsize",
  "supermid",
  "heavy",
  "ulr",
]);

// ─── Preferences ──────────────────────────────────────────────────────────
export const cateringTierEnum = pgEnum("catering_tier", [
  "standard",
  "plus",
  "premium",
  "custom",
]);

export const groundTypeEnum = pgEnum("ground_type", [
  "none",
  "sedan",
  "suv_sprinter",
  "custom",
]);

export const docTypeEnum = pgEnum("doc_type", [
  "passport",
  "global_entry",
  "known_traveler",
  "second_passport",
]);

export const companionRelationEnum = pgEnum("companion_relation", [
  "spouse",
  "family",
  "business",
  "assistant",
  "pet",
  "other",
]);

export const ruleSeverityEnum = pgEnum("rule_severity", [
  "info",
  "warn",
  "flag",
]);
