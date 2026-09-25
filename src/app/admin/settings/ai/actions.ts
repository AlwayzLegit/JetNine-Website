"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  PROVIDER_META,
  isProviderKind,
  isSecretboxConfigured,
  listProviders,
  removeProvider,
  setRoute,
  testProvider,
  updateProviderSettings,
  upsertProviderKey,
  type TestResult,
} from "@/lib/ai-providers";

// Admin-only (dispatchers excluded): these are vendor credentials and the
// wiring of every AI surface. Every mutation writes an audit row; no key
// material ever reaches the audit log, the response, or the client.

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/admin/settings/ai";
const MODEL_RE = /^[a-z0-9][a-z0-9._:-]{1,80}$/i;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function str(form: FormData, name: string): string {
  return ((form.get(name) as string | null) ?? "").trim();
}

export async function saveProviderKey(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!isSecretboxConfigured()) {
    return { ok: false, error: "AI_KEYS_ENCRYPTION_KEY is not set on the server; keys cannot be stored." };
  }
  const provider = str(formData, "provider");
  if (!isProviderKind(provider)) return { ok: false, error: "Unknown provider" };
  const apiKey = str(formData, "apiKey");
  if (apiKey.length < 20 || /\s/.test(apiKey)) return { ok: false, error: "That does not look like an API key" };
  if (!apiKey.startsWith(PROVIDER_META[provider].keyPrefix)) {
    return { ok: false, error: `${PROVIDER_META[provider].label} keys start with ${PROVIDER_META[provider].keyPrefix}` };
  }
  const label = str(formData, "label") || PROVIDER_META[provider].label;
  if (label.length > 60) return { ok: false, error: "Label too long" };
  const defaultModel = str(formData, "defaultModel") || PROVIDER_META[provider].suggestedModel;
  if (!MODEL_RE.test(defaultModel)) return { ok: false, error: "Model id looks invalid" };

  try {
    const { id, replaced } = await upsertProviderKey({
      provider,
      apiKey,
      label,
      defaultModel,
      createdBy: actor.id,
    });
    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: replaced ? "ai_provider.key.replace" : "ai_provider.key.create",
      subjectType: "ai_provider",
      subjectId: id,
      subjectCode: provider,
      metadata: { last4: apiKey.slice(-4), defaultModel, label },
    });
    revalidatePath(PATH);
    return { ok: true, message: `${label} key ${replaced ? "replaced" : "stored"} (…${apiKey.slice(-4)}). Run Test.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not store the key" };
  }
}

export async function saveProviderSettings(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const provider = str(formData, "provider");
  if (!isProviderKind(provider)) return { ok: false, error: "Unknown provider" };
  const label = str(formData, "label") || PROVIDER_META[provider].label;
  if (label.length > 60) return { ok: false, error: "Label too long" };
  const defaultModel = str(formData, "defaultModel");
  if (!MODEL_RE.test(defaultModel)) return { ok: false, error: "Model id looks invalid" };
  const enabled = formData.get("enabled") === "on";

  const row = await updateProviderSettings({ provider, label, defaultModel, enabled });
  if (!row) return { ok: false, error: "No key stored for this provider yet" };
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "ai_provider.settings.update",
    subjectType: "ai_provider",
    subjectId: row.id,
    subjectCode: provider,
    diff: { defaultModel: { after: defaultModel }, enabled: { after: enabled }, label: { after: label } },
  });
  revalidatePath(PATH);
  return { ok: true, message: `${label}: model ${defaultModel}, ${enabled ? "enabled" : "disabled"}.` };
}

export async function deleteProviderKey(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const provider = str(formData, "provider");
  if (!isProviderKind(provider)) return { ok: false, error: "Unknown provider" };
  const row = await removeProvider(provider);
  if (!row) return { ok: false, error: "Nothing to remove" };
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "ai_provider.key.delete",
    subjectType: "ai_provider",
    subjectId: row.id,
    subjectCode: provider,
  });
  revalidatePath(PATH);
  return { ok: true, message: `${PROVIDER_META[provider].label} key removed. Routes that used it now fall back.` };
}

export async function runProviderTest(formData: FormData): Promise<TestResult> {
  const actor = await requireAdmin();
  const provider = str(formData, "provider");
  if (!isProviderKind(provider)) return { ok: false, note: "Unknown provider" };
  const result = await testProvider(provider);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "ai_provider.test",
    subjectType: "ai_provider",
    subjectCode: provider,
    metadata: { ok: result.ok, note: result.note.slice(0, 200) },
  });
  revalidatePath(PATH);
  return result;
}

export async function saveVoiceRoute(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const primary = str(formData, "primaryProviderId");
  const fallback = str(formData, "fallbackProviderId");
  if (primary && !UUID_RE.test(primary)) return { ok: false, error: "Bad primary provider" };
  if (fallback && !UUID_RE.test(fallback)) return { ok: false, error: "Bad fallback provider" };
  if (primary && fallback && primary === fallback) {
    return { ok: false, error: "Fallback must differ from primary" };
  }
  const known = new Set((await listProviders()).map((p) => p.id));
  if (primary && !known.has(primary)) return { ok: false, error: "Primary provider not found" };
  if (fallback && !known.has(fallback)) return { ok: false, error: "Fallback provider not found" };

  await setRoute({
    purpose: "voice_agent",
    primaryProviderId: primary || null,
    fallbackProviderId: fallback || null,
  });
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "ai_route.update",
    subjectType: "ai_provider",
    subjectCode: "voice_agent",
    diff: { primaryProviderId: { after: primary || null }, fallbackProviderId: { after: fallback || null } },
  });
  revalidatePath(PATH);
  return {
    ok: true,
    message: primary
      ? "Voice desk routing saved. The service picks it up on its next call."
      : "Voice desk routing cleared. The service falls back to ANTHROPIC_API_KEY on Render, if set.",
  };
}
