// D1 (SQLite) twin of src/db/schema/empty-legs.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, hexToken24, newId, nowDate } from "../helpers";
import { emptyLegStatusEnum } from "../../schema/empty-legs";
import { aircraftCategoryEnum } from "../../schema/enums";
import { aircraft } from "./aircraft";
import { airports } from "./airports";
import { members } from "./members";
import { operators } from "./operators";
import { users } from "./users";


// ─── code sequence ───────────────────────────────────────────────────────

export const emptyLegCodeSequence = sqliteTable("empty_leg_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── empty_legs ──────────────────────────────────────────────────────────

export const emptyLegs = sqliteTable(
  "empty_legs",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // Auto-filled by trigger to `EL-YYYY-NNNN`.
    code: text("code").notNull().default(""),

    aircraftId: text("aircraft_id").references(() => aircraft.id, { onDelete: "set null" }),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "restrict" }),
    category: text("category", { enum: aircraftCategoryEnum.enumValues }).notNull(),

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

    wheelsUpAt: integer("wheels_up_at", { mode: "timestamp_ms" }).notNull(),
    flightMinutes: integer("flight_minutes"),
    distanceNm: integer("distance_nm"),

    seatsAvailable: integer("seats_available").notNull(),

    // Pricing
    fullCharterRefUsd: integer("full_charter_ref_usd").notNull(),
    listedPriceUsd: integer("listed_price_usd").notNull(),
    discountPct: integer("discount_pct"),
    autoPriceDecay: integer("auto_price_decay", { mode: "boolean" }).notNull().default(false),
    minDiscountPct: integer("min_discount_pct").notNull().default(30),

    reserveLockMinutes: integer("reserve_lock_minutes").notNull().default(30),
    petFriendly: integer("pet_friendly", { mode: "boolean" }).notNull().default(true),
    allowSplitSectors: integer("allow_split_sectors", { mode: "boolean" }).notNull().default(false),

    // Copy
    headline: text("headline"),
    bodyCopy: text("body_copy"),
    smsCopy: text("sms_copy"),

    // Schedule
    boardGoLiveAt: integer("board_go_live_at", { mode: "timestamp_ms" }),
    reserveEarlyAccessAt: integer("reserve_early_access_at", { mode: "timestamp_ms" }),
    smsBlastAt: integer("sms_blast_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),

    // Visibility
    visibilityFlags: text("visibility_flags", { mode: "json" }).$type<{
      publicBoard: boolean;
      memberMatch: boolean;
      weeklyDigest: boolean;
      affiliateFeed: boolean;
    } | null>(),

    status: text("status", { enum: emptyLegStatusEnum.enumValues }).notNull().default("draft"),

    soldToMemberId: text("sold_to_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    soldAt: integer("sold_at", { mode: "timestamp_ms" }),

    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
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
    enumCheck("empty_legs_category_enum", t.category, aircraftCategoryEnum.enumValues),
    enumCheck("empty_legs_status_enum", t.status, emptyLegStatusEnum.enumValues),
  ]);

// ─── empty_leg_watchlists ────────────────────────────────────────────────

export const emptyLegWatchlists = sqliteTable(
  "empty_leg_watchlists",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id").references(() => members.id, { onDelete: "cascade" }),
    email: text("email"),
    phoneE164: text("phone_e164"),

    fromIcao: text("from_icao"),
    fromText: text("from_text"),
    toIcao: text("to_icao"),
    toText: text("to_text"),

    earliestOn: text("earliest_on"), // YYYY-MM-DD; nullable
    latestOn: text("latest_on"),
    minDiscountPct: integer("min_discount_pct").notNull().default(30),

    notifyChannels: text("notify_channels", { mode: "json" }).$type<{
      email?: boolean;
      sms?: boolean;
    } | null>(),

    active: integer("active", { mode: "boolean" }).notNull().default(true),
    // Confirmed opt-in, per channel. `active` means "not paused"; these
    // mean "this address proved it wants the alerts". Sending needs both.
    // See src/lib/watchlist-confirm.ts.
    smsConfirmedAt: integer("sms_confirmed_at", { mode: "timestamp_ms" }),
    emailConfirmedAt: integer("email_confirmed_at", { mode: "timestamp_ms" }),
    confirmSmsTokenHash: text("confirm_sms_token_hash"),
    confirmEmailTokenHash: text("confirm_email_token_hash"),
    confirmSentAt: integer("confirm_sent_at", { mode: "timestamp_ms" }),
    /**
     * Plain text on purpose — see migration 0042. A confirmation token
     * grants consent and is hashed; this one only withdraws it, and the
     * cron has to be able to read it to write the link into each alert.
     */
    unsubscribeToken: text("unsubscribe_token")
      .notNull()
      .$defaultFn(hexToken24),
    confirmExpiresAt: integer("confirm_expires_at", { mode: "timestamp_ms" }),
    deactivatedAt: integer("deactivated_at", { mode: "timestamp_ms" }),
    /** "sms_stop" when an inbound STOP switched it off. See src/lib/sms-optout.ts. */
    deactivatedReason: text("deactivated_reason"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("empty_leg_watchlists_member_idx").on(t.memberId),
    index("empty_leg_watchlists_route_idx").on(t.fromIcao, t.toIcao),
    index("empty_leg_watchlists_phone_idx").on(t.phoneE164),
  ]);

// ─── empty_leg_watchlist_matches ─────────────────────────────────────────

// Delivery ledger for the watchlist matcher (src/lib/watchlist-matching.ts,
// driven by /api/cron/empty-leg-watchlists). The unique index on
// (watchlist, leg, channel) is what stops a retry or an overlapping run
// from texting the same person about the same leg twice: the cron inserts
// a `pending` row to claim the send, and only sends if the insert won.

export const emptyLegWatchlistMatches = sqliteTable(
  "empty_leg_watchlist_matches",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    watchlistId: text("watchlist_id")
      .notNull()
      .references(() => emptyLegWatchlists.id, { onDelete: "cascade" }),
    legId: text("leg_id")
      .notNull()
      .references(() => emptyLegs.id, { onDelete: "cascade" }),
    /** "sms" | "email" */
    channel: text("channel").notNull(),
    /** "pending" | "sent" | "failed" */
    status: text("status").notNull().default("pending"),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("empty_leg_watchlist_matches_uq").on(t.watchlistId, t.legId, t.channel),
    index("empty_leg_watchlist_matches_leg_idx").on(t.legId),
  ]);

