// Health-check probes shared between /api/health (public JSON endpoint)
// and /admin/health (dispatcher-facing dashboard).
//
// Each check returns a stable shape that's safe to render: no secrets,
// no DB content, no user data. The hardest one is the DB probe — that's
// the only check that does any I/O. Everything else is env-var presence.

import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/db";

export type CheckResult = { ok: boolean } & Record<string, unknown>;

export type HealthSnapshot = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  env: string;
  region: string;
  sha: string;
  checks: {
    db: CheckResult;
    stripe: CheckResult;
    email: CheckResult;
    twilio: CheckResult;
    sentry: CheckResult;
    plausible: CheckResult;
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

export function checkPlausible(): CheckResult {
  return {
    ok: true,
    configured: Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
  };
}

export async function snapshot(): Promise<HealthSnapshot> {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const region = process.env.VERCEL_REGION ?? "local";
  const sha =
    (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "")
      .slice(0, 12) || "unknown";

  const [db, stripe, email, twilio, sentry, plausible] = await Promise.all([
    checkDb(),
    Promise.resolve(checkStripe()),
    Promise.resolve(checkEmail()),
    Promise.resolve(checkTwilio()),
    Promise.resolve(checkSentry()),
    Promise.resolve(checkPlausible()),
  ]);

  const checks = { db, stripe, email, twilio, sentry, plausible };
  const ok = db.ok;
  const allOptionalsConfigured =
    Boolean(stripe.configured) &&
    Boolean(email.outboundConfigured) &&
    Boolean(twilio.smsConfigured) &&
    Boolean(sentry.serverConfigured);
  const status: HealthSnapshot["status"] = !ok
    ? "unhealthy"
    : allOptionalsConfigured
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
