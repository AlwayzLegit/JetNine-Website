import { NextResponse } from "next/server";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/db";

// Health endpoint — single-call "is the deploy actually healthy?"
// signal for the smoke runner + uptime monitors + on-call dashboards.
//
// Hard requirement: DB reachable. Everything else (Stripe, email,
// Twilio, Sentry) ships dark by design, so we report `configured: bool`
// without making external network calls (slow, and a transient provider
// blip shouldn't fail the health check — that's what Sentry is for).
//
// Public endpoint by design. Returns no secrets, no DB content, no
// user data — only boolean configuration + a single SELECT 1 timing.
// /api/* is blocked in robots.txt so it doesn't get indexed.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = { ok: boolean } & Record<string, unknown>;

type HealthResponse = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  // Vercel-injected env useful for ops; falls back to "unknown" so
  // local dev still returns sane JSON.
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

async function checkDb(): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    // SELECT 1 is the universal "connection works" probe. We don't
    // touch any real table because RLS + service-role considerations
    // would muddy the signal — connectivity is what matters here.
    await db.execute(drizzleSql`select 1 as ok`);
    return { ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      // Keep the error message short and generic — don't leak
      // connection strings or pg error codes to the public response.
      error: err instanceof Error ? err.name : "unknown",
    };
  }
}

function checkStripe(): CheckResult {
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

function checkEmail(): CheckResult {
  const resend = Boolean(process.env.RESEND_API_KEY);
  const postmark = Boolean(process.env.POSTMARK_SERVER_TOKEN);
  const inboundSecret = Boolean(process.env.INBOUND_EMAIL_SECRET);
  const from = Boolean(process.env.EMAIL_FROM);
  const provider = resend ? "resend" : postmark ? "postmark" : "logger";
  return {
    ok: true, // ships dark — never a hard failure
    provider,
    outboundConfigured: resend || postmark,
    inboundConfigured: inboundSecret && postmark, // Postmark only for inbound today
    fromConfigured: from,
  };
}

function checkTwilio(): CheckResult {
  const sid = Boolean(process.env.TWILIO_ACCOUNT_SID);
  const token = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const smsFrom = Boolean(process.env.TWILIO_SMS_FROM);
  const whatsappFrom = Boolean(process.env.TWILIO_WHATSAPP_FROM);
  return {
    ok: true, // ships dark
    smsConfigured: sid && token && smsFrom,
    whatsappConfigured: sid && token && whatsappFrom,
  };
}

function checkSentry(): CheckResult {
  const browser = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const server = Boolean(process.env.SENTRY_DSN);
  return {
    ok: true, // ships dark
    browserConfigured: browser,
    serverConfigured: server,
  };
}

function checkPlausible(): CheckResult {
  return {
    ok: true,
    configured: Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
  };
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  // Vercel-injected env vars. Fall back to "unknown" so local + CI
  // requests get sane JSON. Git SHA is short-form for log readability.
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

  // Hard dependency: db. Everything else is informational.
  const ok = db.ok;
  // Degraded if any of the optional integrations are unconfigured.
  // Healthy only when every external is wired up.
  const allOptionalsConfigured =
    Boolean(stripe.configured) &&
    Boolean(email.outboundConfigured) &&
    Boolean(twilio.smsConfigured) &&
    Boolean(sentry.serverConfigured);
  const status: HealthResponse["status"] = !ok
    ? "unhealthy"
    : allOptionalsConfigured
      ? "healthy"
      : "degraded";

  const body: HealthResponse = {
    ok,
    status,
    env,
    region,
    sha,
    checks,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
