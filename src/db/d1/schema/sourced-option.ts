// D1 (SQLite) twin of src/db/schema/sourced-option.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { sourcedOptionStatusEnum, markupTypeEnum } from "../../schema/sourced-option";
import { aircraftCategoryEnum } from "../../schema/enums";
import { operatorVettingArgusEnum } from "../../schema/operators";
import { operators } from "./operators";
import { quotes } from "./quotes";

// ─── Enums ───────────────────────────────────────────────────────────────

// ─── sourced_options ───────────────────────────────────────────────────────
// The airframes a dispatcher sources out of Avinode during a quote's
// `sourcing` state. Avinode has no API, so these are pasted in (see
// lib/avinode-parse.ts) and reconciled against the operators table to
// enforce the safety floor and apply markup. Server-written via the service
// role; staff-readable only (operator cost is internal). Child of `quotes`,
// mirroring quote_legs.

export const sourcedOptions = sqliteTable(
  "sourced_options",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    // Per-quote ordinal (1,2,3…). Unique with quoteId, like quote_legs.
    optionNumber: integer("option_number").notNull(),
    avinodeRef: text("avinode_ref"),

    // Aircraft
    aircraftType: text("aircraft_type"),
    tailNumber: text("tail_number"),
    isFloatingFleet: integer("is_floating_fleet", { mode: "boolean" }).notNull().default(false),
    yearOfMake: integer("year_of_make"),
    category: text("category", { enum: aircraftCategoryEnum.enumValues }), // normalized to DB enum (`ulr`)
    paxCapacity: integer("pax_capacity"),
    refurbInteriorYear: integer("refurb_interior_year"),
    refurbExteriorYear: integer("refurb_exterior_year"),

    // Operator + safety (vetting fields snapshot the operator at paste time)
    operatorNameRaw: text("operator_name_raw"),
    operatorId: text("operator_id").references(() => operators.id, {
      onDelete: "set null",
    }),
    operatorMatched: integer("operator_matched", { mode: "boolean" }).notNull().default(false),
    argusRating: text("argus_rating", { enum: operatorVettingArgusEnum.enumValues }),
    wyvernWingman: integer("wyvern_wingman", { mode: "boolean" }),
    isbaoStage: integer("isbao_stage"),
    safetyFloorPassed: integer("safety_floor_passed", { mode: "boolean" }).notNull().default(false),

    // Positioning + timing
    positioningTimeMin: integer("positioning_time_min"),
    positioningAirport: text("positioning_airport"),
    totalFlightTimeMin: integer("total_flight_time_min"),

    // Pricing — operator cost in, client price = cost + markup (computed
    // server-side; see the quote actions). Whole USD like invoices.
    operatorCostUsd: integer("operator_cost_usd"),
    markupType: text("markup_type", { enum: markupTypeEnum.enumValues }).notNull().default("percent"),
    markupValue: text("markup_value"),
    clientPriceUsd: integer("client_price_usd"),
    softHoldExpiry: integer("soft_hold_expiry", { mode: "timestamp_ms" }),

    // Workflow — at most one `isChosen` per quote (enforced in the action);
    // the chosen option drives trip/invoice pricing on convert.
    status: text("status", { enum: sourcedOptionStatusEnum.enumValues }).notNull().default("sourced"),
    isChosen: integer("is_chosen", { mode: "boolean" }).notNull().default(false),
    dispatcherNotes: text("dispatcher_notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("sourced_options_quote_option_uq").on(t.quoteId, t.optionNumber),
    index("sourced_options_quote_idx").on(t.quoteId),
    enumCheck("sourced_options_category_enum", t.category, aircraftCategoryEnum.enumValues),
    enumCheck("sourced_options_argus_rating_enum", t.argusRating, operatorVettingArgusEnum.enumValues),
    enumCheck("sourced_options_markup_type_enum", t.markupType, markupTypeEnum.enumValues),
    enumCheck("sourced_options_status_enum", t.status, sourcedOptionStatusEnum.enumValues),
  ]);

