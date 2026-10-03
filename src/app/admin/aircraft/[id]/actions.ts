"use server";

import type { z } from "zod";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { NO_OPERATOR } from "@/domain/reference/commands";
import { aircraftCreateOp, aircraftUpdateOp } from "@/domain/reference/ops";
import type { Err } from "@/domain/result";

/**
 * The work itself is the aircraft.* ops (src/domain/reference), shared
 * with the API and the approval queue; runOp checks the `settings`
 * permission (owners) and revalidates the pages. These wrappers turn the
 * form into the op's input and the outcome back into the shape the form
 * expects.
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

function pickDate(form: FormData, name: string): string | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

/** The form's own wording for a failed op: the first validation message, or the op's sentence. */
function failure(r: Err): string {
  if (r.code === "invalid") return (r.details as z.ZodIssue[] | undefined)?.[0]?.message ?? r.error;
  if (r.code === "not_found") return r.error === NO_OPERATOR ? "Operator not found" : "Not found";
  return r.error;
}

function aircraftInput(formData: FormData): Record<string, unknown> {
  return {
    tailNumber: pickString(formData, "tailNumber"),
    operatorId: pickString(formData, "operatorId"),
    category: pickString(formData, "category"),
    makeModel: pickString(formData, "makeModel"),
    seats: pickInt(formData, "seats"),
    rangeNm: pickInt(formData, "rangeNm"),
    speedKt: pickInt(formData, "speedKt"),
    yearManufactured: pickInt(formData, "yearManufactured"),
    baseIcao: pickString(formData, "baseIcao"),
    wifiType: pickString(formData, "wifiType") || undefined,
    status: pickString(formData, "status") || undefined,
    cabinHeightIn: pickInt(formData, "cabinHeightIn"),
    standupCabin: pickBool(formData, "standupCabin"),
    lavatoryEnclosed: pickBool(formData, "lavatoryEnclosed"),
    lieflatCapable: pickBool(formData, "lieflatCapable"),
    petFriendly: pickBool(formData, "petFriendly"),
    flightAttendantStandard: pickBool(formData, "flightAttendantStandard"),
    totalHours: pickInt(formData, "totalHours"),
    lastCCheckOn: pickDate(formData, "lastCCheckOn"),
  };
}

export type CreateAircraftResult =
  | { ok: true; id: string; tailNumber: string }
  | { ok: false; error: string };

export async function createAircraft(formData: FormData): Promise<CreateAircraftResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const r = await runOp(aircraftCreateOp, session.value, aircraftInput(formData));
  if (!r.ok) return { ok: false, error: failure(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const row = r.value.value as { id: string; tailNumber: string };
  return { ok: true, id: row.id, tailNumber: row.tailNumber };
}

export async function updateAircraft(
  aircraftId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Bad aircraft id" };

  const r = await runOp(aircraftUpdateOp, session.value, { id: aircraftId, ...aircraftInput(formData) });
  if (!r.ok) return { ok: false, error: failure(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}
