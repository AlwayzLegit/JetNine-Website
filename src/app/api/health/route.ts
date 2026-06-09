import { NextResponse } from "next/server";
import { snapshot, type HealthSnapshot } from "@/lib/health";

// Health endpoint — single-call "is the deploy actually healthy?"
// signal for the smoke runner, uptime monitors, on-call dashboards.
//
// Hard requirement: DB reachable. Everything else (Stripe, email,
// Twilio, Sentry, PostHog) ships dark by design.
//
// Public endpoint by design. Returns no secrets, no DB content, no
// user data — only boolean configuration + a single SELECT 1 timing.
// /api/* is blocked in robots.txt so it doesn't get indexed.
//
// All probe logic lives in lib/health.ts so the admin /admin/health
// dashboard can render the same snapshot without going over HTTP.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<HealthSnapshot>> {
  const body = await snapshot();
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
