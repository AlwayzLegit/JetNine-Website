import { z } from "zod";
import { aircraftStatusEnum, aircraftWifiEnum } from "@/db/schema/aircraft";
import { airportCustomsEnum } from "@/db/schema/airports";
import { aircraftCategoryEnum } from "@/db/schema/enums";
import { operatorStatusEnum, operatorVettingArgusEnum } from "@/db/schema/operators";

/**
 * Input shapes for the reference-data operations (operators, their
 * contacts, aircraft, airports, FBOs). The `*Input` schemas are what an op
 * takes (and what a stored proposal is re-parsed with at approval time);
 * the `*Body` schemas are the API bodies, which leave the ids to the path
 * and add an optional `reason` for the approver.
 *
 * The admin forms used to validate and normalise these fields by hand.
 * That lives here now: every message below is the one the desk has
 * always seen, in the same order, and the normalisation (trim, upper-case
 * codes, empty → null, defaults) happens in the schema so the API, the
 * forms and the approval queue agree on what a value means.
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

const ICAO_RE = /^[A-Z0-9]{4}$/;
const IATA_RE = /^[A-Z0-9]{3}$/;
const ISO2_RE = /^[A-Z]{2}$/;
const TAIL_RE = /^[A-Z0-9-]{3,16}$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

/** Free text; blank counts as null. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => v || null);

/** An upper-cased code checked against `re` when given; blank counts as null. */
const code = (re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || re.test(v), message)
    .nullable()
    .default(null)
    .transform((v) => v || null);

const optionalInt = z.number().int().nullable().default(null);
const optionalDate = z.iso.date().nullable().default(null).describe("YYYY-MM-DD");
const phone = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || E164_RE.test(v), message)
    .nullable()
    .default(null)
    .transform((v) => v || null);
const email = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL_RE.test(v), "Email looks invalid")
  .nullable()
  .default(null)
  .transform((v) => v || null);

// ─── Operators ───────────────────────────────────────────────────────────

export const OPERATOR_STATUSES = operatorStatusEnum.enumValues;
export const ARGUS_RATINGS = operatorVettingArgusEnum.enumValues;

const OperatorFields = z.object({
  name: z.string().trim().min(2, "Name required").max(140, "Name too long"),
  status: z.enum(OPERATOR_STATUSES, { error: "Invalid status" }).default("active"),
  argusRating: z.enum(ARGUS_RATINGS, { error: "Invalid ARG/US rating" }).default("none"),
  homeAirportIcao: code(ICAO_RE, "Home airport ICAO must be 4 chars"),
  certNumber: text(80).describe("FAA certificate number; unique across operators."),
  faaPart: z
    .string()
    .trim()
    .max(10)
    .default("135")
    .transform((v) => v || "135"),
  yearsPartner: optionalInt,
  isPreferred: z.boolean().default(false),
  wyvernWingman: z.boolean().default(false),
  isbaoStage: optionalInt,
  argusRenewsOn: optionalDate,
  wyvernRenewsOn: optionalDate,
  isbaoRenewsOn: optionalDate,
  insuranceRenewsOn: optionalDate,
  nextAuditOn: optionalDate,
  liabilityLimitUsd: optionalInt.describe("Whole dollars."),
  paymentTerms: text(200),
  volumeDiscountPct: z
    .string()
    .regex(NUMERIC_RE)
    .nullable()
    .default(null)
    .describe("A number as text, e.g. \"5\" or \"2.5\"."),
  rateLock: z.boolean().default(false),
  notes: text(10_000),
  suspendedReason: text(1000).describe("Required when status is suspended."),
});

/** A suspended operator must say why — checked after the fields, as the form always did. */
function withSuspendedReason<T extends z.ZodObject<typeof OperatorFields.shape>>(schema: T) {
  return schema.refine((v) => v.status !== "suspended" || Boolean(v.suspendedReason), {
    message: "Suspended reason required",
    path: ["suspendedReason"],
  });
}

export const OperatorCreateInput = withSuspendedReason(OperatorFields);
export type OperatorCreateInput = z.infer<typeof OperatorCreateInput>;

