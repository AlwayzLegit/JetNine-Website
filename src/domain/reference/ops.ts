import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  addOperatorContact,
  createAircraft,
  createAirport,
  createFbo,
  createOperator,
  deleteAirport,
  deleteFbo,
  fboToggleTarget,
  loadAircraftForCreate,
  loadAircraftForUpdate,
  loadAirport,
  loadAirportForCreate,
  loadAirportForUpdate,
  loadFbo,
  loadOperatorContact,
  loadOperatorForContactAdd,
  loadOperatorForCreate,
  loadOperatorForUpdate,
  removeOperatorContact,
  setOperatorContactEscalation,
  toggleFboFlag,
  updateAircraft,
  updateAirport,
  updateOperator,
  type AircraftCreateState,
  type AircraftUpdateState,
  type AirportState,
  type AirportUpdateState,
  type ContactAddState,
  type ContactState,
  type FboState,
  type FieldDiff,
  type OperatorUpdateState,
} from "./commands";
import {
  AircraftCreateInput,
  AircraftUpdateInput,
  AirportCreateInput,
  AirportRefInput,
  AirportUpdateInput,
  FboCreateInput,
  FboRefInput,
  FboToggleInput,
  OperatorContactAddInput,
  OperatorContactEscalationInput,
  OperatorContactRefInput,
  OperatorCreateInput,
  OperatorUpdateInput,
} from "./schemas";

/**
 * Operations on reference data. Operators, aircraft, airports and FBOs
 * are the facts every quote is built on, so changing them is a `settings`
 * matter: only owners hold the permission, and a supervised key's change
 * waits for one. An operator's contact list is desk-side bookkeeping and
 * runs at once.
 */

type Nothing = Record<string, never>;

/** Column names in the words the desk uses; anything else falls back to spaced camelCase. */
const FIELD_WORDS: Record<string, string> = {
  certNumber: "cert number",
  faaPart: "FAA part",
  homeAirportIcao: "home airport",
  yearsPartner: "years as partner",
  isPreferred: "preferred",
  argusRating: "ARG/US rating",
  wyvernWingman: "Wyvern Wingman",
  isbaoStage: "IS-BAO stage",
  argusRenewsOn: "ARG/US renewal",
  wyvernRenewsOn: "Wyvern renewal",
  isbaoRenewsOn: "IS-BAO renewal",
  insuranceRenewsOn: "insurance renewal",
  nextAuditOn: "next audit",
  liabilityLimitUsd: "liability limit",
  paymentTerms: "payment terms",
  volumeDiscountPct: "volume discount",
  rateLock: "rate lock",
  suspendedReason: "suspended reason",
  tailNumber: "tail number",
  operatorId: "operator",
  makeModel: "make/model",
  yearManufactured: "year of manufacture",
  rangeNm: "range",
  speedKt: "speed",
  wifiType: "Wi-Fi",
  cabinHeightIn: "cabin height",
  standupCabin: "stand-up cabin",
  lavatoryEnclosed: "enclosed lavatory",
  lieflatCapable: "lie-flat seats",
  petFriendly: "pet friendly",
  flightAttendantStandard: "flight attendant",
  baseIcao: "base",
  totalHours: "total hours",
  lastCCheckOn: "last C check",
  icao: "ICAO",
  iata: "IATA",
  countryIso2: "country",
  lat: "latitude",
  lon: "longitude",
  elevationFt: "elevation",
  tz: "time zone",
  longestRunwayFt: "longest runway",
  slotControlled: "slot controlled",
  privateOnly: "private only",
};

export function fieldWords(key: string): string {
  return FIELD_WORDS[key] ?? key.replace(/([A-Z])/g, " $1").toLowerCase();
}

