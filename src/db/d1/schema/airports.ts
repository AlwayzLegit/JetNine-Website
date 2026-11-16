// D1 (SQLite) twin of src/db/schema/airports.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { airportCustomsEnum } from "../../schema/airports";

/**
 * Airports catalog. Pre-Phase-B.2 the wizard + planner used a hardcoded
 * 43-entry array in src/lib/airports.ts; now that lives in the DB so we
 * can grow it past memory, attach FBO/customs data, and let dispatch
 * curate the network without redeploys.
 *
 * ICAO is the primary identifier (4-letter, globally unique). IATA is
 * 3-letter and may collide across regions or be missing entirely for
 * smaller fields; kept indexed for autocomplete but not unique.
 *
 * `category` is a free-text bucket ("intl" / "domestic" / "private" /
 * "regional") because the FAA/ICAO categorization scheme is more nuanced
 * than we need at the broker tier.
 *
 * quote_legs / trip_legs / empty_legs / aircraft_schedule_blocks FK their
 * ICAO columns to `airports.icao` (migration 0026). empty_legs uses
 * RESTRICT on delete because its ICAOs are NOT NULL; the others use SET
 * NULL so historical legs survive an airport being retired.
 */


export const airports = sqliteTable(
  "airports",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    // 4-letter ICAO identifier. Unique, the source of truth.
    icao: text("icao").notNull(),
    // 3-letter IATA identifier. Indexed but not unique — small private
    // fields routinely lack one and a handful collide globally.
    iata: text("iata"),

    name: text("name").notNull(),
    city: text("city").notNull(),
    region: text("region"), // state / province / canton
    countryIso2: text("country_iso2").notNull(),

    lat: text("lat").notNull(),
    lon: text("lon").notNull(),
    elevationFt: integer("elevation_ft"),
    tz: text("tz"), // IANA tz, e.g. "America/Los_Angeles"

    // High-level bucket for filtering; null for unknown.
    category: text("category"),
    // Runway capability — minimum jet that can safely operate. Used by
    // the planner to flag candidate aircraft against destination
    // restrictions ("Aspen rejects supermid+").
    longestRunwayFt: integer("longest_runway_ft"),

    customs: text("customs", { enum: airportCustomsEnum.enumValues }).notNull().default("none"),
    slotControlled: integer("slot_controlled", { mode: "boolean" }).notNull().default(false),
    privateOnly: integer("private_only", { mode: "boolean" }).notNull().default(false),

    active: integer("active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("airports_icao_uq").on(t.icao),
    index("airports_iata_idx").on(t.iata),
    index("airports_country_idx").on(t.countryIso2),
    index("airports_city_idx").on(t.city),
    enumCheck("airports_customs_enum", t.customs, airportCustomsEnum.enumValues),
    check("airports_icao_len", sql`length(${t.icao}) = 4`),
    check("airports_iata_len", sql`length(${t.iata}) = 3`),
    check("airports_country_iso2_len", sql`length(${t.countryIso2}) = 2`),
  ]);

/**
 * Fixed Base Operators — the FBO is what passengers actually touch on the
 * ground. Most class-B and most private-jet airports have 1–4 FBOs. A trip
 * leg references an FBO by id (when known) so dispatch can email
 * arrival/catering instructions to the right desk.
 */

export const fbos = sqliteTable(
  "fbos",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    airportId: text("airport_id")
      .notNull()
      .references(() => airports.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    // The cleaner ramps generally beat the cheaper ones; dispatch defaults
    // to preferred unless the member's prefs override.
    isPreferred: integer("is_preferred", { mode: "boolean" }).notNull().default(false),

    radioFreqMhz: text("radio_freq_mhz"),
    phoneE164: text("phone_e164"),
    afterHoursPhoneE164: text("after_hours_phone_e164"),
    email: text("email"),
    website: text("website"),

    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    customs24h: integer("customs_24h", { mode: "boolean" }).notNull().default(false),

    // Free-form notes the desk can drop here: gate code, security quirks,
    // crew rest details.
    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("fbos_airport_idx").on(t.airportId),
    uniqueIndex("fbos_airport_name_uq").on(t.airportId, t.name),
  ]);