export const OperatorUpdateInput = withSuspendedReason(OperatorFields.extend({ id: z.uuid() }));
export type OperatorUpdateInput = z.infer<typeof OperatorUpdateInput>;

export const OperatorBody = withSuspendedReason(OperatorFields.extend({ reason }));

// ─── Operator contacts ───────────────────────────────────────────────────

export const OperatorContactAddInput = z
  .object({
    id: z.uuid().describe("The operator."),
    name: z.string().trim().min(2, "Name required").max(120, "Name too long"),
    role: text(120),
    email,
    phoneE164: phone("Phone must be E.164 (+15551234567)"),
    isEscalation: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.email || v.phoneE164), { message: "Email or phone required", path: ["email"] });
export type OperatorContactAddInput = z.infer<typeof OperatorContactAddInput>;

export const OperatorContactRefInput = z.object({
  id: z.uuid().describe("The operator."),
  contactId: z.uuid(),
});
export type OperatorContactRefInput = z.infer<typeof OperatorContactRefInput>;

export const OperatorContactEscalationInput = OperatorContactRefInput.extend({
  isEscalation: z.boolean().describe("Whether this contact is who to call when something goes wrong."),
});
export type OperatorContactEscalationInput = z.infer<typeof OperatorContactEscalationInput>;

export const OperatorContactAddBody = z
  .object({
    name: z.string().trim().min(2, "Name required").max(120, "Name too long"),
    role: text(120),
    email,
    phoneE164: phone("Phone must be E.164 (+15551234567)"),
    isEscalation: z.boolean().default(false),
    reason,
  })
  .refine((v) => Boolean(v.email || v.phoneE164), { message: "Email or phone required", path: ["email"] });
export const OperatorContactEscalationBody = z.object({ isEscalation: z.boolean(), reason });
export const OperatorContactRemoveBody = z.object({ reason });

// ─── Aircraft ────────────────────────────────────────────────────────────

export const AIRCRAFT_STATUSES = aircraftStatusEnum.enumValues;
export const AIRCRAFT_WIFI = aircraftWifiEnum.enumValues;
export const AIRCRAFT_CATEGORIES = aircraftCategoryEnum.enumValues;

const bounded = (message: string, min: number, max: number) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

const AircraftFields = z.object({
  tailNumber: z.string().trim().toUpperCase().regex(TAIL_RE, "Tail must be 3–16 chars (A-Z, 0-9, -)"),
  operatorId: z.uuid({ error: "Pick an operator" }),
  category: z.enum(AIRCRAFT_CATEGORIES, { error: "Invalid category" }),
  makeModel: z.string().trim().min(2, "Make/model required").max(100, "Make/model too long"),
  seats: bounded("Seats 1–19", 1, 19),
  rangeNm: bounded("Range 100–10000 NM", 100, 10000),
  speedKt: bounded("Speed 100–700 kt", 100, 700),
  yearManufactured: z
    .number()
    .int("Year of manufacture looks wrong")
    .min(1960, "Year of manufacture looks wrong")
    .max(2100, "Year of manufacture looks wrong")
    .nullable()
    .default(null),
  baseIcao: code(ICAO_RE, "Base ICAO must be 4 chars"),
  wifiType: z.enum(AIRCRAFT_WIFI, { error: "Invalid Wi-Fi type" }).default("none"),
  status: z.enum(AIRCRAFT_STATUSES, { error: "Invalid status" }).default("available"),
  cabinHeightIn: optionalInt,
  standupCabin: z.boolean().default(false),
  lavatoryEnclosed: z.boolean().default(false),
  lieflatCapable: z.boolean().default(false),
  petFriendly: z.boolean().default(false),
  flightAttendantStandard: z.boolean().default(false),
  totalHours: optionalInt,
  lastCCheckOn: optionalDate,
});

export const AircraftCreateInput = AircraftFields;
export type AircraftCreateInput = z.infer<typeof AircraftCreateInput>;

export const AircraftUpdateInput = AircraftFields.extend({ id: z.uuid() });
export type AircraftUpdateInput = z.infer<typeof AircraftUpdateInput>;

