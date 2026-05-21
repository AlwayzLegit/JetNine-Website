import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aircraftCategoryEnum } from "./enums";
import { operators } from "./operators";

export const aircraftStatusEnum = pgEnum("aircraft_status", [
  "available",
  "aog",
  "maint",
  "sold",
]);

export const aircraftWifiEnum = pgEnum("aircraft_wifi", [
  "none",
  "aircell",
  "gogo",
  "ka",
  "yes",
]);

export const aircraft = pgTable(
  "aircraft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tailNumber: text("tail_number").notNull(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "restrict" }),

    category: aircraftCategoryEnum("category").notNull(),
    makeModel: text("make_model").notNull(),
    yearManufactured: integer("year_manufactured"),

    seats: integer("seats").notNull(),
    rangeNm: integer("range_nm").notNull(),
    speedKt: integer("speed_kt").notNull(),

    wifiType: aircraftWifiEnum("wifi_type").notNull().default("none"),
    cabinHeightIn: integer("cabin_height_in"),
    standupCabin: boolean("standup_cabin").notNull().default(false),
    lavatoryEnclosed: boolean("lavatory_enclosed").notNull().default(false),
    lieflatCapable: boolean("lieflat_capable").notNull().default(false),
    petFriendly: boolean("pet_friendly").notNull().default(true),
    flightAttendantStandard: boolean("flight_attendant_standard")
      .notNull()
      .default(false),

    baseIcao: text("base_icao"),
    totalHours: integer("total_hours"),
    lastCCheckOn: date("last_c_check_on"),

    status: aircraftStatusEnum("status").notNull().default("available"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("aircraft_tail_number_uq").on(t.tailNumber),
    index("aircraft_operator_idx").on(t.operatorId),
    index("aircraft_category_idx").on(t.category),
    index("aircraft_base_idx").on(t.baseIcao),
    index("aircraft_status_idx").on(t.status),
  ],
);

export type Aircraft = typeof aircraft.$inferSelect;
export type NewAircraft = typeof aircraft.$inferInsert;
