import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PROVIDER_META, getRoute, listProviders } from "@/lib/ai-providers";
import { healthSnapshot } from "@/domain/settings/queries";
import { DeskHeader, DotSentence } from "@/components/admin/desk-ui";
import { sendTestEmail } from "./actions";

export const dynamic = "force-dynamic";

// Same link as the sidebar's "Open Avinode ↗" (desk-sidebar.tsx is a client
// module, so the constant is repeated here rather than imported).
const AVINODE_URL = "https://marketplace.avinode.com/";

type Tone = "success" | "gold" | "danger" | "steel";

type Row = {
  key: string;
  name: string;
  does: string;
  tone: Tone;
  status: string;
  action: { label: string; href: string; external?: boolean } | { label: string; test: true } | null;
  /** Shown under the row inside "What to check" when the dot is not green. */
  hint?: string;
};

/** "+1 (424) 487-2707" from E.164; anything non-NANP stays as typed. */
function phoneWords(e164: string | undefined): string | null {
  if (!e164) return null;
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164.trim());
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164.trim();
}

async function phoneAnswering(): Promise<{ tone: Tone; status: string; hint?: string }> {
  try {
    const [providers, route] = await Promise.all([listProviders(), getRoute("voice_agent")]);
    const byId = new Map(providers.map((p) => [p.id, p]));
    const primary = route.primaryProviderId ? byId.get(route.primaryProviderId) : null;
    const fallback = route.fallbackProviderId ? byId.get(route.fallbackProviderId) : null;
    const short = (kind: "anthropic" | "openai") => (kind === "anthropic" ? "Anthropic" : "OpenAI");
    if (primary) {
      const backup = fallback ? `, ${short(fallback.provider)} as backup` : ", no backup";
      const tone: Tone = primary.lastTestOk === false ? "gold" : "success";
      return {
        tone,
        status: `On · ${short(primary.provider)} answers${backup}`,
        hint:
          primary.lastTestOk === false
            ? `The last test of the ${PROVIDER_META[primary.provider].label} key failed. Open Manage, run the test again or replace the key.`
            : undefined,
      };
    }
    if (providers.some((p) => p.enabled)) {
      return {
        tone: "gold",
        status: "Keys stored, nobody picked to answer",
        hint: "Open Manage and choose which provider answers the phone. Until then the voice service falls back to the ANTHROPIC_API_KEY on Render, if set.",
      };
    }
    return {
      tone: "steel",
      status: "Not set up",
      hint: "Store an Anthropic or OpenAI key under Manage, test it, then pick it as the one that answers. AI_KEYS_ENCRYPTION_KEY must be set on Vercel and on the Render voice service first.",
    };
  } catch {
    return {
      tone: "danger",
      status: "Not reachable",
      hint: "The ai_providers tables are missing or unreadable. Apply migration 0047_ai_providers.sql to the database, then reload.",
    };
  }
}

type Props = { searchParams: Promise<{ test?: string; provider?: string }> };

