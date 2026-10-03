"use server";

import type { z } from "zod";
import { sessionActor } from "@/domain/actor";
import { runOp, type RunOutcome } from "@/domain/ops/registry";
import {
  operatorContactAddOp,
  operatorContactRemoveOp,
  operatorContactToggleEscalationOp,
  operatorCreateOp,
  operatorUpdateOp,
} from "@/domain/reference/ops";
import type { Err } from "@/domain/result";

/**
 * The work itself is the operator.* ops (src/domain/reference), shared
 * with the API and the approval queue; runOp checks the permission
 * (`settings` = owners for the operator itself, `desk` for its contacts)
 * and revalidates the pages. These wrappers turn the form into the op's
 * input and the outcome back into the shape the forms expect.
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
  // YYYY-MM-DD shape — anything else is ignored.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function pickNumericString(form: FormData, name: string): string | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return raw;
}

/** The form's own wording for a failed op: the first validation message, or the op's sentence. */
function failure(r: Err, notFound: string): string {
  if (r.code === "invalid") return (r.details as z.ZodIssue[] | undefined)?.[0]?.message ?? r.error;
  if (r.code === "not_found") return notFound;
  return r.error;
}

function operatorInput(formData: FormData): Record<string, unknown> {
  return {
    name: pickString(formData, "name"),
    status: pickString(formData, "status") || undefined,
    argusRating: pickString(formData, "argusRating") || undefined,
    homeAirportIcao: pickString(formData, "homeAirportIcao"),
    certNumber: pickString(formData, "certNumber"),
    faaPart: pickString(formData, "faaPart"),
    yearsPartner: pickInt(formData, "yearsPartner"),
    isPreferred: pickBool(formData, "isPreferred"),
    wyvernWingman: pickBool(formData, "wyvernWingman"),
    isbaoStage: pickInt(formData, "isbaoStage"),
    argusRenewsOn: pickDate(formData, "argusRenewsOn"),
    wyvernRenewsOn: pickDate(formData, "wyvernRenewsOn"),
    isbaoRenewsOn: pickDate(formData, "isbaoRenewsOn"),
    insuranceRenewsOn: pickDate(formData, "insuranceRenewsOn"),
    nextAuditOn: pickDate(formData, "nextAuditOn"),
    liabilityLimitUsd: pickInt(formData, "liabilityLimitUsd"),
    paymentTerms: pickString(formData, "paymentTerms"),
    volumeDiscountPct: pickNumericString(formData, "volumeDiscountPct"),
    rateLock: pickBool(formData, "rateLock"),
    notes: pickString(formData, "notes"),
    suspendedReason: pickString(formData, "suspendedReason"),
  };
}

export type ContactResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function addOperatorContact(
  operatorId: string,
  formData: FormData,
): Promise<ContactResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };

  const r: RunOutcome = await runOp(operatorContactAddOp, session.value, {
    id: operatorId,
    name: pickString(formData, "name"),
    role: pickString(formData, "role"),
    email: pickString(formData, "email"),
    phoneE164: pickString(formData, "phoneE164"),
    isEscalation: pickBool(formData, "isEscalation"),
  });
  if (!r.ok) return { ok: false, error: failure(r, "Operator not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

export async function deleteOperatorContact(
  operatorId: string,
  contactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };
  if (!UUID_RE.test(contactId)) return { ok: false, error: "Bad contact id" };

  const r = await runOp(operatorContactRemoveOp, session.value, { id: operatorId, contactId });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

export type CreateOperatorResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createOperator(formData: FormData): Promise<CreateOperatorResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const r = await runOp(operatorCreateOp, session.value, operatorInput(formData));
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

export async function updateOperator(
  operatorId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };

  const r = await runOp(operatorUpdateOp, session.value, { id: operatorId, ...operatorInput(formData) });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

export async function toggleOperatorContactEscalation(
  operatorId: string,
  contactId: string,
  next: boolean,
): Promise<{ ok: true; isEscalation: boolean } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };
  if (!UUID_RE.test(contactId)) return { ok: false, error: "Bad contact id" };

  const r = await runOp(operatorContactToggleEscalationOp, session.value, { id: operatorId, contactId, isEscalation: next });
  if (!r.ok) return { ok: false, error: failure(r, "Not found") };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, isEscalation: (r.value.value as { isEscalation: boolean }).isEscalation };
}
