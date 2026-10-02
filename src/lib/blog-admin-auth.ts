import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { authenticateApiKey, bearerToken } from "@/lib/api-auth";
import { parseToken, type Scope } from "@/lib/api-keys";
import type { Actor } from "@/domain/actor";
import type { Err, Result } from "@/domain/result";
import { err, ok } from "@/domain/result";

// Three ways into the legacy blog admin API (/api/admin/blog/*), checked
// in order. New callers should use /api/v1/blog/* instead (docs/API.md).
//
//   1. `Authorization: Bearer jn_live_…` — an API key minted in
//      Settings › API keys with the `content` permission. Same checks as
//      /api/v1 (revocation, expiry, rate limits).
//   2. `Authorization: Bearer <BLOG_ADMIN_API_KEY>` — the old single env
//      key. Disabled when the env var is unset, so a fresh deploy can never
//      be written to with an empty-string token. Audited as a legacy key.
//   3. A signed-in Supabase session whose users.role is admin/superadmin —
//      same gate as requireAdmin, but answering 401 instead of redirecting.

const LEGACY_SCOPES: ReadonlySet<Scope> = new Set<Scope>(["read", "content"]);

export async function authorizeBlogAdmin(req: Request, opts: { write?: boolean } = {}): Promise<Result<Actor>> {
  const token = bearerToken(req);
  if (token) {
    if (parseToken(token)) {
      const auth = await authenticateApiKey(req, opts);
      if (!auth.ok) return auth;
      if (!auth.value.scopes.has("content")) return err("forbidden", 'This key does not have the "content" permission.');
      return auth;
    }
    const key = process.env.BLOG_ADMIN_API_KEY;
    if (!key) return unauthorized();
    const provided = Buffer.from(token);
    const expected = Buffer.from(key);
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return ok({
        userId: null,
        role: "legacy",
        via: "api",
        scopes: LEGACY_SCOPES,
        key: { id: "legacy", name: "BLOG_ADMIN_API_KEY", supervised: false, legacy: true },
      });
    }
    return unauthorized();
  }

  const user = await getCurrentUser();
  if (user && ["admin", "superadmin"].includes(user.role)) {
    return ok({ userId: user.id, role: user.role, via: "session", scopes: LEGACY_SCOPES });
  }
  return unauthorized();
}

const unauthorized = (): Err => err("unauthorized", "Unauthorized.");
