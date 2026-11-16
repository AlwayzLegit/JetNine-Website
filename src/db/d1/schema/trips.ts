// D1 (SQLite) twin of src/db/schema/trips.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { tripMissionEnum, tripStatusEnum } from "../../schema/trips";
import { aircraft } from "./aircraft";
import { airports } from "./airports";
import { members } from "./members";
import { operators } from "./operators";
import { quotes } from "./quotes";
import { staff } from "./staff";

// ─── Enums ───────────────────────────────────────────────────────────────

// ─── trip-code sequence ──────────────────────────────────────────────────

export const tripCodeSequence = sqliteTable("trip_code_sequence", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

// ─── trips ───────────────────────────────────────────────────────────────

export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // Auto-filled by trigger to `JN-YYYY-NNNN`.
    tripCode: text("trip_code").notNull().default(""),

    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    quoteId: text("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    assignedDispatcherId: text("assigned_dispatcher_id").references(() => staff.id, {
      onDelete: "set null",
    }),

    missionType: text("mission_type", { enum: tripMissionEnum.enumValues }).notNull(),
    isInternational: integer("is_international", { mode: "boolean" }).notNull().default(false),
    paxCount: integer("pax_count").notNull(),
    crewCount: integer("crew_count").notNull().default(2),

    status: text("status", { enum: tripStatusEnum.enumValues }).notNull().default("confirmed"),
    version: integer("version").notNull().default(1),

    aircraftId: text("aircraft_id").references(() => aircraft.id, { onDelete: "set null" }),
    operatorId: text("operator_id").references(() => operators.id, { onDelete: "set null" }),

    billToEntity: text("bill_to_entity"),
    billToTerms: text("bill_to_terms"),

    revenueUsd: integer("revenue_usd"),
    operatorCostUsd: integer("operator_cost_usd"),
    marginPct: text("margin_pct"),
    processorFeeUsd: integer("processor_fee_usd"),

    notesMember: text("notes_member"),
    notesDispatch: text("notes_dispatch"),

    manifestLockedAt: integer("manifest_locked_at", { mode: "timestamp_ms" }),
    apisFiledAt: integer("apis_filed_at", { mode: "timestamp_ms" }),

    wheelsUpAt: integer("wheels_up_at", { mode: "timestamp_ms" }),
    wheelsDownAt: integer("wheels_down_at", { mode: "timestamp_ms" }),
    etaAt: integer("eta_at", { mode: "timestamp_ms" }),

    weightBalanceStatus: text("weight_balance_status"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("trips_trip_code_uq").on(t.tripCode),
    index("trips_status_idx").on(t.status),
    index("trips_member_idx").on(t.memberId),
    index("trips_dispatcher_idx").on(t.assignedDispatcherId),
    index("trips_quote_idx").on(t.quoteId),
    enumCheck("trips_mission_type_enum", t.missionType, tripMissionEnum.enumValues),
    enumCheck("trips_status_enum", t.status, tripStatusEnum.enumValues),
  ]);

// ─── trip_legs ───────────────────────────────────────────────────────────

export const tripLegs = sqliteTable(
  "trip_legs",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    tripId: text("trip_id")
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

    scheduledDepAt: integer("scheduled_dep_at", { mode: "timestamp_ms" }),
    scheduledArrAt: integer("scheduled_arr_at", { mode: "timestamp_ms" }),
    actualDepAt: integer("actual_dep_at", { mode: "timestamp_ms" }),
    actualArrAt: integer("actual_arr_at", { mode: "timestamp_ms" }),

    departDate: text("depart_date"),
    departTime: text("depart_time"),
    departTz: text("depart_tz"),

    distanceNm: integer("distance_nm"),

    routeString: text("route_string"),
    squawk: text("squawk"),
    cruiseAltFl: integer("cruise_alt_fl"),
    fuelOnboardLb: integer("fuel_onboard_lb"),

    alternateIcaos: text("alternate_icaos", { mode: "json" }).$type<string[] | null>(),
    statusNote: text("status_note"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("trip_legs_trip_leg_uq").on(t.tripId, t.legNumber),
    index("trip_legs_route_idx").on(t.fromIata, t.toIata),
    index("trip_legs_from_icao_idx").on(t.fromIcao),
    index("trip_legs_to_icao_idx").on(t.toIcao),
  ]);

