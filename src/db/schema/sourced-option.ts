import { sql } from "drizzle-orm";
import {
  boolean,
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
import { aircraftCategoryEnum } from "./enums";
import { operatorVettingArgusEnum, operators } from "./operators";
import { quotes } from "./quotes";

// ─── Enums ───────────────────────────────────────────────────────────────

export const sourcedOptionStatusEnum = pgEnum("sourced_option_status", [
  "sourced",
  "shortlisted",
  "sent_to_client",
  "accepted",
  "rejected",
]);

export const markupTypeEnum = pgEnum("markup_type", ["percent", "flat"]);

// ─── sourced_options ───────────────────────────────────────────────────────
// The airframes a dispatcher sources out of Avinode during a quote's
// `sourcing` state. Avinode has no API, so these are pasted in (see
// lib/avinode-parse.ts) and reconciled against the operators table to
// enforce the safety floor and apply markup. Server-written via the service
// role; staff-readable only (operator cost is internal). Child of `quotes`,
// mirroring quote_legs.

export const sourcedOptions = pgTable(
  "sourced_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    // Per-quote ordinal (1,2,3…). Unique with quoteId, like quote_legs.
    optionNumber: integer("option_number").notNull(),
    avinodeRef: text("avinode_ref"),

    // Aircraft
    aircraftType: text("aircraft_type"),
    tailNumber: text("tail_number"),
    isFloatingFleet: boolean("is_floating_fleet").notNull().default(false),
    yearOfMake: integer("year_of_make"),
    category: aircraftCategoryEnum("category"), // normalized to DB enum (`ulr`)
    paxCapacity: integer("pax_capacity"),
    refurbInteriorYear: integer("refurb_interior_year"),
    refurbExteriorYear: integer("refurb_exterior_year"),

    // Operator + safety (vetting fields snapshot the operator at paste time)
    operatorNameRaw: text("operator_name_raw"),
    operatorId: uuid("operator_id").references(() => operators.id, {
      onDelete: "set null",
    }),
    operatorMatched: boolean("operator_matched").notNull().default(false),
    argusRating: operatorVettingArgusEnum("argus_rating"),
    wyvernWingman: boolean("wyvern_wingman"),
    isbaoStage: integer("isbao_stage"),
    safetyFloorPassed: boolean("safety_floor_passed").notNull().default(false),

    // Positioning + timing
    positioningTimeMin: integer("positioning_time_min"),
    positioningAirport: text("positioning_airport"),
    totalFlightTimeMin: integer("total_flight_time_min"),

    // Pricing — operator cost in, client price = cost + markup (computed
    // server-side; see the quote actions). Whole USD like invoices.
    operatorCostUsd: integer("operator_cost_usd"),
    markupType: markupTypeEnum("markup_type").notNull().default("percent"),
    markupValue: numeric("markup_value", { precision: 10, scale: 2 }),
    clientPriceUsd: integer("client_price_usd"),
    softHoldExpiry: timestamp("soft_hold_expiry", { withTimezone: true }),

    // Workflow — at most one `isChosen` per quote (enforced in the action);
    // the chosen option drives trip/invoice pricing on convert.
    status: sourcedOptionStatusEnum("status").notNull().default("sourced"),
    isChosen: boolean("is_chosen").notNull().default(false),
    dispatcherNotes: text("dispatcher_notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("sourced_options_quote_option_uq").on(t.quoteId, t.optionNumber),
    index("sourced_options_quote_idx").on(t.quoteId),
  ],
);

export type SourcedOption = typeof sourcedOptions.$inferSelect;
export type NewSourcedOption = typeof sourcedOptions.$inferInsert;
