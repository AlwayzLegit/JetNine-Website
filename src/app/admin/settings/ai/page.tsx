import { requireAdmin } from "@/lib/auth";
import {
  PROVIDER_META,
  getRoute,
  isSecretboxConfigured,
  listProviders,
} from "@/lib/ai-providers";
import { AI_PROVIDERS } from "@/db/schema/ai";
import { DeskHeader } from "@/components/admin/desk-ui";
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
    // notice rather than a 500, so the fix is obvious from the screen.
    console.error("[admin/settings/ai] query failed", err);
    tablesMissing = true;
  }

  const kinds = AI_PROVIDERS.map((k) => ({ kind: k, ...PROVIDER_META[k] }));

  return (
    <div>
      <DeskHeader size="md"
        back={{ href: "/admin/settings/connections", label: "Settings › Connections" }}
        title="Phone answering"
        lead="Store a key for each vendor you want available, then choose which one answers the phone and which one it falls back to. Keys are encrypted and never shown again; only the last four characters stay readable."
      />

      {!keyStorageReady ? (
        <Notice>
          Keys cannot be stored on this deployment because AI_KEYS_ENCRYPTION_KEY is not set. Set it on Vercel
          (production) and redeploy.
        </Notice>
      ) : null}
      {tablesMissing ? (
        <Notice>
          The provider tables are missing. Apply migration 0047_ai_providers.sql to the database, then reload.
        </Notice>
      ) : null}

      <div className="mt-6">
        <AiSettings
          kinds={kinds}
          providers={providers}
          route={route}
          disabled={!keyStorageReady || tablesMissing}
        />
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="card bg-panel mt-6 border-danger px-5 py-3.5 text-[14px] text-danger">
      {children}
    </p>
  );
}
