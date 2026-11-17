import type { Aircraft, NewAircraft } from "@/db/schema/aircraft";
import type { Airport, NewAirport, NewFbo } from "@/db/schema/airports";
import type { NewOperator, NewOperatorContact, Operator } from "@/db/schema/operators";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import { referenceStore } from "./store";
import type {
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
 * Reference-data commands (operators, contacts, aircraft, airports, FBOs),
 * shared by the admin's Server Actions, the API and the approval queue
 * through the ops in ./ops.ts. Each op has a `load*` (the current rows,
 * re-read at approval time; conflicts are caught there so a stale
 * proposal fails before anything is written) and a command that runs
 * against that state. Nothing here checks the session or revalidates:
 * the op declares its paths and `runOp` handles both.
 *
 * Keep this file free of `server-only` imports: scripts/check-api.mts
 * loads the route registry under tsx.
 */

export const NO_OPERATOR = "No operator with that id.";
export const NO_CONTACT = "No contact with that id on this operator.";
export const NO_AIRCRAFT = "No aircraft with that id.";
export const NO_AIRPORT = "No airport with that id.";
export const NO_FBO = "No FBO with that id at this airport.";

export type FieldDiff = Record<string, { before: unknown; after: unknown }>;

/**
 * Per-field diff of a row against the values about to be written, the way
 * the audit rows have always recorded it. `loose` also treats values with
 * the same JSON as equal (numeric strings, dates); the airport form never
 * did, so its diff keeps the strict compare.
 */
export function diffRow(before: Record<string, unknown>, values: Record<string, unknown>, loose: boolean): FieldDiff {
  const diff: FieldDiff = {};
  for (const k of Object.keys(values)) {
    const a = before[k];
    const b = values[k];
    if (a === b) continue;
    if (loose && JSON.stringify(a) === JSON.stringify(b)) continue;
    diff[k] = { before: a, after: b };
  }
  return diff;
}

// ─── Operators ───────────────────────────────────────────────────────────

/** The row the form writes, in the column order the audit diff has always used. */
export function operatorValues(input: OperatorCreateInput): NewOperator {
  return {
    name: input.name,
    certNumber: input.certNumber,
    faaPart: input.faaPart,
    homeAirportIcao: input.homeAirportIcao,
    yearsPartner: input.yearsPartner,
    isPreferred: input.isPreferred,
    status: input.status,
    argusRating: input.argusRating,
    wyvernWingman: input.wyvernWingman,
    isbaoStage: input.isbaoStage,
    argusRenewsOn: input.argusRenewsOn,
    wyvernRenewsOn: input.wyvernRenewsOn,
    isbaoRenewsOn: input.isbaoRenewsOn,
    insuranceRenewsOn: input.insuranceRenewsOn,
    nextAuditOn: input.nextAuditOn,
    liabilityLimitUsd: input.liabilityLimitUsd,
    paymentTerms: input.paymentTerms,
    volumeDiscountPct: input.volumeDiscountPct,
    rateLock: input.rateLock,
    notes: input.notes,
    suspendedReason: input.suspendedReason,
  };
}

/** certNumber is unique when present — pre-check for a clean error. */
export async function loadOperatorForCreate(input: OperatorCreateInput): Promise<Result<Record<string, never>>> {
  if (input.certNumber) {
    const conflict = await referenceStore().operatorIdByCert(input.certNumber);
    if (conflict) return err("conflict", "Another operator already has that cert number");
  }
  return ok({});
}

export async function createOperator(
  actor: Actor,
  input: OperatorCreateInput,
): Promise<Result<{ id: string; name: string }>> {
  const values = operatorValues(input);
  try {
    const row = await referenceStore().insertOperator(values);

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "operator.create",
      subjectType: "operator",
      subjectId: row.id,
      subjectCode: values.certNumber ?? row.name,
      metadata: {
        ...a.metadata,
        name: row.name,
        argusRating: values.argusRating,
        wyvernWingman: values.wyvernWingman,
        isPreferred: values.isPreferred,
      },
    });

    return ok({ id: row.id, name: row.name });
  } catch (e) {
    console.error("createOperator failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }
}

export type OperatorUpdateState = { before: Operator; values: NewOperator; diff: FieldDiff };

export async function loadOperatorForUpdate(input: OperatorUpdateInput): Promise<Result<OperatorUpdateState>> {
  if (!isUuid(input.id)) return err("not_found", NO_OPERATOR);
  const store = referenceStore();
  const before = await store.operatorById(input.id);
  if (!before) return err("not_found", NO_OPERATOR);

  const values = operatorValues(input);

  // Cert number collision (excluding self).
  if (values.certNumber && values.certNumber !== before.certNumber) {
    const conflict = await store.operatorIdByCert(values.certNumber);
    if (conflict && conflict.id !== input.id) return err("conflict", "Another operator already has that cert number");
  }

  return ok({ before, values, diff: diffRow(before, values, true) });
}

export async function updateOperator(
  actor: Actor,
  input: OperatorUpdateInput,
  state: OperatorUpdateState,
): Promise<Result<{ id: string; changed: string[] }>> {
  const { before, values, diff } = state;
  await referenceStore().updateOperator(input.id, values);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "operator.update",
    subjectType: "operator",
    subjectId: input.id,
    subjectCode: before.certNumber ?? before.name,
    diff: Object.keys(diff).length ? diff : null,
    metadata: a.metadata,
  });

  return ok({ id: input.id, changed: Object.keys(diff) });
}

