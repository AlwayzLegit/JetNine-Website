import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { openSealed, secretboxConfigured } from "../secretbox.js";

// Which vendor runs the call. Source of truth is the ai_routes /
// ai_providers tables the admin edits at /admin/settings/ai on the site;
// the ANTHROPIC_API_KEY environment variable is the fallback when nothing
// is routed there. Resolved once per turn, cached for a minute, and the
// last good answer is kept if the database is unreachable so a Supabase
// blip cannot silence the phone.

export type ProviderKind = "anthropic" | "openai";

export type ProviderConfig = {
  provider: ProviderKind;
  label: string;
  apiKey: string;
  model: string;
  source: "db" | "env";
};

export type LlmRouting = {
  primary: ProviderConfig | null;
  fallback: ProviderConfig | null;
  /** Why the routing is what it is, for /health and the boot log. */
  note: string;
};

const CACHE_MS = 60_000;
let cached: { at: number; routing: LlmRouting } | null = null;

type ProviderRow = {
  id: string;
  provider: ProviderKind;
  label: string;
  api_key_enc: string;
  default_model: string;
  enabled: boolean;
};

function envFallback(): ProviderConfig | null {
  if (!config.anthropic.apiKey) return null;
  return {
    provider: "anthropic",
    label: "Anthropic (env)",
    apiKey: config.anthropic.apiKey,
    model: config.anthropic.model,
    source: "env",
  };
}

async function loadFromDb(): Promise<LlmRouting> {
  const db = getDb();
  const { data: route, error: routeErr } = await db
    .from("ai_routes")
    .select("primary_provider_id, fallback_provider_id")
    .eq("purpose", "voice_agent")
    .maybeSingle();
  if (routeErr) throw new Error(`ai_routes: ${routeErr.message}`);

  const ids = [route?.primary_provider_id, route?.fallback_provider_id].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (ids.length === 0) {
    const env = envFallback();
    return { primary: env, fallback: null, note: env ? "no route in ai_routes; using ANTHROPIC_API_KEY" : "no route and no ANTHROPIC_API_KEY" };
  }

  const { data: rows, error: provErr } = await db
    .from("ai_providers")
    .select("id, provider, label, api_key_enc, default_model, enabled")
    .in("id", ids);
  if (provErr) throw new Error(`ai_providers: ${provErr.message}`);

  if (!secretboxConfigured()) {
    const env = envFallback();
    return { primary: env, fallback: null, note: "AI_KEYS_ENCRYPTION_KEY unset on this service; cannot read routed keys" };
  }

  const byId = new Map<string, ProviderConfig>();
  for (const r of (rows ?? []) as ProviderRow[]) {
    if (!r.enabled) continue;
    try {
      byId.set(r.id, {
        provider: r.provider,
        label: r.label,
        apiKey: openSealed(r.api_key_enc),
        model: r.default_model,
        source: "db",
      });
    } catch {
      // Sealed with a different key than this service holds; skip the row.
    }
  }
  const primary = route?.primary_provider_id ? byId.get(route.primary_provider_id) ?? null : null;
  const fallback = route?.fallback_provider_id ? byId.get(route.fallback_provider_id) ?? null : null;
  if (!primary) {
    const env = envFallback();
    return {
      primary: env ?? fallback,
      fallback: env ? fallback : null,
      note: env ? "routed primary unusable (disabled or undecryptable); using ANTHROPIC_API_KEY" : "routed primary unusable and no ANTHROPIC_API_KEY",
    };
  }
  return { primary, fallback, note: `routed: ${primary.label}${fallback ? ` → ${fallback.label}` : ""}` };
}

export async function resolveRouting(): Promise<LlmRouting> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.routing;
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    const env = envFallback();
    return { primary: env, fallback: null, note: "Supabase not configured; env key only" };
  }
  try {
    const routing = await loadFromDb();
    cached = { at: Date.now(), routing };
    return routing;
  } catch (err) {
    if (cached) return { ...cached.routing, note: `${cached.routing.note} (stale: ${String(err)})` };
    const env = envFallback();
    return { primary: env, fallback: null, note: `ai tables unreadable (${err instanceof Error ? err.message : String(err)}); ${env ? "using ANTHROPIC_API_KEY" : "no key"}` };
  }
}

/** Drop the cache (tests; or after the admin changes routing and we want it now). */
export function resetRoutingCache(): void {
  cached = null;
}

/** Safe-to-log view: no key material. */
export function describeRouting(r: LlmRouting) {
  const view = (p: ProviderConfig | null) => (p ? { provider: p.provider, model: p.model, label: p.label, source: p.source } : null);
  return { primary: view(r.primary), fallback: view(r.fallback), note: r.note };
}
