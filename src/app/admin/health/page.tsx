import { requireStaff } from "@/lib/auth";
import { snapshot, type HealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<HealthSnapshot["status"], string> = {
  healthy: "border-[var(--success)] text-[var(--success)]",
  degraded: "border-[var(--warn)] text-[var(--warn)]",
  unhealthy: "border-[var(--error)] text-[var(--error)]",
};

// Per-integration spec — drives the table below. Each row pulls a
// boolean (or several) out of the snapshot's checks.* object and
// renders an at-a-glance green/red dot plus the relevant configuration
// metadata.
type Row = {
  key: keyof HealthSnapshot["checks"];
  label: string;
  // Pull the booleans this row cares about.
  fields: (s: HealthSnapshot["checks"][keyof HealthSnapshot["checks"]]) => Array<{
    label: string;
    ok: boolean;
    detail?: string;
  }>;
  whyItMatters: string;
  fixHint: string;
};

const ROWS: Row[] = [
  {
    key: "db",
    label: "Database",
    fields: (s) => [
      {
        label: "Connection",
        ok: Boolean(s.ok),
        detail:
          typeof s.latencyMs === "number"
            ? `${s.latencyMs}ms`
            : undefined,
      },
    ],
    whyItMatters:
      "Hard dependency. If unreachable: quote submission fails, sign-in fails, every admin page 500s, every account page 500s.",
    fixHint:
      "Check Vercel → Project → Environment Variables. DATABASE_URL must be the Supabase Transaction pooler URL (port 6543). If the DB password was rotated, update DATABASE_URL + DIRECT_URL.",
  },
  {
    key: "stripe",
    label: "Stripe",
    fields: (s) => [
      { label: "Secret key", ok: Boolean(s.configured), detail: String(s.mode ?? "") },
      { label: "Webhook secret", ok: Boolean(s.webhookConfigured) },
    ],
    whyItMatters:
      "Without keys: invoice Pay-now returns STRIPE_NOT_CONFIGURED, Card-tier purchase fails, no payments collected.",
    fixHint:
      "Vercel env: STRIPE_SECRET_KEY (sk_live_… or sk_test_…) + STRIPE_WEBHOOK_SECRET (whsec_…). Register webhook at /api/stripe/webhook with events checkout.session.completed, payment_intent.payment_failed, charge.refunded.",
  },
  {
    key: "email",
    label: "Email",
    fields: (s) => [
      { label: "Outbound", ok: Boolean(s.outboundConfigured), detail: String(s.provider ?? "") },
      { label: "Inbound (Postmark)", ok: Boolean(s.inboundConfigured) },
      { label: "EMAIL_FROM", ok: Boolean(s.fromConfigured) },
    ],
    whyItMatters:
      "Without outbound: dispatcher thread messages log to stdout instead of sending. Without inbound: customer email replies don't thread back.",
    fixHint:
      "Pick Resend or Postmark. Set RESEND_API_KEY or POSTMARK_SERVER_TOKEN + EMAIL_FROM. For inbound replies, configure Postmark Inbound Stream → /api/email/inbound/<INBOUND_EMAIL_SECRET>.",
  },
  {
    key: "twilio",
    label: "Twilio",
    fields: (s) => [
      { label: "SMS", ok: Boolean(s.smsConfigured) },
      { label: "WhatsApp", ok: Boolean(s.whatsappConfigured) },
    ],
    whyItMatters:
      "Without keys: SMS / WhatsApp thread messages log to stdout. Inbound webhook returns 503.",
    fixHint:
      "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_SMS_FROM (E.164). WhatsApp adds TWILIO_WHATSAPP_FROM (needs WABA approval). Number's Messaging webhook → /api/twilio/inbound.",
  },
  {
    key: "sentry",
    label: "Sentry",
    fields: (s) => [
      { label: "Browser DSN", ok: Boolean(s.browserConfigured) },
      { label: "Server DSN", ok: Boolean(s.serverConfigured) },
    ],
    whyItMatters:
      "Without DSN: errors hit console.error only. You won't see production errors until a customer complains.",
    fixHint:
      "NEXT_PUBLIC_SENTRY_DSN + SENTRY_DSN (can be the same value from Sentry project Settings → Client Keys).",
  },
  {
    key: "plausible",
    label: "Plausible",
    fields: (s) => [{ label: "Domain", ok: Boolean(s.configured) }],
    whyItMatters: "No analytics until configured. Won't know what's working.",
    fixHint: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN=jetnine.com",
  },
];

export default async function AdminHealthPage() {
  await requireStaff();
  const snap = await snapshot();

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Health · diagnostic</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Is everything wired?
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Same data as <code className="font-mono text-[12px] text-clearance">GET /api/health</code> —
            rendered for the dispatch desk. Green = configured + working.
            Red = needs operator action; the fix hint says where.
            Refresh the page to re-probe.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={[
              "inline-block rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]",
              STATUS_TONE[snap.status],
            ].join(" ")}
          >
            {snap.status}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
            {snap.env} · {snap.region} · sha {snap.sha}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {ROWS.map((r) => {
          const checkData = snap.checks[r.key];
          const fields = r.fields(checkData);
          const rowOk = fields.every((f) => f.ok);
          return (
            <details
              key={r.key}
              className={[
                "rounded-[4px] border bg-ink-2 transition-colors",
                rowOk ? "border-ink-3" : "border-[var(--error)]",
              ].join(" ")}
              open={!rowOk}
            >
              <summary className="cursor-pointer list-none px-5 py-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5">
                  <span
                    aria-hidden
                    className={[
                      "h-2.5 w-2.5 rounded-full",
                      rowOk ? "bg-[var(--success)]" : "bg-[var(--error)]",
                    ].join(" ")}
                  />
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-bone">
                    {r.label}
                  </span>
                  <span className="flex gap-3 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {fields.map((f) => (
                      <span key={f.label} className={f.ok ? "text-[var(--success)]" : "text-[var(--error)]"}>
                        {f.ok ? "✓" : "✗"} {f.label}
                        {f.detail ? ` (${f.detail})` : ""}
                      </span>
                    ))}
                  </span>
                </div>
              </summary>
              <div className="border-t border-ink-3 px-5 py-4 text-[13px] leading-[1.55] text-bone-2">
                <p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                    Why it matters —{" "}
                  </span>
                  {r.whyItMatters}
                </p>
                <p className="mt-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                    Fix —{" "}
                  </span>
                  {r.fixHint}
                </p>
              </div>
            </details>
          );
        })}
      </div>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
        — Captured {snap.timestamp}
      </p>
    </div>
  );
}
