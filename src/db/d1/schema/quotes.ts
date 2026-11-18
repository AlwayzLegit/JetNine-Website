// D1 (SQLite) twin of src/db/schema/quotes.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, hexToken24, inFuture, newId, nowDate } from "../helpers";
import { tripTypeEnum, quoteSourceEnum, quoteStatusEnum, bestTimeEnum } from "../../schema/quotes";
import { aircraftCategoryEnum, cateringTierEnum, groundTypeEnum } from "../../schema/enums";
import { airports } from "./airports";
import { members } from "./members";
import { staff } from "./staff";
import { users } from "./users";

// ─── Enums specific to quotes ─────────────────────────────────────────────

// ─── Quote-code sequence + generator ──────────────────────────────────────
// (function lives in the RLS migration, table here so Drizzle owns it)

export const quoteCodeSequence = sqliteTable("quote_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── quotes ───────────────────────────────────────────────────────────────

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // Filled by the quotes_default_quote_code trigger; .default("") makes it
    // optional in Drizzle's insert type so the action doesn't pass it.
    quoteCode: text("quote_code").notNull().default(""),

    // Originator — exactly one of member_id / created_by_user_id /
    // contact_snapshot identifies who sent it.
    memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactSnapshot: text("contact_snapshot", { mode: "json" }).$type<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneE164?: string;
      phoneCountry?: string;
      company?: string;
      account?: "new" | "returning";
    } | null>(),

    source: text("source", { enum: quoteSourceEnum.enumValues }).notNull().default("quote_wizard"),

    // Trip shape
    tripType: text("trip_type", { enum: tripTypeEnum.enumValues }).notNull(),
    paxCount: integer("pax_count").notNull(),
    childrenCount: integer("children_count").notNull().default(0),
    petsCount: integer("pets_count").notNull().default(0),
    extraBagsCount: integer("extra_bags_count").notNull().default(0),

    // Aircraft + preferences
    requestedCategory: text("requested_category", { enum: aircraftCategoryEnum.enumValues }),
    cabinPrefs: text("cabin_prefs", { mode: "json" }).$type<{
      wifi: boolean;
      attendant: boolean;
      lavatory: boolean;
      standup: boolean;
      lieflat: boolean;
      pet: boolean;
    } | null>(),
    cateringTier: text("catering_tier", { enum: cateringTierEnum.enumValues }).default("standard"),
    groundOption: text("ground_option", { enum: groundTypeEnum.enumValues }).default("sedan"),
    notes: text("notes"),

    // Contact preferences
    contactMethods: text("contact_methods", { mode: "json" }).$type<{
      email: boolean;
      phone: boolean;
      sms: boolean;
    } | null>(),
    bestTime: text("best_time", { enum: bestTimeEnum.enumValues }).default("any"),
    referralSource: text("referral_source"),

    // Consent
    consentBroker: integer("consent_broker", { mode: "boolean" }).notNull().default(false),
    consentContact: integer("consent_contact", { mode: "boolean" }).notNull().default(false),
    consentMarketing: integer("consent_marketing", { mode: "boolean" }).notNull().default(false),

    // Idempotency — client-generated UUID, dedupes retries of the same
    // submit (network drop after insert, double-clicked button, etc.).
    // Unique partial index in migration 0021; null is permitted for legacy
    // paths that don't set it.
    clientIdempotencyKey: text("client_idempotency_key"),

    // Guest status link — /request/<token>. 24 random bytes as hex. The
    // database defaults it so every insert path has one (migration 0048
    // backfilled older rows); the submit action also sets it explicitly
    // so it can build the link without a second read. Stored in clear
    // text like the watchlist unsubscribe token: the link has to be
    // readable at send time for every later email, and the row it
    // unlocks is the quote itself, so a leaked dump gains nothing extra.
    statusToken: text("status_token")
      .notNull()
      .$defaultFn(hexToken24),

    // Lifecycle
    status: text("status", { enum: quoteStatusEnum.enumValues }).notNull().default("submitted"),
    assignedDispatcherId: text("assigned_dispatcher_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    // Set by convertQuoteToTrip Server Action; FK declared as a raw uuid
    // here to avoid a Drizzle circular import with trips.ts. The constraint
    // is enforced by the hand-written 0008 migration below.
    convertedTripId: text("converted_trip_id"),

    // SLA — 30 minutes from received_at during operating hours (we just
    // set received_at + 30m here; ops-hour adjustment runs in app code).
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    slaDeadlineAt: integer("sla_deadline_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => inFuture(30 * 60 * 1000)),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
    // Stamped by the SLA-watch cron when a breach alert has been sent, so
    // each breached quote pages the desk exactly once.
    slaAlertedAt: integer("sla_alerted_at", { mode: "timestamp_ms" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),

    // Pricing (filled later by dispatch)
    indicativeLowUsd: integer("indicative_low_usd"),
    indicativeHighUsd: integer("indicative_high_usd"),
    finalPriceUsd: integer("final_price_usd"),
    marginPct: text("margin_pct"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    uniqueIndex("quotes_quote_code_uq").on(t.quoteCode),
    uniqueIndex("quotes_status_token_uq").on(t.statusToken),
    // Postgres has this one (migration 0021); the twin lacked it (OPS-153). Without it a
    // double click on D1 could make two quotes. A partial index: most quotes carry no key.
    uniqueIndex("quotes_client_idempotency_key_uq")
      .on(t.clientIdempotencyKey)
      .where(sql`${t.clientIdempotencyKey} is not null`),
    index("quotes_status_idx").on(t.status),
    index("quotes_member_idx").on(t.memberId),
    index("quotes_dispatcher_idx").on(t.assignedDispatcherId),
    index("quotes_sla_idx").on(t.slaDeadlineAt),
    check("quotes_pax_range", sql`${t.paxCount} >= 1 and ${t.paxCount} <= 19`),
    check(
      "quotes_notes_length",
      sql`${t.notes} is null or length(${t.notes}) <= 800`,
    ),
    enumCheck("quotes_source_enum", t.source, quoteSourceEnum.enumValues),
    enumCheck("quotes_trip_type_enum", t.tripType, tripTypeEnum.enumValues),
    enumCheck("quotes_requested_category_enum", t.requestedCategory, aircraftCategoryEnum.enumValues),
    enumCheck("quotes_catering_tier_enum", t.cateringTier, cateringTierEnum.enumValues),
    enumCheck("quotes_ground_option_enum", t.groundOption, groundTypeEnum.enumValues),
    enumCheck("quotes_best_time_enum", t.bestTime, bestTimeEnum.enumValues),
    enumCheck("quotes_status_enum", t.status, quoteStatusEnum.enumValues),
  ]);

// ─── quote_legs ───────────────────────────────────────────────────────────

export const quoteLegs = sqliteTable(
  "quote_legs",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    legNumber: integer("leg_number").notNull(),

    fromIcao: text("from_icao").references(() => airports.icao, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    fromIata: text("from_iata"),
    fromCity: text("from_city"),
    fromName: text("from_name"),

    toIcao: text("to_icao").references(() => airports.icao, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    toIata: text("to_iata"),
    toCity: text("to_city"),
    toName: text("to_name"),

    departDate: text("depart_date"),
    departTime: text("depart_time"),
    departTz: text("depart_tz"),

    distanceNm: integer("distance_nm"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("quote_legs_quote_leg_uq").on(t.quoteId, t.legNumber),
    index("quote_legs_route_idx").on(t.fromIata, t.toIata),
    index("quote_legs_from_icao_idx").on(t.fromIcao),
    index("quote_legs_to_icao_idx").on(t.toIcao),
  ]);

