import { sql } from "drizzle-orm";
import {
  boolean,
  char,
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
 * No FK migrations on existing leg tables in this drop — the catalog
 * arrives as a standalone read-side lookup. Tightening quote_legs /
 * trip_legs / empty_legs / aircraft_schedule_blocks ICAO columns to FK
 * `airports.icao` ships separately once the catalog is fully populated.
 */

export const airportCustomsEnum = pgEnum("airport_customs", [
  "none",
  "user_fee",
  "aoe",
  "intl",
]);

export const airports = pgTable(
  "airports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 4-letter ICAO identifier. Unique, the source of truth.
    icao: char("icao", { length: 4 }).notNull(),
    // 3-letter IATA identifier. Indexed but not unique — small private
    // fields routinely lack one and a handful collide globally.
    iata: char("iata", { length: 3 }),

    name: text("name").notNull(),
    city: text("city").notNull(),
    region: text("region"), // state / province / canton
    countryIso2: char("country_iso2", { length: 2 }).notNull(),

    lat: numeric("lat", { precision: 8, scale: 5 }).notNull(),
    lon: numeric("lon", { precision: 8, scale: 5 }).notNull(),
    elevationFt: integer("elevation_ft"),
    tz: text("tz"), // IANA tz, e.g. "America/Los_Angeles"

    // High-level bucket for filtering; null for unknown.
    category: text("category"),
    // Runway capability — minimum jet that can safely operate. Used by
    // the planner to flag candidate aircraft against destination
    // restrictions ("Aspen rejects supermid+").
    longestRunwayFt: integer("longest_runway_ft"),

    customs: airportCustomsEnum("customs").notNull().default("none"),
    slotControlled: boolean("slot_controlled").notNull().default(false),
    privateOnly: boolean("private_only").notNull().default(false),

    active: boolean("active").notNull().default(true),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("airports_icao_uq").on(t.icao),
    index("airports_iata_idx").on(t.iata),
    index("airports_country_idx").on(t.countryIso2),
    index("airports_city_idx").on(t.city),
  ],
);

/**
 * Fixed Base Operators — the FBO is what passengers actually touch on the
 * ground. Most class-B and most private-jet airports have 1–4 FBOs. A trip
 * leg references an FBO by id (when known) so dispatch can email
 * arrival/catering instructions to the right desk.
 */

export const fbos = pgTable(
  "fbos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    airportId: uuid("airport_id")
      .notNull()
      .references(() => airports.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    // The cleaner ramps generally beat the cheaper ones; dispatch defaults
    // to preferred unless the member's prefs override.
    isPreferred: boolean("is_preferred").notNull().default(false),

    radioFreqMhz: numeric("radio_freq_mhz", { precision: 6, scale: 3 }),
    phoneE164: text("phone_e164"),
    afterHoursPhoneE164: text("after_hours_phone_e164"),
    email: text("email"),
    website: text("website"),

    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    customs24h: boolean("customs_24h").notNull().default(false),

    // Free-form notes the desk can drop here: gate code, security quirks,
    // crew rest details.
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("fbos_airport_idx").on(t.airportId),
    uniqueIndex("fbos_airport_name_uq").on(t.airportId, t.name),
  ],
);

export type Airport = typeof airports.$inferSelect;
export type NewAirport = typeof airports.$inferInsert;
export type Fbo = typeof fbos.$inferSelect;
export type NewFbo = typeof fbos.$inferInsert;
