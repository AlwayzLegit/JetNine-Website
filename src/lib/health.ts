// Health-check probes shared between /api/health (public JSON endpoint)
// and /admin/health (dispatcher-facing dashboard).
//
// Each check returns a stable shape that's safe to render: no secrets,
// no DB content, no user data. Two checks do I/O: the DB probe and the
// Supabase Auth probe (sign-in's provider). Everything else is env-var presence.

import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/db";
import { commitSha, deployEnv, deployRegion, platformBaseUrl } from "@/lib/deploy-env";
import { probeSupabaseAuth } from "@/lib/auth-probe.mjs";

export type CheckResult = { ok: boolean } & Record<string, unknown>;

export type HealthSnapshot = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  env: string;
  region: string;
  sha: string;
  checks: {
    db: CheckResult;
    auth: CheckResult;
    site: CheckResult;
    stripe: CheckResult;
    email: CheckResult;
    twilio: CheckResult;
    sentry: CheckResult;
    posthog: CheckResult;
    ai: CheckResult;
  };
  timestamp: string;
};

export async function checkDb(): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    await db.execute(drizzleSql`select 1 as ok`);
    return { ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    // Log to stderr so Vercel runtime logs surface the cause without
    // leaking it in the public JSON. Keep the response body sanitized
    // — error name only.
    const e = err as { name?: string; code?: string; message?: string; cause?: unknown };
    console.error("[health] db probe failed", {
      name: e.name,
      code: e.code,
      message: e.message?.slice(0, 300),
      cause:
        e.cause instanceof Error
          ? { name: e.cause.name, message: e.cause.message?.slice(0, 300) }
          : undefined,
    });
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.name : "unknown",
    };
  }
}

/**
 * Supabase Auth, asked the way sign-in asks it (OPS-90). On 2026-11-16 the
 * project was restricted for a day and every sign-in failed while this
 * endpoint said "healthy", because the database probe does not go through
 * Supabase's API. A failure makes the status "degraded" and puts "auth" in the
 * public failing list. It never changes `ok` or the HTTP code: a 503 here
 * would fail every deploy smoke test while the project is down, which would
 * block the fix. Not configured (no URL or key) counts as ok.
 */
export async function checkAuth(): Promise<CheckResult> {
  const r = await probeSupabaseAuth({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!r.ok) console.error("[health] auth probe failed", { httpStatus: r.httpStatus, detail: r.detail });
  return { ok: r.ok, configured: r.configured, httpStatus: r.httpStatus, detail: r.detail };
}

/**
 * Domain / base-URL check. `ok` is intentionally always true (an
 * informational row, like email/twilio) so it never trips the public
 * /api/health `ok===false` smoke filter on a preview deploy. The
 * /admin/health row decides green/amber from the sub-booleans.
 *
 * Mirrors getBaseUrl()'s precedence (NEXT_PUBLIC_SITE_URL → Vercel prod
 * URL → Vercel URL → localhost) without importing the server-only stripe
 * module. The host this resolves to is where Stripe checkout redirects
 * and the links inside dispatch emails actually point — so if it isn't
 * jetnine.com in production, members paying an invoice get bounced to the
 * *.vercel.app host. Set NEXT_PUBLIC_SITE_URL=https://jetnine.com at the
 * domain switchover to close that.
 */
export function checkSite(): CheckResult {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  const base = explicit || platformBaseUrl() || "http://localhost:3000";
  let host = "";
  try {
    host = new URL(base).host;
  } catch {
    host = "";
  }
  return {
    ok: true,
    siteUrlConfigured: Boolean(explicit),
    canonical: host === "jetnine.com",
    host,
  };
}

export function checkStripe(): CheckResult {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhook = process.env.STRIPE_WEBHOOK_SECRET;
  return {
    ok: Boolean(secret && webhook),
    configured: Boolean(secret),
    webhookConfigured: Boolean(webhook),
    mode: secret?.startsWith("sk_live_")
      ? "live"
      : secret?.startsWith("sk_test_")
        ? "test"
        : "unconfigured",
  };
}

export function checkEmail(): CheckResult {
  const resend = Boolean(process.env.RESEND_API_KEY);
  const postmark = Boolean(process.env.POSTMARK_SERVER_TOKEN);
  const inboundSecret = Boolean(process.env.INBOUND_EMAIL_SECRET);
  const from = Boolean(process.env.EMAIL_FROM);
  const provider = resend ? "resend" : postmark ? "postmark" : "logger";
  return {
    ok: true,
    provider,
    outboundConfigured: resend || postmark,
    // Inbound is Postmark-only today.
    inboundConfigured: inboundSecret && postmark,
    fromConfigured: from,
  };
}

export function checkTwilio(): CheckResult {
  const sid = Boolean(process.env.TWILIO_ACCOUNT_SID);
  const token = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const smsFrom = Boolean(process.env.TWILIO_SMS_FROM);
  const whatsappFrom = Boolean(process.env.TWILIO_WHATSAPP_FROM);
  return {
    ok: true,
    smsConfigured: sid && token && smsFrom,
    whatsappConfigured: sid && token && whatsappFrom,
  };
}

export function checkSentry(): CheckResult {
  const browser = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const server = Boolean(process.env.SENTRY_DSN);
  return {
    ok: true,
    browserConfigured: browser,
    serverConfigured: server,
  };
}

/**
 * AI provider key storage. Informational: `ok` stays true so a missing
 * encryption key never flips the public status; /admin/settings/ai shows
 * the actual provider rows and their last test.
 */
export function checkAi(): CheckResult {
  const raw = process.env.AI_KEYS_ENCRYPTION_KEY ?? "";
  return {
    ok: true,
    keyStorageConfigured: /^[0-9a-f]{64}$/i.test(raw),
  };
}

export function checkPosthog(): CheckResult {
  return {
    ok: true,
    configured: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  };
}

export async function snapshot(): Promise<HealthSnapshot> {
  const env = deployEnv();
  const region = deployRegion();
  const sha = commitSha().slice(0, 12) || "unknown";

  const [db, auth, stripe, email, twilio, sentry, posthog] = await Promise.all([
    checkDb(),
    checkAuth(),
    Promise.resolve(checkStripe()),
    Promise.resolve(checkEmail()),
    Promise.resolve(checkTwilio()),
    Promise.resolve(checkSentry()),
    Promise.resolve(checkPosthog()),
  ]);

  const checks = { db, auth, site: checkSite(), stripe, email, twilio, sentry, posthog, ai: checkAi() };
  const ok = db.ok;
  const allOptionalsConfigured =
    Boolean(stripe.configured) &&
    Boolean(email.outboundConfigured) &&
    Boolean(twilio.smsConfigured) &&
    Boolean(sentry.serverConfigured);
  const status: HealthSnapshot["status"] = !ok
    ? "unhealthy"
    : auth.ok && allOptionalsConfigured
      ? "healthy"
      : "degraded";

  return {
    ok,
    status,
    env,
    region,
    sha,
    checks,
    timestamp: new Date().toISOString(),
  };
}