// ─── Operator contacts ───────────────────────────────────────────────────

export type OperatorRef = { id: string; name: string; certNumber: string | null };

async function loadOperatorRef(id: string): Promise<OperatorRef | null> {
  if (!isUuid(id)) return null;
  return (await referenceStore().operatorRef(id)) ?? null;
}

export type ContactAddState = { operator: OperatorRef };

export async function loadOperatorForContactAdd(input: OperatorContactAddInput): Promise<Result<ContactAddState>> {
  const operator = await loadOperatorRef(input.id);
  if (!operator) return err("not_found", NO_OPERATOR);
  return ok({ operator });
}

export async function addOperatorContact(
  actor: Actor,
  input: OperatorContactAddInput,
  state: ContactAddState,
): Promise<Result<{ id: string }>> {
  const { operator } = state;
  const values: NewOperatorContact = {
    operatorId: operator.id,
    name: input.name,
    role: input.role,
    email: input.email,
    phoneE164: input.phoneE164,
    isEscalation: input.isEscalation,
  };

  try {
    const row = await referenceStore().insertContact(values);

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "operator.contact.create",
      subjectType: "operator",
      subjectId: operator.id,
      subjectCode: operator.certNumber ?? operator.name,
      metadata: {
        ...a.metadata,
        contactId: row.id,
        name: input.name,
        role: input.role,
        isEscalation: input.isEscalation,
        hasEmail: Boolean(input.email),
        hasPhone: Boolean(input.phoneE164),
      },
    });

    return ok({ id: row.id });
  } catch (e) {
    console.error("addOperatorContact failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }
}

export type ContactState = {
  operator: OperatorRef;
  contact: { id: string; name: string; role: string | null; isEscalation: boolean };
};

export async function loadOperatorContact(input: OperatorContactRefInput): Promise<Result<ContactState>> {
  const operator = await loadOperatorRef(input.id);
  if (!operator) return err("not_found", NO_OPERATOR);
  if (!isUuid(input.contactId)) return err("not_found", NO_CONTACT);
  const contact = await referenceStore().contactOf(operator.id, input.contactId);
  if (!contact) return err("not_found", NO_CONTACT);
  return ok({ operator, contact });
}

export async function removeOperatorContact(
  actor: Actor,
  input: OperatorContactRefInput,
  state: ContactState,
): Promise<Result<{ id: string }>> {
  const { contact } = state;
  await referenceStore().deleteContact(contact.id);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "operator.contact.delete",
    subjectType: "operator",
    subjectId: input.id,
    metadata: {
      ...a.metadata,
      contactId: contact.id,
      name: contact.name,
      role: contact.role,
      isEscalation: contact.isEscalation,
    },
  });

  return ok({ id: contact.id });
}