export default async function ConnectionsPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const [snap, ai] = await Promise.all([healthSnapshot(), phoneAnswering()]);
  const sentToday = snap.emailsSentToday;
  const c = snap.checks;

  const emailOk = Boolean(c.email.outboundConfigured);
  const emailFrom = Boolean(c.email.fromConfigured);
  const smsOk = Boolean(c.twilio.smsConfigured);
  const deskNumber = phoneWords(process.env.TWILIO_SMS_FROM);
  const stripeMode = String(c.stripe.mode ?? "unconfigured");
  const dbOk = Boolean(c.db.ok);
  const siteCanonical = Boolean(c.site.canonical);
  const sentryOk = Boolean(c.sentry.serverConfigured);
  const posthogOk = Boolean(c.posthog.configured);

  const rows: Row[] = [
    {
      key: "avinode",
      name: "Avinode",
      does: "Where you search aircraft and get operator prices",
      tone: "success",
      status: "Linked from the sidebar",
      action: { label: "Open ↗", href: AVINODE_URL, external: true },
    },
    {
      key: "email",
      name: "Email (Resend)",
      does: "Sends quotes, confirmations and receipts to clients",
      tone: emailOk ? (emailFrom ? "success" : "gold") : "danger",
      status: emailOk
        ? emailFrom
          ? `Working · ${sentToday ?? 0} sent today`
          : "Key set · sender address missing"
        : "Not set up",
      action: emailOk ? { label: "Send a test", test: true } : { label: "Open Resend ↗", href: "https://resend.com/", external: true },
      hint: emailOk
        ? "Set EMAIL_FROM to a verified sender, e.g. 'JetNine <dispatch@jetnine.com>' (verify the jetnine.com domain in Resend)."
        : "Without outbound email, dispatcher thread messages log to the server console instead of sending. Set RESEND_API_KEY (or POSTMARK_SERVER_TOKEN) and EMAIL_FROM on Vercel and verify the jetnine.com domain in the provider. Sign-in links and invites are sent by Supabase Auth, not this layer: point Supabase › Auth › SMTP at Resend so those are branded too.",
    },
    {
      key: "twilio",
      name: "Text messages (Twilio)",
      does: "Client texts and the desk phone number",
      tone: smsOk ? "success" : "danger",
      status: smsOk ? `Working${deskNumber ? ` · ${deskNumber}` : ""}` : "Not set up",
      action: { label: "Open Twilio ↗", href: "https://console.twilio.com/", external: true },
      hint: "Without keys, text messages from the desk log to the server console and the inbound webhook answers 503. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_SMS_FROM (E.164) on Vercel, and point the number's messaging webhook at /api/twilio/inbound. WhatsApp adds TWILIO_WHATSAPP_FROM.",
    },
    {
      key: "ai",
      name: "Phone answering (AI)",
      does: "Takes calls after hours and logs them as requests",
      tone: ai.tone,
      status: ai.status,
      action: { label: "Manage", href: "/admin/settings/ai" },
      hint: ai.hint,
    },
    {
      key: "stripe",
      name: "Payments (Stripe)",
      does: "Deposits, invoices and card top-ups",
      tone: c.stripe.configured ? (c.stripe.webhookConfigured ? (stripeMode === "live" ? "success" : "gold") : "gold") : "danger",
      status: c.stripe.configured
        ? c.stripe.webhookConfigured
          ? `Working · ${stripeMode === "live" ? "live" : "test"} mode`
          : `Key set · webhook missing (${stripeMode} mode)`
        : "Not set up",
      action: { label: "Open Stripe ↗", href: "https://dashboard.stripe.com/", external: true },
      hint: c.stripe.configured
        ? c.stripe.webhookConfigured
          ? "Test mode: real cards are not charged. Swap STRIPE_SECRET_KEY for the sk_live_ key and the matching STRIPE_WEBHOOK_SECRET when you are ready to take payments."
          : "Set STRIPE_WEBHOOK_SECRET (whsec_…) and register the webhook at /api/stripe/webhook with checkout.session.completed, payment_intent.payment_failed and charge.refunded. Without it, payments are taken but invoices never flip to paid."
        : "Without keys, Pay now on an invoice fails and card memberships cannot be bought. Set STRIPE_SECRET_KEY (sk_live_… or sk_test_…) and STRIPE_WEBHOOK_SECRET on Vercel, and register the webhook at /api/stripe/webhook.",
    },
    {
      key: "db",
      name: "Database and site",
      does: "Where everything is stored, and the address clients see",
      tone: dbOk ? (siteCanonical ? "success" : "gold") : "danger",
      status: dbOk
        ? `Working${typeof c.db.latencyMs === "number" ? ` · ${c.db.latencyMs} ms` : ""}${siteCanonical ? "" : ` · site address is ${String(c.site.host || "not set")}`}`
        : "Database not reachable",
      action: { label: "Open Vercel ↗", href: "https://vercel.com/", external: true },
      hint: dbOk
        ? "Links in emails and the Stripe return address use this host. At the domain switchover set NEXT_PUBLIC_SITE_URL=https://jetnine.com on Vercel (production) and attach jetnine.com and www to the project. Amber on a preview deploy is expected."
        : "Hard dependency: sign-in, quotes and every desk page fail without it. Check DATABASE_URL on Vercel (the Supabase transaction pooler URL, port 6543). If the database password was rotated, update DATABASE_URL and DIRECT_URL.",
    },
    {
      key: "observability",
      name: "Error tracking and analytics",
      does: "Sentry catches errors; PostHog counts what people do on the site",
      tone: sentryOk && posthogOk ? "success" : sentryOk || posthogOk ? "gold" : "danger",
      status:
        sentryOk && posthogOk
          ? "Working · Sentry and PostHog"
          : sentryOk
            ? "Sentry only · no analytics"
            : posthogOk
              ? "PostHog only · errors not tracked"
              : "Not set up",
      action: { label: "Open Sentry ↗", href: "https://sentry.io/", external: true },
      hint: [
        sentryOk ? null : "Without a Sentry DSN, errors only hit the server console and you find out when a client complains. Set SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN (Sentry › Project settings › Client keys).",
        posthogOk ? null : "Without PostHog there are no site analytics. Set NEXT_PUBLIC_POSTHOG_KEY=phc_… (PostHog › Project settings), and NEXT_PUBLIC_POSTHOG_HOST if not us.i.posthog.com.",
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];

  const testNote =
    sp.test === "sent"
      ? sp.provider === "logger"
        ? `No email provider is set, so the test was written to the server log instead of sent to ${user.email}.`
        : `Test email sent to ${user.email}. Give it a minute.`
      : sp.test === "failed"
        ? "The test email did not go out. Check the sender address and the Resend key."
        : null;

  return (
    <div>
      <DeskHeader title="Connections" lead="The outside services the desk relies on. Green means working." />

      {testNote ? (
        <p role="status" className={`mt-4 text-[14px] ${sp.test === "failed" ? "text-danger" : "text-bone-2"}`}>
          {testNote}
        </p>
      ) : null}

      <div className="card mt-6 overflow-hidden">
        {rows.map((r) => (
          <div key={r.key} className="border-b border-line-faint last:border-b-0">
            <div className="grid grid-cols-1 items-center gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_260px_auto] md:gap-6">
              <div className="min-w-0">
                <div className="text-[16px] font-medium text-bone">{r.name}</div>
                <div className="text-[14px] text-steel">{r.does}</div>
              </div>
              <DotSentence tone={r.tone} className="text-[14px] text-bone">
                {r.status}
              </DotSentence>
              <div className="text-[14px] md:text-right">
                {r.action === null ? null : "test" in r.action ? (
                  <form action={sendTestEmail}>
                    <button type="submit" className="text-link">
                      {r.action.label}
                    </button>
                  </form>
                ) : r.action.external ? (
                  <a href={r.action.href} target="_blank" rel="noreferrer" className="text-link">
                    {r.action.label}
                  </a>
                ) : (
                  <Link href={r.action.href} className="text-link">
                    {r.action.label}
                  </Link>
                )}
              </div>
            </div>
            {r.tone !== "success" && r.hint ? (
              <details className="px-6 pb-4 text-[14px]">
                <summary className="cursor-pointer text-bone-2 hover:text-bone">What to check</summary>
                <p className="mt-2 max-w-[72ch] text-steel">{r.hint}</p>
              </details>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[14px] text-steel">
        Something failed? Emails that didn’t send and calls that didn’t log appear under{" "}
        <Link href="/admin/messages?tab=problems" className="text-link">
          Messages › Problems
        </Link>
        , with a retry button.
      </p>
    </div>
  );
}
