import { requireAdmin } from "@/lib/auth";
import {
  PROVIDER_META,
  getRoute,
  isSecretboxConfigured,
  listProviders,
} from "@/lib/ai-providers";
import { AI_PROVIDERS } from "@/db/schema/ai";
import { AiSettings } from "./ai-settings";

export const dynamic = "force-dynamic";

// Vendor keys and routing for every AI surface. Admin and superadmin only:
// the page itself gates, and so does every action it calls.

export default async function AdminAiSettingsPage() {
  await requireAdmin();

  const keyStorageReady = isSecretboxConfigured();
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let route: Awaited<ReturnType<typeof getRoute>> = {
    purpose: "voice_agent",
    primaryProviderId: null,
    fallbackProviderId: null,
  };
  let tablesMissing = false;
  try {
    [providers, route] = await Promise.all([listProviders(), getRoute("voice_agent")]);
  } catch (err) {
    // Migration 0047 not applied yet: render the page with an explicit
    // banner rather than a 500, so the fix is obvious from the screen.
    console.error("[admin/settings/ai] query failed", err);
    tablesMissing = true;
  }

  const kinds = AI_PROVIDERS.map((k) => ({ kind: k, ...PROVIDER_META[k] }));

  return (
    <div className="container-jn py-10">
      <header className="mb-10">
        <p className="caption mb-3">— Admin · settings · AI providers</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          Which model answers the phone.
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
          Store a key for each vendor you want available, then choose which one the voice desk
          uses and which one it falls back to. Keys are encrypted at rest and never shown again;
          only the last four characters are kept in the clear.
        </p>
      </header>

      {!keyStorageReady ? (
        <Banner tone="error">
          AI_KEYS_ENCRYPTION_KEY is not set on this deployment, so keys cannot be stored. Set it on
          Vercel (production) and redeploy.
        </Banner>
      ) : null}
      {tablesMissing ? (
        <Banner tone="error">
          The ai_providers tables are missing. Apply migration 0047_ai_providers.sql to the
          database, then reload.
        </Banner>
      ) : null}

      <AiSettings
        kinds={kinds}
        providers={providers}
        route={route}
        disabled={!keyStorageReady || tablesMissing}
      />
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "warn"; children: React.ReactNode }) {
  const cls = tone === "error" ? "border-[var(--error)] text-[var(--error)]" : "border-[var(--warn)] text-[var(--warn)]";
  return (
    <div className={`mb-8 border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] ${cls}`}>
      {children}
    </div>
  );
}
