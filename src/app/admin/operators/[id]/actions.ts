"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  operatorContacts,
  operators,
  operatorStatusEnum,
  operatorVettingArgusEnum,
  type NewOperator,
  type NewOperatorContact,
} from "@/db/schema/operators";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickString(form: FormData, name: string): string {
  return ((form.get(name) as string | null) ?? "").trim();
}

function pickBool(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

export type ContactResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function addOperatorContact(
  operatorId: string,
  formData: FormData,
): Promise<ContactResult> {
  const actor = await requireStaff();
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };

  const [op] = await db
    .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
    .from(operators)
    .where(eq(operators.id, operatorId));
  if (!op) return { ok: false, error: "Operator not found" };

  const name = pickString(formData, "name");
  if (name.length < 2) return { ok: false, error: "Name required" };
  if (name.length > 120) return { ok: false, error: "Name too long" };

  const role = pickString(formData, "role") || null;
  const email = pickString(formData, "email") || null;
  const phone = pickString(formData, "phoneE164") || null;
  const isEscalation = pickBool(formData, "isEscalation");

  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Email looks invalid" };
  if (phone && !E164_RE.test(phone)) return { ok: false, error: "Phone must be E.164 (+15551234567)" };
  if (!email && !phone) return { ok: false, error: "Email or phone required" };

  const values: NewOperatorContact = {
    operatorId,
    name,
    role,
    email,
    phoneE164: phone,
    isEscalation,
  };

  try {
    const [row] = await db
      .insert(operatorContacts)
      .values(values)
      .returning({ id: operatorContacts.id });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "operator.contact.create",
      subjectType: "operator",
      subjectId: operatorId,
      subjectCode: op.certNumber ?? op.name,
      metadata: {
        contactId: row.id,
        name,
        role,
        isEscalation,
        hasEmail: Boolean(email),
        hasPhone: Boolean(phone),
      },
    });

    revalidatePath(`/admin/operators/${operatorId}`);
    revalidatePath("/admin/operators");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("addOperatorContact failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function deleteOperatorContact(
  operatorId: string,
  contactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };
  if (!UUID_RE.test(contactId)) return { ok: false, error: "Bad contact id" };

  const [target] = await db
    .select({
      id: operatorContacts.id,
      name: operatorContacts.name,
      role: operatorContacts.role,
      isEscalation: operatorContacts.isEscalation,
    })
    .from(operatorContacts)
    .where(
      and(
        eq(operatorContacts.id, contactId),
        eq(operatorContacts.operatorId, operatorId),
      ),
    );
  if (!target) return { ok: false, error: "Not found" };

  await db.delete(operatorContacts).where(eq(operatorContacts.id, target.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "operator.contact.delete",
    subjectType: "operator",
    subjectId: operatorId,
    metadata: {
      contactId: target.id,
      name: target.name,
      role: target.role,
      isEscalation: target.isEscalation,
    },
  });

  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin/operators");
  return { ok: true };
}

// ─── Operator fields ────────────────────────────────────────────────────────

const STATUSES = operatorStatusEnum.enumValues as readonly string[];
const ARGUS = operatorVettingArgusEnum.enumValues as readonly string[];
const ICAO_RE = /^[A-Z0-9]{4}$/;

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

function operatorValuesFromForm(formData: FormData): {
  ok: true;
  values: Partial<NewOperator>;
} | { ok: false; error: string } {
  const name = pickString(formData, "name");
  if (name.length < 2) return { ok: false, error: "Name required" };
  if (name.length > 140) return { ok: false, error: "Name too long" };

  const statusRaw = pickString(formData, "status") || "active";
  if (!STATUSES.includes(statusRaw)) return { ok: false, error: "Invalid status" };

  const argusRaw = pickString(formData, "argusRating") || "none";
  if (!ARGUS.includes(argusRaw)) return { ok: false, error: "Invalid ARG/US rating" };

  const homeIcao = pickString(formData, "homeAirportIcao").toUpperCase() || null;
  if (homeIcao && !ICAO_RE.test(homeIcao)) {
    return { ok: false, error: "Home airport ICAO must be 4 chars" };
  }

  const certNumber = pickString(formData, "certNumber") || null;
  const faaPart = pickString(formData, "faaPart") || "135";

  const yearsPartner = pickInt(formData, "yearsPartner");
  const isbaoStage = pickInt(formData, "isbaoStage");
  const liabilityRaw = pickInt(formData, "liabilityLimitUsd");
  const volumeDiscountPct = pickNumericString(formData, "volumeDiscountPct");

  if (statusRaw === "suspended" && !pickString(formData, "suspendedReason")) {
    return { ok: false, error: "Suspended reason required" };
  }

  const values: Partial<NewOperator> = {
    name,
    certNumber,
    faaPart,
    homeAirportIcao: homeIcao,
    yearsPartner,
    isPreferred: pickBool(formData, "isPreferred"),
    status: statusRaw as NewOperator["status"],
    argusRating: argusRaw as NewOperator["argusRating"],
    wyvernWingman: pickBool(formData, "wyvernWingman"),
    isbaoStage,
    argusRenewsOn: pickDate(formData, "argusRenewsOn"),
    wyvernRenewsOn: pickDate(formData, "wyvernRenewsOn"),
    isbaoRenewsOn: pickDate(formData, "isbaoRenewsOn"),
    insuranceRenewsOn: pickDate(formData, "insuranceRenewsOn"),
    nextAuditOn: pickDate(formData, "nextAuditOn"),
    liabilityLimitUsd: liabilityRaw,
    paymentTerms: pickString(formData, "paymentTerms") || null,
    volumeDiscountPct: volumeDiscountPct,
    rateLock: pickBool(formData, "rateLock"),
    notes: pickString(formData, "notes") || null,
    suspendedReason: pickString(formData, "suspendedReason") || null,
  };

  return { ok: true, values };
}

