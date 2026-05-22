import { sql } from "drizzle-orm";
import {
  boolean,
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
import { aircraftCategoryEnum } from "./enums";
import { aircraft } from "./aircraft";
import { airports } from "./airports";
import { members } from "./members";
import { operators } from "./operators";
import { users } from "./users";

export const emptyLegStatusEnum = pgEnum("empty_leg_status", [
  "draft",
  "scheduled",
  "live",
  "sold",
  "cancelled",
  "expired",
]);

// ─── code sequence ───────────────────────────────────────────────────────

export const emptyLegCodeSequence = pgTable("empty_leg_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── empty_legs ──────────────────────────────────────────────────────────

export const emptyLegs = pgTable(
  "empty_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auto-filled by trigger to `EL-YYYY-NNNN`.
    code: text("code").notNull().default(""),

    aircraftId: uuid("aircraft_id").references(() => aircraft.id, { onDelete: "set null" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "restrict" }),
    category: aircraftCategoryEnum("category").notNull(),

    // Route — RESTRICT on delete because from/to are NOT NULL on this
    // table; ops must deactivate an airport rather than hard-delete it
    // while empty legs reference it.
    fromIcao: text("from_icao")
      .notNull()
      .references(() => airports.icao, { onDelete: "restrict", onUpdate: "cascade" }),
    fromIata: text("from_iata"),
    fromCity: text("from_city"),
    fromName: text("from_name"),
    toIcao: text("to_icao")
      .notNull()
      .references(() => airports.icao, { onDelete: "restrict", onUpdate: "cascade" }),
    toIata: text("to_iata"),
    toCity: text("to_city"),
    toName: text("to_name"),

    wheelsUpAt: timestamp("wheels_up_at", { withTimezone: true }).notNull(),
    flightMinutes: integer("flight_minutes"),
    distanceNm: integer("distance_nm"),

    seatsAvailable: integer("seats_available").notNull(),

    // Pricing
    fullCharterRefUsd: integer("full_charter_ref_usd").notNull(),
    listedPriceUsd: integer("listed_price_usd").notNull(),
    discountPct: integer("discount_pct"),
    autoPriceDecay: boolean("auto_price_decay").notNull().default(false),
    minDiscountPct: integer("min_discount_pct").notNull().default(30),

    reserveLockMinutes: integer("reserve_lock_minutes").notNull().default(30),
    petFriendly: boolean("pet_friendly").notNull().default(true),
    allowSplitSectors: boolean("allow_split_sectors").notNull().default(false),

    // Copy
    headline: text("headline"),
    bodyCopy: text("body_copy"),
    smsCopy: text("sms_copy"),

    // Schedule
    boardGoLiveAt: timestamp("board_go_live_at", { withTimezone: true }),
    reserveEarlyAccessAt: timestamp("reserve_early_access_at", { withTimezone: true }),
    smsBlastAt: timestamp("sms_blast_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Visibility
    visibilityFlags: jsonb("visibility_flags").$type<{
      publicBoard: boolean;
      memberMatch: boolean;
      weeklyDigest: boolean;
      affiliateFeed: boolean;
    } | null>(),

    status: emptyLegStatusEnum("status").notNull().default("draft"),

    soldToMemberId: uuid("sold_to_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    soldAt: timestamp("sold_at", { withTimezone: true }),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("empty_legs_code_uq").on(t.code),
    index("empty_legs_status_idx").on(t.status, t.wheelsUpAt),
    index("empty_legs_route_idx").on(t.fromIcao, t.toIcao),
    // empty_legs_route_idx covers from_icao FK lookups (leading column);
    // we need an explicit to_icao index for the reverse FK lookup.
    index("empty_legs_from_icao_idx").on(t.fromIcao),
    index("empty_legs_to_icao_idx").on(t.toIcao),
    index("empty_legs_operator_idx").on(t.operatorId),
  ],
);

// ─── empty_leg_watchlists ────────────────────────────────────────────────

export const emptyLegWatchlists = pgTable(
  "empty_leg_watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    email: text("email"),
    phoneE164: text("phone_e164"),

    fromIcao: text("from_icao"),
    fromText: text("from_text"),
    toIcao: text("to_icao"),
    toText: text("to_text"),

    earliestOn: text("earliest_on"), // YYYY-MM-DD; nullable
    latestOn: text("latest_on"),
    minDiscountPct: integer("min_discount_pct").notNull().default(30),

    notifyChannels: jsonb("notify_channels").$type<{
      email?: boolean;
      sms?: boolean;
    } | null>(),

    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("empty_leg_watchlists_member_idx").on(t.memberId),
    index("empty_leg_watchlists_route_idx").on(t.fromIcao, t.toIcao),
  ],
);

export type EmptyLeg = typeof emptyLegs.$inferSelect;
export type NewEmptyLeg = typeof emptyLegs.$inferInsert;
export type EmptyLegWatchlist = typeof emptyLegWatchlists.$inferSelect;
export type NewEmptyLegWatchlist = typeof emptyLegWatchlists.$inferInsert;
