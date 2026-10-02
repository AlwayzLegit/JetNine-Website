import { after, NextResponse } from "next/server";
import { db } from "@/db";
import { apiRequests } from "@/db/schema/api";
import { clientIp } from "@/lib/api-auth";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import type { Actor } from "@/domain/actor";
import type { Err } from "@/domain/result";

/**
 * Adapter that keeps the legacy /api/admin/blog/* response shapes
 * (`{ ok, ... }` / `{ ok: false, error: "text" }`, 400 for bad input)
 * while the logic lives in src/domain/blog. Every response carries
 * Deprecation + Link headers pointing at the /api/v1 successor, and key
 * calls are logged to api_requests (the env key as `legacy`).
 */

type Handler = (actor: Actor, req: Request, params: Record<string, string>) => Promise<NextResponse>;

const LEGACY_STATUS: Partial<Record<Err["code"], number>> = { invalid: 400 };

export function legacyError(e: Err): NextResponse {
  const details = (e.details ?? {}) as Record<string, unknown>;
  const status =
    typeof details.status === "number" && details.status >= 400 ? details.status : LEGACY_STATUS[e.code] ?? statusFor(e.code);
  return NextResponse.json(
    { ok: false, error: e.error, ...(details.library ? { library: details.library } : {}) },
    { status },
  );
}

function statusFor(code: Err["code"]): number {
  return { unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, invalid: 400, rate_limited: 429, unavailable: 503, internal: 500 }[code];
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }) };
  }
}

export function legacyRoute(route: string, successor: string, fn: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const started = Date.now();
    const auth = await authorizeBlogAdmin(req, { write: req.method !== "GET" });
    let res: NextResponse;
    if (!auth.ok) {
      res = legacyError(auth);
    } else {
      try {
        res = await fn(auth.value, req, ((await ctx.params) ?? {}) as Record<string, string>);
      } catch (e) {
        console.error(`[api/admin/blog] ${req.method} ${route} failed`, e);
        res = NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
      }
    }
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Deprecation", "true");
    res.headers.set("Link", `</api/v1${successor}>; rel="successor-version"`);

    const key = auth.ok ? auth.value.key : undefined;
    if (key) {
      const row = {
        keyId: key.legacy ? null : key.id,
        legacy: Boolean(key.legacy),
        method: req.method,
        route: `/api/admin/blog${route}`,
        status: res.status,
        errorCode: res.status >= 400 ? String(res.status) : null,
        durationMs: Date.now() - started,
        ip: clientIp(req),
        ua: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        runId: auth.ok ? (auth.value.runId ?? null) : null,
      };
      after(async () => {
        try {
          await db.insert(apiRequests).values(row);
        } catch {
          // best-effort
        }
      });
    }
    return res;
  };
}
