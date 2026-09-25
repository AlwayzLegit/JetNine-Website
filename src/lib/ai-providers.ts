import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  AI_PROVIDERS,
  aiProviders,
  aiRoutes,
  type AiProviderKind,
  type AiPurpose,
} from "@/db/schema/ai";
import { isSecretboxConfigured, open, seal } from "@/lib/secretbox";

/**
 * Data layer for /admin/settings/ai. Keys go in sealed and never come back
 * out of this module except to the provider's own API in `testProvider`.
 * Everything the UI sees is masked (last4 + metadata).
 */

export type ProviderView = {
  id: string;
  provider: AiProviderKind;
  label: string;
  last4: string;
  defaultModel: string;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestNote: string | null;
  updatedAt: string;
};

export type RouteView = {
  purpose: AiPurpose;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
};

export const PROVIDER_META: Record<
  AiProviderKind,
  { label: string; keyPrefix: string; suggestedModel: string; console: string }
> = {
  anthropic: {
    label: "Anthropic (Claude)",
    keyPrefix: "sk-ant-",
    suggestedModel: "claude-sonnet-5",
    console: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    label: "OpenAI",
    keyPrefix: "sk-",
    suggestedModel: "gpt-5",
    console: "https://platform.openai.com/api-keys",
  },
};

export function isProviderKind(v: string): v is AiProviderKind {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

export { isSecretboxConfigured };

export async function listProviders(): Promise<ProviderView[]> {
  const rows = await db.select().from(aiProviders);
  return rows
    .map((r) => ({
      id: r.id,
      provider: r.provider,
      label: r.label,
      last4: r.apiKeyLast4,
      defaultModel: r.defaultModel,
      enabled: r.enabled,
      lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
      lastTestOk: r.lastTestOk,
      lastTestNote: r.lastTestNote,
      updatedAt: r.updatedAt.toISOString(),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

export async function getRoute(purpose: AiPurpose): Promise<RouteView> {
  const [row] = await db.select().from(aiRoutes).where(eq(aiRoutes.purpose, purpose));
  return {
    purpose,
    primaryProviderId: row?.primaryProviderId ?? null,
    fallbackProviderId: row?.fallbackProviderId ?? null,
  };
}

export async function upsertProviderKey(input: {
  provider: AiProviderKind;
  apiKey: string;
  label: string;
  defaultModel: string;
  createdBy: string;
}): Promise<{ id: string; replaced: boolean }> {
  const sealed = seal(input.apiKey);
  const last4 = input.apiKey.slice(-4);
  const [existing] = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(eq(aiProviders.provider, input.provider));
  if (existing) {
    await db
      .update(aiProviders)
      .set({
        apiKeyEnc: sealed,
        apiKeyLast4: last4,
        label: input.label,
        defaultModel: input.defaultModel,
        lastTestedAt: null,
        lastTestOk: null,
        lastTestNote: null,
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, existing.id));
    return { id: existing.id, replaced: true };
  }
  const [row] = await db
    .insert(aiProviders)
    .values({
      provider: input.provider,
      label: input.label,
      apiKeyEnc: sealed,
      apiKeyLast4: last4,
      defaultModel: input.defaultModel,
      createdBy: input.createdBy,
    })
    .returning({ id: aiProviders.id });
  return { id: row.id, replaced: false };
}

export async function updateProviderSettings(input: {
  provider: AiProviderKind;
  label: string;
  defaultModel: string;
  enabled: boolean;
}): Promise<{ id: string } | null> {
  const [row] = await db
    .update(aiProviders)
    .set({
      label: input.label,
      defaultModel: input.defaultModel,
      enabled: input.enabled,
      updatedAt: new Date(),
    })
    .where(eq(aiProviders.provider, input.provider))
    .returning({ id: aiProviders.id });
  return row ?? null;
}

export async function removeProvider(provider: AiProviderKind): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(aiProviders)
    .where(eq(aiProviders.provider, provider))
    .returning({ id: aiProviders.id });
  return row ?? null;
}

export async function setRoute(input: {
  purpose: AiPurpose;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
}): Promise<void> {
  await db
    .insert(aiRoutes)
    .values({
      purpose: input.purpose,
      primaryProviderId: input.primaryProviderId,
      fallbackProviderId: input.fallbackProviderId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: aiRoutes.purpose,
      set: {
        primaryProviderId: input.primaryProviderId,
        fallbackProviderId: input.fallbackProviderId,
        updatedAt: new Date(),
      },
    });
}

export type TestResult =
  | { ok: true; models: string[]; modelKnown: boolean; note: string }
  | { ok: false; note: string };

/**
 * Prove the stored key works by listing the vendor's models with it, and
 * say whether the configured default model is in that list. Runs from the
 * Vercel function, so it also proves egress to the vendor from where the
 * site runs. Records the outcome on the row.
 */
export async function testProvider(provider: AiProviderKind): Promise<TestResult> {
  const [row] = await db.select().from(aiProviders).where(eq(aiProviders.provider, provider));
  if (!row) return { ok: false, note: "No key stored for this provider." };

  let apiKey: string;
  try {
    apiKey = open(row.apiKeyEnc);
  } catch (err) {
    return {
      ok: false,
      note: `Stored key cannot be decrypted (${err instanceof Error ? err.message : "unknown"}). Re-enter it.`,
    };
  }

  const result = await listModels(provider, apiKey);
  await db
    .update(aiProviders)
    .set({
      lastTestedAt: new Date(),
      lastTestOk: result.ok,
      lastTestNote: result.note.slice(0, 300),
    })
    .where(eq(aiProviders.id, row.id));

  if (!result.ok) return result;
  const modelKnown = result.models.includes(row.defaultModel);
  return {
    ok: true,
    models: result.models,
    modelKnown,
    note: modelKnown
      ? `Key accepted. ${result.models.length} models available; "${row.defaultModel}" is one of them.`
      : `Key accepted, but "${row.defaultModel}" is not in the ${result.models.length} models this key can use. Pick one from the list.`,
  };
}

async function listModels(
  provider: AiProviderKind,
  apiKey: string,
): Promise<{ ok: true; models: string[]; note: string } | { ok: false; note: string }> {
  const url =
    provider === "anthropic" ? "https://api.anthropic.com/v1/models?limit=100" : "https://api.openai.com/v1/models";
  const headers: Record<string, string> =
    provider === "anthropic"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { authorization: `Bearer ${apiKey}` };

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    return { ok: false, note: `Could not reach ${provider}: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 160);
    return { ok: false, note: `${provider} answered ${res.status}: ${text || res.statusText}` };
  }
  const json = (await res.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
  const models = (json?.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string")
    .sort();
  return { ok: true, models, note: `${models.length} models` };
}