export async function setOperatorContactEscalation(
  actor: Actor,
  input: OperatorContactEscalationInput,
  state: ContactState,
): Promise<Result<{ id: string; isEscalation: boolean }>> {
  const { contact } = state;
  if (contact.isEscalation === input.isEscalation) return ok({ id: contact.id, isEscalation: contact.isEscalation });

  await referenceStore().setContactEscalation(contact.id, input.isEscalation);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "operator.contact.escalation.toggle",
    subjectType: "operator",
    subjectId: input.id,
    diff: { isEscalation: { before: contact.isEscalation, after: input.isEscalation } },
    metadata: { ...a.metadata, contactId: contact.id, name: contact.name },
  });

  return ok({ id: contact.id, isEscalation: input.isEscalation });
}

// ─── Aircraft ────────────────────────────────────────────────────────────

/** The row the form writes, in the column order the audit diff has always used. */
export function aircraftValues(input: AircraftCreateInput): NewAircraft {
  return {
    tailNumber: input.tailNumber,
    operatorId: input.operatorId,
    category: input.category,
    makeModel: input.makeModel,
    yearManufactured: input.yearManufactured,
    seats: input.seats,
    rangeNm: input.rangeNm,
    speedKt: input.speedKt,
    wifiType: input.wifiType,
    cabinHeightIn: input.cabinHeightIn,
    standupCabin: input.standupCabin,
    lavatoryEnclosed: input.lavatoryEnclosed,
    lieflatCapable: input.lieflatCapable,
    petFriendly: input.petFriendly,
    flightAttendantStandard: input.flightAttendantStandard,
    baseIcao: input.baseIcao,
    totalHours: input.totalHours,
    lastCCheckOn: input.lastCCheckOn,
    status: input.status,
  };
}

export type AircraftCreateState = { operator: { id: string; name: string } };

export async function loadAircraftForCreate(input: AircraftCreateInput): Promise<Result<AircraftCreateState>> {
  // Verify operator exists.
  const store = referenceStore();
  const operator = await store.operatorName(input.operatorId);
  if (!operator) return err("not_found", NO_OPERATOR);

  // Tail uniqueness pre-check.
  const conflict = await store.aircraftIdByTail(input.tailNumber);
  if (conflict) return err("conflict", `Tail ${input.tailNumber} already on file`);

  return ok({ operator });
}

export async function createAircraft(
  actor: Actor,
  input: AircraftCreateInput,
  state: AircraftCreateState,
): Promise<Result<{ id: string; tailNumber: string }>> {
  const values = aircraftValues(input);
  try {
    const row = await referenceStore().insertAircraft(values);

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "aircraft.create",
      subjectType: "aircraft",
      subjectId: row.id,
      subjectCode: row.tailNumber,
      metadata: {
        ...a.metadata,
        operatorId: values.operatorId,
        operatorName: state.operator.name,
        category: values.category,
        makeModel: values.makeModel,
        seats: values.seats,
      },
    });

    return ok({ id: row.id, tailNumber: row.tailNumber });
  } catch (e) {
    console.error("createAircraft failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }
}

export type AircraftUpdateState = { before: Aircraft; values: NewAircraft; diff: FieldDiff };

export async function loadAircraftForUpdate(input: AircraftUpdateInput): Promise<Result<AircraftUpdateState>> {
  if (!isUuid(input.id)) return err("not_found", NO_AIRCRAFT);
  const store = referenceStore();
  const before = await store.aircraftById(input.id);
  if (!before) return err("not_found", NO_AIRCRAFT);

  const values = aircraftValues(input);

  // Tail collision (exclude self).
  if (values.tailNumber !== before.tailNumber) {
    const conflict = await store.aircraftIdByTail(values.tailNumber, input.id);
    if (conflict) return err("conflict", `Another aircraft already uses ${values.tailNumber}`);
  }

  // Operator existence check on change.
  if (values.operatorId !== before.operatorId) {
    if (!(await store.operatorExists(values.operatorId))) return err("not_found", NO_OPERATOR);
  }

  return ok({ before, values, diff: diffRow(before, values, true) });
}

export async function updateAircraft(
  actor: Actor,
  input: AircraftUpdateInput,
  state: AircraftUpdateState,
): Promise<Result<{ id: string; changed: string[] }>> {
  const { values, diff } = state;
  await referenceStore().updateAircraft(input.id, values);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "aircraft.update",
    subjectType: "aircraft",
    subjectId: input.id,
    subjectCode: values.tailNumber,
    diff: Object.keys(diff).length ? diff : null,
    metadata: a.metadata,
  });

  return ok({ id: input.id, changed: Object.keys(diff) });
}

