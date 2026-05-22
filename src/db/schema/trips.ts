import { sql } from "drizzle-orm";
import {
  boolean,
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
import { aircraft } from "./aircraft";
import { airports } from "./airports";
import { members } from "./members";
import { operators } from "./operators";
import { quotes } from "./quotes";
import { staff } from "./staff";

// ─── Enums ───────────────────────────────────────────────────────────────

export const tripMissionEnum = pgEnum("trip_mission_type", [
  "one_way",
  "round",
  "multi_leg",
  "empty_leg_purchase",
  "repositioning_internal",
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "draft",
  "confirmed",
  "crew_briefed",
  "boarding",
  "airborne",
  "wheels_down",
  "completed",
  "cancelled_wx",
  "cancelled_other",
  "diverted",
  "irregular_ops",
]);

// ─── trip-code sequence ──────────────────────────────────────────────────

export const tripCodeSequence = pgTable("trip_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── trips ───────────────────────────────────────────────────────────────

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auto-filled by trigger to `JN-YYYY-NNNN`.
    tripCode: text("trip_code").notNull().default(""),

    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    assignedDispatcherId: uuid("assigned_dispatcher_id").references(() => staff.id, {
      onDelete: "set null",
    }),

    missionType: tripMissionEnum("mission_type").notNull(),
    isInternational: boolean("is_international").notNull().default(false),
    paxCount: integer("pax_count").notNull(),
    crewCount: integer("crew_count").notNull().default(2),

    status: tripStatusEnum("status").notNull().default("confirmed"),
    version: integer("version").notNull().default(1),

    aircraftId: uuid("aircraft_id").references(() => aircraft.id, { onDelete: "set null" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),

    billToEntity: text("bill_to_entity"),
    billToTerms: text("bill_to_terms"),

    revenueUsd: integer("revenue_usd"),
    operatorCostUsd: integer("operator_cost_usd"),
    marginPct: numeric("margin_pct", { precision: 5, scale: 2 }),
    processorFeeUsd: integer("processor_fee_usd"),

    notesMember: text("notes_member"),
    notesDispatch: text("notes_dispatch"),

    manifestLockedAt: timestamp("manifest_locked_at", { withTimezone: true }),
    apisFiledAt: timestamp("apis_filed_at", { withTimezone: true }),

    wheelsUpAt: timestamp("wheels_up_at", { withTimezone: true }),
    wheelsDownAt: timestamp("wheels_down_at", { withTimezone: true }),
    etaAt: timestamp("eta_at", { withTimezone: true }),

    weightBalanceStatus: text("weight_balance_status"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("trips_trip_code_uq").on(t.tripCode),
    index("trips_status_idx").on(t.status),
    index("trips_member_idx").on(t.memberId),
    index("trips_dispatcher_idx").on(t.assignedDispatcherId),
    index("trips_quote_idx").on(t.quoteId),
  ],
);

// ─── trip_legs ───────────────────────────────────────────────────────────

export const tripLegs = pgTable(
  "trip_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
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

    scheduledDepAt: timestamp("scheduled_dep_at", { withTimezone: true }),
    scheduledArrAt: timestamp("scheduled_arr_at", { withTimezone: true }),
    actualDepAt: timestamp("actual_dep_at", { withTimezone: true }),
    actualArrAt: timestamp("actual_arr_at", { withTimezone: true }),

    departDate: date("depart_date"),
    departTime: time("depart_time"),
    departTz: text("depart_tz"),

    distanceNm: integer("distance_nm"),

    routeString: text("route_string"),
    squawk: text("squawk"),
    cruiseAltFl: integer("cruise_alt_fl"),
    fuelOnboardLb: integer("fuel_onboard_lb"),

    alternateIcaos: jsonb("alternate_icaos").$type<string[] | null>(),
    statusNote: text("status_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("trip_legs_trip_leg_uq").on(t.tripId, t.legNumber),
    index("trip_legs_route_idx").on(t.fromIata, t.toIata),
    index("trip_legs_from_icao_idx").on(t.fromIcao),
    index("trip_legs_to_icao_idx").on(t.toIcao),
  ],
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type TripLeg = typeof tripLegs.$inferSelect;
export type NewTripLeg = typeof tripLegs.$inferInsert;
