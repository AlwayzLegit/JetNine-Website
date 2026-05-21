"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  operatorContacts,
  operators,
  type NewOperatorContact,
} from "@/db/schema/operators";
import { requireStaff } from "@/lib/auth";
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