// ─── Airports ────────────────────────────────────────────────────────────

/** The row the form writes, in the column order the audit diff has always used. */
export function airportValues(input: AirportCreateInput): NewAirport {
  return {
    icao: input.icao,
    iata: input.iata,
    name: input.name,
    city: input.city,
    region: input.region,
    countryIso2: input.countryIso2,
    lat: String(input.lat) as unknown as NewAirport["lat"],
    lon: String(input.lon) as unknown as NewAirport["lon"],
    elevationFt: input.elevationFt,
    tz: input.tz,
    category: input.category,
    longestRunwayFt: input.longestRunwayFt,
    customs: input.customs,
    slotControlled: input.slotControlled,
    privateOnly: input.privateOnly,
    active: input.active,
    notes: input.notes,
  };
}

/** Conflict check — clean error beats a unique-violation stack trace. */
export async function loadAirportForCreate(input: AirportCreateInput): Promise<Result<Record<string, never>>> {
  const conflict = await referenceStore().airportIdByIcao(input.icao);
  if (conflict) return err("conflict", `Airport ${input.icao} already on file`);
  return ok({});
}

export async function createAirport(
  actor: Actor,
  input: AirportCreateInput,
): Promise<Result<{ id: string; icao: string }>> {
  const values = airportValues(input);
  try {
    const row = await referenceStore().insertAirport(values);

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "airport.create",
      subjectType: "system",
      subjectId: row.id,
      subjectCode: row.icao,
      metadata: { ...a.metadata, name: values.name, city: values.city, countryIso2: values.countryIso2, iata: values.iata },
    });

    return ok({ id: row.id, icao: row.icao });
  } catch (e) {
    console.error("createAirport failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }
}

export type AirportUpdateState = { before: Airport; values: NewAirport; diff: FieldDiff };

export async function loadAirportForUpdate(input: AirportUpdateInput): Promise<Result<AirportUpdateState>> {
  if (!isUuid(input.id)) return err("not_found", NO_AIRPORT);
  const store = referenceStore();
  const before = await store.airportById(input.id);
  if (!before) return err("not_found", NO_AIRPORT);

  // Same rules as create, but an ICAO change needs the "exclude self" check.
  if (input.icao !== before.icao) {
    const conflict = await store.airportIdByIcao(input.icao, input.id);
    if (conflict) return err("conflict", `Another airport already uses ${input.icao}`);
  }

  const values = airportValues(input);
  return ok({ before, values, diff: diffRow(before, values, false) });
}

export async function updateAirport(
  actor: Actor,
  input: AirportUpdateInput,
  state: AirportUpdateState,
): Promise<Result<{ id: string; changed: string[] }>> {
  const { values, diff } = state;
  await referenceStore().updateAirport(input.id, values);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "airport.update",
    subjectType: "system",
    subjectId: input.id,
    subjectCode: values.icao,
    diff: Object.keys(diff).length ? diff : null,
    metadata: a.metadata,
  });

  return ok({ id: input.id, changed: Object.keys(diff) });
}

export type AirportRef = { id: string; icao: string; name: string };
export type AirportState = { airport: AirportRef };

export async function loadAirport(input: AirportRefInput): Promise<Result<AirportState>> {
  if (!isUuid(input.id)) return err("not_found", NO_AIRPORT);
  const airport = await referenceStore().airportRef(input.id);
  if (!airport) return err("not_found", NO_AIRPORT);
  return ok({ airport });
}

/**
 * FBOs cascade via FK. Other tables (quote_legs / trip_legs / etc.) hold
 * ICAO as free text today, so deletion is non-blocking on referential
 * integrity. The catalog is reference data — soft-delete (active=false)
 * is usually safer than hard-delete; the toolbar offers both.
 */
