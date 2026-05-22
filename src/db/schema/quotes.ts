import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aircraftCategoryEnum, cateringTierEnum, groundTypeEnum } from "./enums";
import { members } from "./members";
import { staff } from "./staff";
import { users } from "./users";

// ─── Enums specific to quotes ─────────────────────────────────────────────

export const tripTypeEnum = pgEnum("trip_type", ["one_way", "round", "multi_leg"]);

export const quoteSourceEnum = pgEnum("quote_source", [
  "homepage_widget",
  "quote_wizard",
  "dispatch_phone",
  "dispatch_email",
  "empty_leg_inquiry",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "submitted",
  "triaged",
  "sourcing",
  "options_sent",
  "held",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "converted",
]);

export const bestTimeEnum = pgEnum("best_time", [
  "any",
  "morning",
  "midday",
  "afternoon",
  "evening",
  "latenight",
]);

// ─── Quote-code sequence + generator ──────────────────────────────────────
// (function lives in the RLS migration, table here so Drizzle owns it)

export const quoteCodeSequence = pgTable("quote_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── quotes ───────────────────────────────────────────────────────────────

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Filled by the quotes_default_quote_code trigger; .default("") makes it
    // optional in Drizzle's insert type so the action doesn't pass it.
    quoteCode: text("quote_code").notNull().default(""),

    // Originator — exactly one of member_id / created_by_user_id /
    // contact_snapshot identifies who sent it.
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactSnapshot: jsonb("contact_snapshot").$type<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneE164?: string;
      phoneCountry?: string;
      company?: string;
      account?: "new" | "returning";
    } | null>(),

    source: quoteSourceEnum("source").notNull().default("quote_wizard"),

    // Trip shape
    tripType: tripTypeEnum("trip_type").notNull(),
    paxCount: integer("pax_count").notNull(),
    childrenCount: integer("children_count").notNull().default(0),
    petsCount: integer("pets_count").notNull().default(0),
    extraBagsCount: integer("extra_bags_count").notNull().default(0),

    // Aircraft + preferences
    requestedCategory: aircraftCategoryEnum("requested_category"),
    cabinPrefs: jsonb("cabin_prefs").$type<{
      wifi: boolean;
      attendant: boolean;
      lavatory: boolean;
      standup: boolean;
      lieflat: boolean;
      pet: boolean;
    } | null>(),
    cateringTier: cateringTierEnum("catering_tier").default("standard"),
    groundOption: groundTypeEnum("ground_option").default("sedan"),
    notes: text("notes"),

    // Contact preferences
    contactMethods: jsonb("contact_methods").$type<{
      email: boolean;
      phone: boolean;
      sms: boolean;
    } | null>(),
    bestTime: bestTimeEnum("best_time").default("any"),
    referralSource: text("referral_source"),

    // Consent
    consentBroker: boolean("consent_broker").notNull().default(false),
    consentContact: boolean("consent_contact").notNull().default(false),
    consentMarketing: boolean("consent_marketing").notNull().default(false),

    // Idempotency — client-generated UUID, dedupes retries of the same
    // submit (network drop after insert, double-clicked button, etc.).
    // Unique partial index in migration 0021; null is permitted for legacy
    // paths that don't set it.
    clientIdempotencyKey: text("client_idempotency_key"),

    // Lifecycle
    status: quoteStatusEnum("status").notNull().default("submitted"),
    assignedDispatcherId: uuid("assigned_dispatcher_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    // Set by convertQuoteToTrip Server Action; FK declared as a raw uuid
    // here to avoid a Drizzle circular import with trips.ts. The constraint
    // is enforced by the hand-written 0008 migration below.
    convertedTripId: uuid("converted_trip_id"),

    // SLA — 30 minutes from received_at during operating hours (we just
    // set received_at + 30m here; ops-hour adjustment runs in app code).
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    slaDeadlineAt: timestamp("sla_deadline_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 minutes'`),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),

    // Pricing (filled later by dispatch)
    indicativeLowUsd: integer("indicative_low_usd"),
    indicativeHighUsd: integer("indicative_high_usd"),
    finalPriceUsd: integer("final_price_usd"),
    marginPct: numeric("margin_pct", { precision: 5, scale: 2 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("quotes_quote_code_uq").on(t.quoteCode),
    index("quotes_status_idx").on(t.status),
    index("quotes_member_idx").on(t.memberId),
    index("quotes_dispatcher_idx").on(t.assignedDispatcherId),
    index("quotes_sla_idx").on(t.slaDeadlineAt),
    check("quotes_pax_range", sql`${t.paxCount} >= 1 and ${t.paxCount} <= 19`),
    check(
      "quotes_notes_length",
      sql`${t.notes} is null or char_length(${t.notes}) <= 800`,
    ),
  ],
);

// ─── quote_legs ───────────────────────────────────────────────────────────

export const quoteLegs = pgTable(
  "quote_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    legNumber: integer("leg_number").notNull(),

    fromIcao: text("from_icao"),
    fromIata: text("from_iata"),
    fromCity: text("from_city"),
    fromName: text("from_name"),

    toIcao: text("to_icao"),
    toIata: text("to_iata"),
    toCity: text("to_city"),
    toName: text("to_name"),

    departDate: date("depart_date"),
    departTime: time("depart_time"),
    departTz: text("depart_tz"),

    distanceNm: integer("distance_nm"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("quote_legs_quote_leg_uq").on(t.quoteId, t.legNumber),
    index("quote_legs_route_idx").on(t.fromIata, t.toIata),
  ],
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteLeg = typeof quoteLegs.$inferSelect;
export type NewQuoteLeg = typeof quoteLegs.$inferInsert;
