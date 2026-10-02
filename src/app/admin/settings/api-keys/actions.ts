"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createKey, revokeKey } from "@/domain/api-keys/commands";
import { sessionActor } from "@/domain/actor";

// Settings › API keys. Owner-only Server Actions; the token is returned
// once, to the browser that created it, and never stored.

export type CreateKeyResult = { ok: true; name: string; token: string } | { ok: false; error: string };
export type RevokeKeyResult = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/admin/settings/api-keys";

export async function createApiKey(formData: FormData): Promise<CreateKeyResult> {
  await requireAdmin();
  const actor = await sessionActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const r = await createKey(actor.value, {
    name: formData.get("name"),
    template: formData.get("template"),
    scopes: formData.getAll("scopes"),
    supervised: formData.get("supervised"),
    expiresInDays: formData.get("expiresInDays"),
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true, name: r.value.name, token: r.value.token };
}

export async function revokeApiKey(id: string, reason: string): Promise<RevokeKeyResult> {
  await requireAdmin();
  const actor = await sessionActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const r = await revokeKey(actor.value, id, reason);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(PATH);
  return { ok: true, message: `Revoked “${r.value.name}”. It stops working on its next call.` };
}