function valueWords(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** "Change operator “Jet Edge”: status, ARG/US rating" — or that nothing changed. */
export function changeSummary(what: string, diff: FieldDiff): string {
  const keys = Object.keys(diff);
  return keys.length ? `Change ${what}: ${keys.map(fieldWords).join(", ")}` : `Save ${what} with no changes`;
}

/** One line per changed field: "status: active → suspended". */
export function changePreview(diff: FieldDiff): string | null {
  const lines = Object.entries(diff).map(([k, d]) => `${fieldWords(k)}: ${valueWords(d.before)} → ${valueWords(d.after)}`);
  return lines.length ? lines.join("\n") : null;
}

// ─── Operators ───────────────────────────────────────────────────────────

export const operatorCreateOp = defineOp<OperatorCreateInput, Nothing>({
  id: "operator.create",
  scope: "settings",
  schema: OperatorCreateInput,
  load: loadOperatorForCreate,
  risk: () => "settings",
  summary: (input) => `Add operator “${input.name}”${input.certNumber ? ` (cert ${input.certNumber})` : ""}`,
  subject: (input) => ({ type: "operator", id: null, code: input.certNumber }),
  run: (actor, input) => createOperator(actor, input),
  revalidate: () => ["/admin/operators"],
});

export const operatorUpdateOp = defineOp<OperatorUpdateInput, OperatorUpdateState>({
  id: "operator.update",
  scope: "settings",
  schema: OperatorUpdateInput,
  load: loadOperatorForUpdate,
  risk: () => "settings",
  summary: (_input, state) => changeSummary(`operator “${state.before.name}”`, state.diff),
  preview: (_input, state) => changePreview(state.diff),
  subject: (input, state) => ({ type: "operator", id: input.id, code: state.before.certNumber }),
  run: updateOperator,
  revalidate: (input) => ["/admin/operators", `/admin/operators/${input.id}`],
});

export const operatorContactAddOp = defineOp<OperatorContactAddInput, ContactAddState>({
  id: "operator.contact.add",
  scope: "desk",
  schema: OperatorContactAddInput,
  load: loadOperatorForContactAdd,
  risk: () => null,
  summary: (input, state) =>
    `Add contact “${input.name}”${input.role ? ` (${input.role})` : ""} to operator “${state.operator.name}”`,
  subject: (input, state) => ({ type: "operator", id: input.id, code: state.operator.certNumber }),
  run: addOperatorContact,
  revalidate: (input) => [`/admin/operators/${input.id}`, "/admin/operators"],
});

export const operatorContactRemoveOp = defineOp<OperatorContactRefInput, ContactState>({
  id: "operator.contact.remove",
  scope: "desk",
  schema: OperatorContactRefInput,
  load: loadOperatorContact,
  risk: () => null,
  summary: (_input, state) => `Remove contact “${state.contact.name}” from operator “${state.operator.name}”`,
  subject: (input, state) => ({ type: "operator", id: input.id, code: state.operator.certNumber }),
  run: removeOperatorContact,
  revalidate: (input) => [`/admin/operators/${input.id}`, "/admin/operators"],
});

export const operatorContactToggleEscalationOp = defineOp<OperatorContactEscalationInput, ContactState>({
  id: "operator.contact.toggleEscalation",
  scope: "desk",
  schema: OperatorContactEscalationInput,
  load: loadOperatorContact,
  risk: () => null,
  summary: (input, state) =>
    input.isEscalation
      ? `Mark “${state.contact.name}” as an escalation contact at operator “${state.operator.name}”`
      : `Stop treating “${state.contact.name}” as an escalation contact at operator “${state.operator.name}”`,
  subject: (input, state) => ({ type: "operator", id: input.id, code: state.operator.certNumber }),
  run: setOperatorContactEscalation,
  revalidate: (input) => [`/admin/operators/${input.id}`],
});

// ─── Aircraft ────────────────────────────────────────────────────────────

export const aircraftCreateOp = defineOp<AircraftCreateInput, AircraftCreateState>({
  id: "aircraft.create",
  scope: "settings",
  schema: AircraftCreateInput,
  load: loadAircraftForCreate,
  risk: () => "settings",
  summary: (input, state) => `Add aircraft ${input.tailNumber} (${input.makeModel}) for operator “${state.operator.name}”`,
  subject: (input) => ({ type: "aircraft", id: null, code: input.tailNumber }),
  run: createAircraft,
  revalidate: (input) => ["/admin/aircraft", "/admin/ops", `/admin/operators/${input.operatorId}`],
});

export const aircraftUpdateOp = defineOp<AircraftUpdateInput, AircraftUpdateState>({
  id: "aircraft.update",
  scope: "settings",
  schema: AircraftUpdateInput,
  load: loadAircraftForUpdate,
  risk: () => "settings",
  summary: (_input, state) => changeSummary(`aircraft ${state.before.tailNumber}`, state.diff),
  preview: (_input, state) => changePreview(state.diff),
  subject: (input, state) => ({ type: "aircraft", id: input.id, code: state.before.tailNumber }),
  run: updateAircraft,
  revalidate: (input, state) => [
    "/admin/aircraft",
    `/admin/aircraft/${input.id}`,
    "/admin/ops",
    ...(state.before.operatorId !== input.operatorId
      ? [`/admin/operators/${state.before.operatorId}`, `/admin/operators/${input.operatorId}`]
      : []),
  ],
});

// ─── Airports ────────────────────────────────────────────────────────────

export const airportCreateOp = defineOp<AirportCreateInput, Nothing>({
  id: "airport.create",
  scope: "settings",
  schema: AirportCreateInput,
  load: loadAirportForCreate,
  risk: () => "settings",
  summary: (input) => `Add airport ${input.icao} · ${input.name}`,
  subject: (input) => ({ type: "airport", id: null, code: input.icao }),
  run: (actor, input) => createAirport(actor, input),
  revalidate: () => ["/admin/airports"],
});

export const airportUpdateOp = defineOp<AirportUpdateInput, AirportUpdateState>({
  id: "airport.update",
  scope: "settings",
  schema: AirportUpdateInput,
  load: loadAirportForUpdate,
  risk: () => "settings",
  summary: (_input, state) => changeSummary(`airport ${state.before.icao} · ${state.before.name}`, state.diff),
  preview: (_input, state) => changePreview(state.diff),
  subject: (input, state) => ({ type: "airport", id: input.id, code: state.before.icao }),
  run: updateAirport,
  revalidate: (input) => ["/admin/airports", `/admin/airports/${input.id}`],
});

export const airportDeleteOp = defineOp<AirportRefInput, AirportState>({
  id: "airport.delete",
  scope: "settings",
  schema: AirportRefInput,
  load: loadAirport,
  risk: () => "settings",
  summary: (_input, state) => `Remove airport ${state.airport.icao} · ${state.airport.name}, with its FBOs`,
  subject: (input, state) => ({ type: "airport", id: input.id, code: state.airport.icao }),
  run: deleteAirport,
  revalidate: () => ["/admin/airports"],
});

// ─── FBOs ────────────────────────────────────────────────────────────────

export const fboCreateOp = defineOp<FboCreateInput, AirportState>({
  id: "fbo.create",
  scope: "settings",
  schema: FboCreateInput,
  load: loadAirport,
  risk: () => "settings",
  summary: (input, state) => `Add FBO “${input.name}” at ${state.airport.icao}`,
  subject: (input, state) => ({ type: "airport", id: input.id, code: state.airport.icao }),
  run: createFbo,
  revalidate: (input) => [`/admin/airports/${input.id}`],
});

export const fboDeleteOp = defineOp<FboRefInput, FboState>({
  id: "fbo.delete",
  scope: "settings",
  schema: FboRefInput,
  load: loadFbo,
  risk: () => "settings",
  summary: (_input, state) => `Remove FBO “${state.fbo.name}” at ${state.airport.icao}`,
  subject: (input, state) => ({ type: "airport", id: input.id, code: state.airport.icao }),
  run: deleteFbo,
  revalidate: (input) => [`/admin/airports/${input.id}`],
});

export const fboToggleOp = defineOp<FboToggleInput, FboState>({
  id: "fbo.toggle",
  scope: "settings",
  schema: FboToggleInput,
  load: loadFbo,
  risk: () => "settings",
  summary: (input, state) => {
    const next = fboToggleTarget(input, state);
    const who = `FBO “${state.fbo.name}” at ${state.airport.icao}`;
    if (input.field === "isPrimary") return next ? `Make ${who} the primary FBO` : `Stop treating ${who} as the primary FBO`;
    return next ? `Mark ${who} as preferred` : `Stop marking ${who} as preferred`;
  },
  preview: (input, state) => {
    const before = state.fbo[input.field];
    const next = fboToggleTarget(input, state);
    return before === next ? null : `${fieldWords(input.field)}: ${valueWords(before)} → ${valueWords(next)}`;
  },
  subject: (input, state) => ({ type: "airport", id: input.id, code: state.airport.icao }),
  run: toggleFboFlag,
  revalidate: (input) => [`/admin/airports/${input.id}`],
});

export const REFERENCE_OPS: AnyOp[] = [
  operatorCreateOp,
  operatorUpdateOp,
  operatorContactAddOp,
  operatorContactRemoveOp,
  operatorContactToggleEscalationOp,
  aircraftCreateOp,
  aircraftUpdateOp,
  airportCreateOp,
  airportUpdateOp,
  airportDeleteOp,
  fboCreateOp,
  fboDeleteOp,
  fboToggleOp,
];