export type CreateOperatorResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createOperator(formData: FormData): Promise<CreateOperatorResult> {
  const actor = await requireAdmin();

  const parsed = operatorValuesFromForm(formData);
  if (!parsed.ok) return parsed;

  // certNumber is unique when present — pre-check for a clean error.
  if (parsed.values.certNumber) {
    const [conflict] = await db
      .select({ id: operators.id })
      .from(operators)
      .where(eq(operators.certNumber, parsed.values.certNumber));
    if (conflict) return { ok: false, error: "Another operator already has that cert number" };
  }

  try {
    const [row] = await db
      .insert(operators)
      .values(parsed.values as NewOperator)
      .returning({ id: operators.id, name: operators.name });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "operator.create",
      subjectType: "operator",
      subjectId: row.id,
      subjectCode: parsed.values.certNumber ?? row.name,
      metadata: {
        name: row.name,
        argusRating: parsed.values.argusRating,
        wyvernWingman: parsed.values.wyvernWingman,
        isPreferred: parsed.values.isPreferred,
      },
    });

    revalidatePath("/admin/operators");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("createOperator failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function updateOperator(
  operatorId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };

  const [before] = await db
    .select()
    .from(operators)
    .where(eq(operators.id, operatorId));
  if (!before) return { ok: false, error: "Not found" };

  const parsed = operatorValuesFromForm(formData);
  if (!parsed.ok) return parsed;

  // Cert number collision (excluding self).
  if (parsed.values.certNumber && parsed.values.certNumber !== before.certNumber) {
    const [conflict] = await db
      .select({ id: operators.id })
      .from(operators)
      .where(eq(operators.certNumber, parsed.values.certNumber));
    if (conflict && conflict.id !== operatorId) {
      return { ok: false, error: "Another operator already has that cert number" };
    }
  }

  await db.update(operators).set(parsed.values).where(eq(operators.id, operatorId));

  // Synthesize a per-field diff so audit log is grep-friendly.
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of Object.keys(parsed.values) as (keyof typeof parsed.values)[]) {
    const beforeVal = (before as Record<string, unknown>)[k];
    const afterVal = parsed.values[k];
    if (beforeVal !== afterVal && JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[k] = { before: beforeVal, after: afterVal };
    }
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "operator.update",
    subjectType: "operator",
    subjectId: operatorId,
    subjectCode: before.certNumber ?? before.name,
    diff: Object.keys(diff).length ? diff : null,
  });

  revalidatePath("/admin/operators");
  revalidatePath(`/admin/operators/${operatorId}`);
  return { ok: true };
}

export async function toggleOperatorContactEscalation(
  operatorId: string,
  contactId: string,
  next: boolean,
): Promise<{ ok: true; isEscalation: boolean } | { ok: false; error: string }> {
  const actor = await requireStaff();
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Bad operator id" };
  if (!UUID_RE.test(contactId)) return { ok: false, error: "Bad contact id" };

  const [target] = await db
    .select({
      id: operatorContacts.id,
      isEscalation: operatorContacts.isEscalation,
      name: operatorContacts.name,
    })
    .from(operatorContacts)
    .where(
      and(
        eq(operatorContacts.id, contactId),
        eq(operatorContacts.operatorId, operatorId),
      ),
    );
  if (!target) return { ok: false, error: "Not found" };

  if (target.isEscalation === next) {
    return { ok: true, isEscalation: target.isEscalation };
  }

  await db
    .update(operatorContacts)
    .set({ isEscalation: next })
    .where(eq(operatorContacts.id, target.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "operator.contact.escalation.toggle",
    subjectType: "operator",
    subjectId: operatorId,
    diff: { isEscalation: { before: target.isEscalation, after: next } },
    metadata: { contactId: target.id, name: target.name },
  });

  revalidatePath(`/admin/operators/${operatorId}`);
  return { ok: true, isEscalation: next };
}
