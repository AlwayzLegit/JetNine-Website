// D1 (SQLite) twin of src/db/schema/member-prefs.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { aircraftCategoryEnum, cateringTierEnum, companionRelationEnum, docTypeEnum, groundTypeEnum } from "../../schema/enums";
import { members } from "./members";

// ─── member_preferences (1:1 with members) ────────────────────────────────

export const memberPreferences = sqliteTable("member_preferences", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),

  // Aircraft
  defaultAircraftCategory: text("default_aircraft_category", { enum: aircraftCategoryEnum.enumValues }),

  // Cabin defaults — booleans
  cabinWifi: integer("cabin_wifi", { mode: "boolean" }).notNull().default(true),
  cabinStandup: integer("cabin_standup", { mode: "boolean" }).notNull().default(false),
  cabinLavatoryEnclosed: integer("cabin_lavatory_enclosed", { mode: "boolean" }).notNull().default(true),
  cabinLieflat: integer("cabin_lieflat", { mode: "boolean" }).notNull().default(false),
  cabinFlightAttendant: integer("cabin_flight_attendant", { mode: "boolean" }).notNull().default(false),
  cabinPetFriendly: integer("cabin_pet_friendly", { mode: "boolean" }).notNull().default(false),
  // "Force a lie-flat seat on every leg longer than N hours"
  lieflatMinHours: integer("lieflat_min_hours").notNull().default(5),

  // Catering
  cateringTier: text("catering_tier", { enum: cateringTierEnum.enumValues }).notNull().default("standard"),
  dietary: text("dietary"),
  barPreferences: text("bar_preferences"),
  standingCateringNotes: text("standing_catering_notes"),

  // Ground
  groundType: text("ground_type", { enum: groundTypeEnum.enumValues }).notNull().default("sedan"),
  groundVendor: text("ground_vendor"),
  // { ICAO → fbo_name }
  fboDefaults: text("fbo_defaults", { mode: "json" }).$type<Record<string, string> | null>(),
  arrivalWindowMinutes: integer("arrival_window_minutes").notNull().default(15),

  // Comms
  commsVoice: integer("comms_voice", { mode: "boolean" }).notNull().default(true),
  commsEmail: integer("comms_email", { mode: "boolean" }).notNull().default(true),
  commsSmsUpdates: integer("comms_sms_updates", { mode: "boolean" }).notNull().default(false),
  commsSmsEmptyLeg: integer("comms_sms_empty_leg", { mode: "boolean" }).notNull().default(false),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  quietHoursTz: text("quiet_hours_tz"),

  // Empty-leg watchlist threshold (alert me only if discount ≥ N%)
  emptyLegAlertThresholdPct: integer("empty_leg_alert_threshold_pct")
    .notNull()
    .default(40),

  // Privacy
  anonymizeManifest: integer("anonymize_manifest", { mode: "boolean" }).notNull().default(false),
  blockFlightTracking: integer("block_flight_tracking", { mode: "boolean" }).notNull().default(false),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate).$onUpdate(nowDate),
},
  (t) => [
    enumCheck("member_preferences_default_aircraft_category_enum", t.defaultAircraftCategory, aircraftCategoryEnum.enumValues),
    enumCheck("member_preferences_catering_tier_enum", t.cateringTier, cateringTierEnum.enumValues),
    enumCheck("member_preferences_ground_type_enum", t.groundType, groundTypeEnum.enumValues),
  ]
);

// ─── member_lanes (frequent routes) ──────────────────────────────────────

export const memberLanes = sqliteTable(
  "member_lanes",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    fromIcao: text("from_icao").notNull(),
    toIcao: text("to_icao").notNull(),
    frequencyPerYear: integer("frequency_per_year"),
    seasonal: integer("seasonal", { mode: "boolean" }).notNull().default(false),
    lastFlownAt: text("last_flown_at"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    uniqueIndex("member_lanes_unique").on(t.memberId, t.fromIcao, t.toIcao),
    index("member_lanes_member_idx").on(t.memberId),
  ]);

// ─── companions (named co-travelers + pets) ──────────────────────────────

export const companions = sqliteTable(
  "companions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    relation: text("relation", { enum: companionRelationEnum.enumValues }).notNull(),
    legalName: text("legal_name").notNull(),
    birthDate: text("birth_date"),

    // Encrypted at rest (RPC handles encrypt; column stores ciphertext).
    ktnEnc: text("ktn_enc"),

    apisComplete: integer("apis_complete", { mode: "boolean" }).notNull().default(false),
    ccOnItinerary: integer("cc_on_itinerary", { mode: "boolean" }).notNull().default(false),

    // Pet-specific (relation = 'pet')
    speciesBreed: text("species_breed"),
    weightLb: integer("weight_lb"),

    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [index("companions_member_idx").on(t.memberId),
    enumCheck("companions_relation_enum", t.relation, companionRelationEnum.enumValues),
  ]);

// ─── member_documents (travel docs — passport / KTN / GE) ────────────────

export const memberDocuments = sqliteTable(
  "member_documents",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    docType: text("doc_type", { enum: docTypeEnum.enumValues }).notNull(),
    countryIso2: text("country_iso2"),

    // Ciphertext only. Decrypt only via SECURITY DEFINER RPC restricted to
    // admin+. Plaintext never lives on disk.
    numberEnc: text("number_enc"),

    expiresOn: text("expires_on"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("member_documents_member_idx").on(t.memberId, t.docType),
    enumCheck("member_documents_doc_type_enum", t.docType, docTypeEnum.enumValues),
    check("member_documents_country_iso2_len", sql`length(${t.countryIso2}) = 2`),
  ]);

