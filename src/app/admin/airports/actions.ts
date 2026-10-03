"use server";

import type { z } from "zod";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import {
  airportCreateOp,
  airportDeleteOp,
  airportUpdateOp,
  fboCreateOp,
  fboDeleteOp,
  fboToggleOp,
} from "@/domain/reference/ops";
import type { Err } from "@/domain/result";

/**
 * The work itself is the airport.* and fbo.* ops (src/domain/reference),
 * shared with the API and the approval queue; runOp checks the `settings`
 * permission (owners) and revalidates the pages. These wrappers turn the
 * form into the op's input and the outcome back into the shape the forms
 * expect.
 */

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PENDING = "This was sent for approval.";

function pickString(form: FormData, name: string): string {
  return ((form.get(name) as string | null) ?? "").trim();
}

function pickBool(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function pickInt(form: FormData, name: string): number | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function pickFloat(form: FormData, name: string): number | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

/** The form's own wording for a failed op: the first validation message, or the op's sentence. */
function failure(r: Err, notFound: string): string {
  if (r.code === "invalid") return (r.details as z.ZodIssue[] | undefined)?.[0]?.message ?? r.error;
  if (r.code === "not_found") return notFound;
  return r.error;
}

function airportInput(formData: FormData): Record<string, unknown> {
  return {
    icao: pickString(formData, "icao"),
    iata: pickString(formData, "iata"),
    name: pickString(formData, "name"),
    city: pickString(formData, "city"),
    countryIso2: pickString(formData, "countryIso2"),
    lat: pickFloat(formData, "lat"),
    lon: pickFloat(formData, "lon"),
    customs: pickString(formData, "customs") || undefined,
    region: pickString(formData, "region"),
    tz: pickString(formData, "tz"),
    elevationFt: pickInt(formData, "elevationFt"),
    longestRunwayFt: pickInt(formData, "longestRunwayFt"),
    category: pickString(formData, "category"),
    notes: pickString(formData, "notes"),
    slotControlled: pickBool(formData, "slotControlled"),
    privateOnly: pickBool(formData, "privateOnly"),
    active: !pickBool(formData, "inactive"), // default active unless ticked
  };
}

// ─── Airports ──────────────────────────────────────────────────────────────

export type CreateAirportResult =
  | { ok: true; id: string; icao: string }
  | { ok: false; error: string };

export async function createAirport(formData: FormData): Promise<CreateAirportResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const r = await runOp(airportCreateOp, session.value, airportInput(formData));
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const row = r.value.value as { id: string; icao: string };
  return { ok: true, id: row.id, icao: row.icao };
}

export async function updateAirport(
  airportId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const r = await runOp(airportUpdateOp, session.value, { id: airportId, ...airportInput(formData) });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

export async function deleteAirport(
  airportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const r = await runOp(airportDeleteOp, session.value, { id: airportId });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

// ─── FBOs ───────────────────────────────────────────────────────────────────

export type CreateFboResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createFbo(
  airportId: string,
  formData: FormData,
): Promise<CreateFboResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const r = await runOp(fboCreateOp, session.value, {
    id: airportId,
    name: pickString(formData, "name"),
    phoneE164: pickString(formData, "phoneE164"),
    afterHoursPhoneE164: pickString(formData, "afterHoursPhoneE164"),
    email: pickString(formData, "email"),
    website: pickString(formData, "website"),
    radioFreqMhz: pickString(formData, "radioFreqMhz"),
    hoursWeekday: pickString(formData, "hoursWeekday"),
    hoursWeekend: pickString(formData, "hoursWeekend"),
    isPrimary: pickBool(formData, "isPrimary"),
    isPreferred: pickBool(formData, "isPreferred"),
    customs24h: pickBool(formData, "customs24h"),
    notes: pickString(formData, "notes"),
  });
  if (!r.ok) return { ok: false, error: failure(r, "Airport not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

export async function deleteFbo(
  airportId: string,
  fboId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };
  if (!UUID_RE.test(fboId)) return { ok: false, error: "Bad fbo id" };

  const r = await runOp(fboDeleteOp, session.value, { id: airportId, fboId });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

export async function toggleFboFlag(
  airportId: string,
  fboId: string,
  field: "isPrimary" | "isPreferred",
  next: boolean,
): Promise<{ ok: true; value: boolean } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };
  if (!UUID_RE.test(fboId)) return { ok: false, error: "Bad fbo id" };

  const r = await runOp(fboToggleOp, session.value, { id: airportId, fboId, field, value: next });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, value: (r.value.value as { value: boolean }).value };
}
