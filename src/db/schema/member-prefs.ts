import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  aircraftCategoryEnum,
  cateringTierEnum,
  companionRelationEnum,
  docTypeEnum,
  groundTypeEnum,
} from "./enums";
import { members } from "./members";

// ─── member_preferences (1:1 with members) ────────────────────────────────

export const memberPreferences = pgTable("member_preferences", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),

  // Aircraft
  defaultAircraftCategory: aircraftCategoryEnum("default_aircraft_category"),

  // Cabin defaults — booleans
  cabinWifi: boolean("cabin_wifi").notNull().default(true),
  cabinStandup: boolean("cabin_standup").notNull().default(false),
  cabinLavatoryEnclosed: boolean("cabin_lavatory_enclosed").notNull().default(true),
  cabinLieflat: boolean("cabin_lieflat").notNull().default(false),
  cabinFlightAttendant: boolean("cabin_flight_attendant").notNull().default(false),
  cabinPetFriendly: boolean("cabin_pet_friendly").notNull().default(false),
  // "Force a lie-flat seat on every leg longer than N hours"
  lieflatMinHours: integer("lieflat_min_hours").notNull().default(5),

  // Catering
  cateringTier: cateringTierEnum("catering_tier").notNull().default("standard"),
  dietary: text("dietary"),
  barPreferences: text("bar_preferences"),
  standingCateringNotes: text("standing_catering_notes"),

  // Ground
  groundType: groundTypeEnum("ground_type").notNull().default("sedan"),
  groundVendor: text("ground_vendor"),
  // { ICAO → fbo_name }
  fboDefaults: jsonb("fbo_defaults").$type<Record<string, string> | null>(),
  arrivalWindowMinutes: integer("arrival_window_minutes").notNull().default(15),

  // Comms
  commsVoice: boolean("comms_voice").notNull().default(true),
  commsEmail: boolean("comms_email").notNull().default(true),
  commsSmsUpdates: boolean("comms_sms_updates").notNull().default(false),
  commsSmsEmptyLeg: boolean("comms_sms_empty_leg").notNull().default(false),
  quietHoursStart: time("quiet_hours_start"),
  quietHoursEnd: time("quiet_hours_end"),
  quietHoursTz: text("quiet_hours_tz"),

  // Empty-leg watchlist threshold (alert me only if discount ≥ N%)
  emptyLegAlertThresholdPct: integer("empty_leg_alert_threshold_pct")
    .notNull()
    .default(40),

  // Privacy
  anonymizeManifest: boolean("anonymize_manifest").notNull().default(false),
  blockFlightTracking: boolean("block_flight_tracking").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── member_lanes (frequent routes) ──────────────────────────────────────

export const memberLanes = pgTable(
  "member_lanes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    fromIcao: text("from_icao").notNull(),
    toIcao: text("to_icao").notNull(),
    frequencyPerYear: integer("frequency_per_year"),
    seasonal: boolean("seasonal").notNull().default(false),
    lastFlownAt: date("last_flown_at"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("member_lanes_unique").on(t.memberId, t.fromIcao, t.toIcao),
    index("member_lanes_member_idx").on(t.memberId),
  ],
);

// ─── companions (named co-travelers + pets) ──────────────────────────────

export const companions = pgTable(
  "companions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    relation: companionRelationEnum("relation").notNull(),
    legalName: text("legal_name").notNull(),
    birthDate: date("birth_date"),

    // Encrypted at rest (RPC handles encrypt; column stores ciphertext).
    ktnEnc: text("ktn_enc"),

    apisComplete: boolean("apis_complete").notNull().default(false),
    ccOnItinerary: boolean("cc_on_itinerary").notNull().default(false),

    // Pet-specific (relation = 'pet')
    speciesBreed: text("species_breed"),
    weightLb: integer("weight_lb"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("companions_member_idx").on(t.memberId)],
);

// ─── member_documents (travel docs — passport / KTN / GE) ────────────────

export const memberDocuments = pgTable(
  "member_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    docType: docTypeEnum("doc_type").notNull(),
    countryIso2: char("country_iso2", { length: 2 }),

    // Ciphertext only. Decrypt only via SECURITY DEFINER RPC restricted to
    // admin+. Plaintext never lives on disk.
    numberEnc: text("number_enc"),

    expiresOn: date("expires_on"),
    isPrimary: boolean("is_primary").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("member_documents_member_idx").on(t.memberId, t.docType),
  ],
);

export type MemberPreferences = typeof memberPreferences.$inferSelect;
export type NewMemberPreferences = typeof memberPreferences.$inferInsert;
export type MemberLane = typeof memberLanes.$inferSelect;
export type NewMemberLane = typeof memberLanes.$inferInsert;
export type Companion = typeof companions.$inferSelect;
export type NewCompanion = typeof companions.$inferInsert;
export type MemberDocument = typeof memberDocuments.$inferSelect;
export type NewMemberDocument = typeof memberDocuments.$inferInsert;
