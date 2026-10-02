import { after } from "next/server";
import { and, eq, isNull, lt, or, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api";
import { users } from "@/db/schema/users";
import { checkRateLimit } from "@/lib/rate-limit";
import { effectiveScopes, hashToken, hashesEqual, parseToken } from "@/lib/api-keys";
import type { Actor } from "@/domain/actor";
import { err, ok, type Result } from "@/domain/result";

/**
 * Authenticate an /api/v1 request from its `Authorization: Bearer` key.
 * Bearer only — no cookie sessions on the API, so there is no CSRF surface.
 *
 * Order: format check (no DB) → failed-auth limit per IP → key lookup →
 * revoked / expired / creator still on the desk → scopes capped by the
 * creator's role → per-key rate limit. Last-used is stamped after the
 * response, at most once a minute.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = new Set(["dispatcher", "admin", "superadmin"]);

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

async function authFailure(ip: string): Promise<Result<never>> {
  const limited = await checkRateLimit(`api:authfail:${ip}`, { max: 20, windowSeconds: 600 });
  if (!limited.ok) {
    return err("rate_limited", "Too many failed attempts. Try again later.", { retryAfterMs: limited.retryAfterMs });
  }
  return err("unauthorized", "Missing, invalid, expired or revoked API key.");
}

export async function authenticateApiKey(req: Request, opts: { write?: boolean } = {}): Promise<Result<Actor>> {
  const ip = clientIp(req);
  const parsed = parseToken(bearerToken(req));
  if (!parsed) return authFailure(ip);

  let row:
    | {
        id: string;
        name: string;
        tokenHash: string;
        scopes: string[];
        requiresApproval: boolean;
        rateLimitPerMin: number;
        expiresAt: Date | null;
        revokedAt: Date | null;
        lastUsedAt: Date | null;
        creatorId: string | null;
        creatorRole: string | null;
      }
    | undefined;
  try {
    [row] = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        tokenHash: apiKeys.tokenHash,
        scopes: apiKeys.scopes,
        requiresApproval: apiKeys.requiresApproval,
        rateLimitPerMin: apiKeys.rateLimitPerMin,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
        creatorId: users.id,
        creatorRole: users.role,
      })
      .from(apiKeys)
      .leftJoin(users, eq(users.id, apiKeys.createdBy))
      .where(eq(apiKeys.prefix, parsed.prefix))
      .limit(1);
  } catch (e) {
    console.error("[api-auth] key lookup failed", e);
    return err("unavailable", "The API is temporarily unavailable.");
  }

  if (!row || !hashesEqual(hashToken(parsed.token), row.tokenHash)) return authFailure(ip);
  if (row.revokedAt) return authFailure(ip);
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return authFailure(ip);
  if (!row.creatorId || !row.creatorRole || !STAFF_ROLES.has(row.creatorRole)) return authFailure(ip);

  const scopes = effectiveScopes(row.scopes, row.creatorRole);
  if (scopes.size === 0) return err("forbidden", "This key has no permissions left.");

  const perKey = await checkRateLimit(`api:key:${row.id}`, { max: row.rateLimitPerMin, windowSeconds: 60 });
  if (!perKey.ok) return err("rate_limited", "Rate limit reached for this key.", { retryAfterMs: perKey.retryAfterMs });
  if (opts.write) {
    const writes = await checkRateLimit(`api:keyw:${row.id}`, { max: 30, windowSeconds: 60 });
    if (!writes.ok) return err("rate_limited", "Write rate limit reached for this key.", { retryAfterMs: writes.retryAfterMs });
  }

  const stale = !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000;
  if (stale) {
    const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
    const keyId = row.id;
    after(async () => {
      try {
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date(), lastUsedIp: ip, lastUsedUa: ua })
          .where(
            and(
              eq(apiKeys.id, keyId),
              or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, dsql`now() - interval '60 seconds'`)),
            ),
          );
      } catch {
        // best-effort
      }
    });
  }

  const runHeader = req.headers.get("x-agent-run");
  return ok({
    userId: row.creatorId,
    role: row.creatorRole,
    via: "api",
    scopes,
    key: { id: row.id, name: row.name, supervised: row.requiresApproval },
    runId: runHeader && UUID_RE.test(runHeader) ? runHeader : undefined,
  });
}
