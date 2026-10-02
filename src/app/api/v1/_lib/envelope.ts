import { NextResponse } from "next/server";
import { HTTP_STATUS, type Err } from "@/domain/result";

/**
 * /api/v1 response envelope.
 *   success  { ok: true, data, meta? }
 *   pending  202 { ok: true, status: "pending_approval", data: { approvalId, summary, url } }
 *   error    { ok: false, error: { code, message, details? } }
 * Every response is no-store and carries X-Request-Id. No CORS headers:
 * the API is for servers and scheduled tasks, not browsers.
 */

export function baseHeaders(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    "X-Robots-Tag": "noindex",
  };
}

export function success(requestId: string, data: unknown, status = 200, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(meta ? { ok: true, data, meta } : { ok: true, data }, {
    status,
    headers: baseHeaders(requestId),
  });
}

export function failure(requestId: string, e: Err, statusOverride?: number): NextResponse {
  const details = e.details as Record<string, unknown> | undefined;
  const fromDetails = typeof details?.status === "number" && details.status >= 400 && details.status < 600 ? details.status : undefined;
  const status = statusOverride ?? fromDetails ?? HTTP_STATUS[e.code];
  const headers: Record<string, string> = baseHeaders(requestId);
  const retry = typeof details?.retryAfterMs === "number" ? Math.ceil(details.retryAfterMs / 1000) : undefined;
  if (e.code === "rate_limited" && retry !== undefined) headers["Retry-After"] = String(Math.max(retry, 1));
  let publicDetails: unknown = details;
  if (details && ("status" in details || "retryAfterMs" in details || "keyId" in details)) {
    const { status: _s, retryAfterMs: _r, keyId: _k, ...rest } = details;
    void _s;
    void _r;
    void _k;
    publicDetails = Object.keys(rest).length ? rest : undefined;
  }
  return NextResponse.json(
    { ok: false, error: { code: e.code, message: e.error, ...(publicDetails !== undefined ? { details: publicDetails } : {}) } },
    { status, headers },
  );
}