export const AircraftBody = AircraftFields.extend({ reason });

// ─── Airports ────────────────────────────────────────────────────────────

export const AIRPORT_CUSTOMS = airportCustomsEnum.enumValues;

const latitude = z.number({ error: "Latitude out of range" }).min(-90, "Latitude out of range").max(90, "Latitude out of range");
const longitude = z
  .number({ error: "Longitude out of range" })
  .min(-180, "Longitude out of range")
  .max(180, "Longitude out of range");

/** The create form's rules; the edit form's differ in two messages (below). */
const AirportFields = z.object({
  icao: z.string().trim().toUpperCase().regex(ICAO_RE, "ICAO must be 4 chars"),
  iata: code(IATA_RE, "IATA must be 3 chars"),
  name: z.string().trim().min(2, "Name required").max(120, "Name too long"),
  city: z.string().trim().min(1, "City required").max(120),
  countryIso2: z.string().trim().toUpperCase().regex(ISO2_RE, "Country must be ISO-2 (US, GB, ...)"),
  lat: latitude,
  lon: longitude,
  customs: z.enum(AIRPORT_CUSTOMS, { error: "Bad customs value" }).default("none"),
  region: text(120).describe("State, province or canton."),
  tz: text(64).describe("IANA time zone, e.g. America/Los_Angeles."),
  elevationFt: optionalInt,
  longestRunwayFt: optionalInt,
  category: text(40).describe("intl, domestic, private or regional."),
  notes: text(10_000),
  slotControlled: z.boolean().default(false),
  privateOnly: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const AirportCreateInput = AirportFields;
export type AirportCreateInput = z.infer<typeof AirportCreateInput>;

export const AirportUpdateInput = AirportFields.extend({
  id: z.uuid(),
  name: z.string().trim().min(2, "Name required").max(200),
  countryIso2: z.string().trim().toUpperCase().regex(ISO2_RE, "Country must be ISO-2"),
});
export type AirportUpdateInput = z.infer<typeof AirportUpdateInput>;

export const AirportRefInput = z.object({ id: z.uuid() });
export type AirportRefInput = z.infer<typeof AirportRefInput>;

export const AirportCreateBody = AirportFields.extend({ reason });
export const AirportUpdateBody = AirportUpdateInput.omit({ id: true }).extend({ reason });
export const AirportDeleteBody = z.object({ reason });

// ─── FBOs ────────────────────────────────────────────────────────────────

const FboFields = z.object({
  name: z.string().trim().min(2, "Name required").max(120, "Name too long"),
  phoneE164: phone("Phone must be E.164"),
  afterHoursPhoneE164: phone("After-hours phone must be E.164"),
  email,
  website: text(300),
  radioFreqMhz: text(16).describe("Unicom / ground frequency in MHz, as text, e.g. \"122.950\"."),
  hoursWeekday: text(120),
  hoursWeekend: text(120),
  isPrimary: z.boolean().default(false),
  isPreferred: z.boolean().default(false),
  customs24h: z.boolean().default(false),
  notes: text(10_000),
});

export const FboCreateInput = FboFields.extend({ id: z.uuid().describe("The airport.") });
export type FboCreateInput = z.infer<typeof FboCreateInput>;

export const FboRefInput = z.object({
  id: z.uuid().describe("The airport."),
  fboId: z.uuid(),
});
export type FboRefInput = z.infer<typeof FboRefInput>;

export const FBO_FLAGS = ["isPrimary", "isPreferred"] as const;
export type FboFlag = (typeof FBO_FLAGS)[number];

export const FboToggleInput = FboRefInput.extend({
  field: z.enum(FBO_FLAGS),
  value: z.boolean().optional().describe("The new value; left out, the flag flips."),
});
export type FboToggleInput = z.infer<typeof FboToggleInput>;

export const FboCreateBody = FboFields.extend({ reason });
export const FboToggleBody = FboToggleInput.omit({ id: true, fboId: true }).extend({ reason });
export const FboDeleteBody = z.object({ reason });
