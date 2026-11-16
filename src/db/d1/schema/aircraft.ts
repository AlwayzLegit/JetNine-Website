// D1 (SQLite) twin of src/db/schema/aircraft.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { aircraftStatusEnum, aircraftWifiEnum } from "../../schema/aircraft";
import { aircraftCategoryEnum } from "../../schema/enums";
import { operators } from "./operators";

export const aircraft = sqliteTable(
  "aircraft",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    tailNumber: text("tail_number").notNull(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "restrict" }),

    category: text("category", { enum: aircraftCategoryEnum.enumValues }).notNull(),
    makeModel: text("make_model").notNull(),
    yearManufactured: integer("year_manufactured"),

    seats: integer("seats").notNull(),
    rangeNm: integer("range_nm").notNull(),
    speedKt: integer("speed_kt").notNull(),

    wifiType: text("wifi_type", { enum: aircraftWifiEnum.enumValues }).notNull().default("none"),
    cabinHeightIn: integer("cabin_height_in"),
    standupCabin: integer("standup_cabin", { mode: "boolean" }).notNull().default(false),
    lavatoryEnclosed: integer("lavatory_enclosed", { mode: "boolean" }).notNull().default(false),
    lieflatCapable: integer("lieflat_capable", { mode: "boolean" }).notNull().default(false),
    petFriendly: integer("pet_friendly", { mode: "boolean" }).notNull().default(true),
    flightAttendantStandard: integer("flight_attendant_standard", { mode: "boolean" })
      .notNull()
      .default(false),

    baseIcao: text("base_icao"),
    totalHours: integer("total_hours"),
    lastCCheckOn: text("last_c_check_on"),

    status: text("status", { enum: aircraftStatusEnum.enumValues }).notNull().default("available"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    uniqueIndex("aircraft_tail_number_uq").on(t.tailNumber),
    index("aircraft_operator_idx").on(t.operatorId),
    index("aircraft_category_idx").on(t.category),
    index("aircraft_base_idx").on(t.baseIcao),
    index("aircraft_status_idx").on(t.status),
    enumCheck("aircraft_category_enum", t.category, aircraftCategoryEnum.enumValues),
    enumCheck("aircraft_wifi_type_enum", t.wifiType, aircraftWifiEnum.enumValues),
    enumCheck("aircraft_status_enum", t.status, aircraftStatusEnum.enumValues),
  ]);

