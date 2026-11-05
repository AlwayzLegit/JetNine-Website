import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { snapshot, type HealthSnapshot } from "@/lib/health";

// Health endpoint — single-call "is the deploy actually healthy?"
// signal for the smoke runner, uptime monitors, on-call dashboards.
//
// Hard requirement: DB reachable. Everything else (Stripe, email,
// Twilio, Sentry, PostHog) ships dark by design.
//
// Two views of the same snapshot:
//   - anyone:              ok, status, env, the names of failing checks
//   - Bearer CRON_SECRET:  the full snapshot (commit, region, per-check
//                          detail such as Stripe live/test mode)
//
// The full view is not secret material, but it maps which integrations a
// deployment runs and on which commit, which an anonymous caller has no
// need for. Staff see the same detail at /admin/health without HTTP.
//
// The status code is the same in both views (200 healthy, 503 not), so
// uptime monitors need no credential. /api/* is blocked in robots.txt.
//
// All probe logic lives in lib/health.ts.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicHealth = Pick<HealthSnapshot, "ok" | "status" | "env" | "timestamp"> & {
  /** Names of the checks reporting ok:false. Empty when healthy. */
  failing: string[];
};

function fullViewAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function publicView(full: HealthSnapshot): PublicHealth {
  return {
    ok: full.ok,
    status: full.status,
    env: full.env,
    failing: Object.entries(full.checks)
      .filter(([, check]) => check.ok === false)
      .map(([name]) => name),
    timestamp: full.timestamp,
  };
}

export async function GET(req: Request): Promise<NextResponse<HealthSnapshot | PublicHealth>> {
  const full = await snapshot();
  return NextResponse.json(fullViewAllowed(req) ? full : publicView(full), {
    status: full.ok ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