export async function deleteAirport(
  actor: Actor,
  input: AirportRefInput,
  state: AirportState,
): Promise<Result<{ id: string; icao: string }>> {
  const { airport } = state;
  await referenceStore().deleteAirport(airport.id);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "airport.delete",
    subjectType: "system",
    subjectId: airport.id,
    subjectCode: airport.icao,
    metadata: { ...a.metadata, name: airport.name },
  });

  return ok({ id: airport.id, icao: airport.icao });
}

// ─── FBOs ────────────────────────────────────────────────────────────────

export async function createFbo(actor: Actor, input: FboCreateInput, state: AirportState): Promise<Result<{ id: string }>> {
  const { airport } = state;
  const values: NewFbo = {
    airportId: airport.id,
    name: input.name,
    isPrimary: input.isPrimary,
    isPreferred: input.isPreferred,
    radioFreqMhz: input.radioFreqMhz ? (input.radioFreqMhz as unknown as NewFbo["radioFreqMhz"]) : null,
    phoneE164: input.phoneE164,
    afterHoursPhoneE164: input.afterHoursPhoneE164,
    email: input.email,
    website: input.website,
    hoursWeekday: input.hoursWeekday,
    hoursWeekend: input.hoursWeekend,
    customs24h: input.customs24h,
    notes: input.notes,
  };

  try {
    const row = await referenceStore().insertFbo(values);

    const a = auditFields(actor);
    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: "fbo.create",
      subjectType: "system",
      subjectId: row.id,
      subjectCode: `${airport.icao} · ${input.name}`,
      metadata: {
        ...a.metadata,
        airportId: airport.id,
        name: input.name,
        isPrimary: values.isPrimary,
        isPreferred: values.isPreferred,
      },
    });

    return ok({ id: row.id });
  } catch (e) {
    console.error("createFbo failed", e);
    return err("internal", "DB_INSERT_FAILED (name dupe?)");
  }
}

export type FboState = {
  airport: AirportRef;
  fbo: { id: string; name: string; isPrimary: boolean; isPreferred: boolean };
};

export async function loadFbo(input: FboRefInput): Promise<Result<FboState>> {
  const loaded = await loadAirport(input);
  if (!loaded.ok) return loaded;
  if (!isUuid(input.fboId)) return err("not_found", NO_FBO);
  const fbo = await referenceStore().fboOf(loaded.value.airport.id, input.fboId);
  if (!fbo) return err("not_found", NO_FBO);
  return ok({ airport: loaded.value.airport, fbo });
}

export async function deleteFbo(actor: Actor, input: FboRefInput, state: FboState): Promise<Result<{ id: string }>> {
  const { airport, fbo } = state;
  await referenceStore().deleteFbo(fbo.id);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "fbo.delete",
    subjectType: "system",
    subjectId: fbo.id,
    metadata: { ...a.metadata, airportId: airport.id, name: fbo.name },
  });

  return ok({ id: fbo.id });
}

/** The value the toggle will write (always given, so the approval card is exact). */
export function fboToggleTarget(input: FboToggleInput, _state: FboState): boolean {
  return input.value;
}

export async function toggleFboFlag(
  actor: Actor,
  input: FboToggleInput,
  state: FboState,
): Promise<Result<{ id: string; field: FboToggleInput["field"]; value: boolean }>> {
  const { airport, fbo } = state;
  const { field } = input;
  const before = fbo[field];
  const next = fboToggleTarget(input, state);
  if (before === next) return ok({ id: fbo.id, field, value: before });

  const store = referenceStore();
  await store.setFboFlag(fbo.id, field, next);

  // If we just promoted this FBO to is_primary, demote any sibling primaries
  // — only one primary per airport.
  if (field === "isPrimary" && next) {
    await store.demoteOtherPrimaries(airport.id, fbo.id);
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: `fbo.${field}.toggle`,
    subjectType: "system",
    subjectId: fbo.id,
    diff: { [field]: { before, after: next } },
    metadata: { ...a.metadata, airportId: airport.id, name: fbo.name },
  });

  return ok({ id: fbo.id, field, value: next });
}
