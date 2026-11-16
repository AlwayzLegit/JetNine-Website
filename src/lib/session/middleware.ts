import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "./cookie-name.mjs";

// Everything outside these prefixes is public. /sign-in and /auth/* are
// intentionally NOT in here so the auth flow itself doesn't get gated.
const PROTECTED_PREFIXES = ["/account", "/admin"] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

/**
 * The request gate (OPS-91). It makes no database call and no call to
 * Supabase: it only sends a request for a protected page that carries no
 * session cookie to /sign-in. Whether the cookie is a live session, and
 * whether its user may see /admin, is decided by the layouts and actions
 * (requireUser, requireStaff, requireAdmin in src/lib/auth.ts).
 */
export function gateRequest(request: NextRequest) {
  // The desk API is Bearer-key only and Twilio's call webhooks are signed:
  // neither carries a session, so neither is gated or forwarded.
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/v1/") || path.startsWith("/api/voice/")) return NextResponse.next();

  // Auth resilience: a magic link sometimes lands its auth params on a page
  // other than the callback — e.g. when Supabase falls back to the Site URL
  // because the intended redirect isn't in its allowlist. Forward any stray
  // `?code=` (PKCE) or `?token_hash=&type=` (OTP) to /auth/callback so the
  // session is still established instead of the params being silently dropped
  // on the homepage. (The invite flow uses a URL hash, which the server can't
  // see — that path relies on the Supabase redirect-URL allowlist.)
  const sp = request.nextUrl.searchParams;
  const authCode = sp.get("code");
  const tokenHash = sp.get("token_hash");
  if ((authCode || tokenHash) && path !== "/auth/callback") {
    const cb = new URL("/auth/callback", request.url);
    if (authCode) cb.searchParams.set("code", authCode);
    if (tokenHash) {
      cb.searchParams.set("token_hash", tokenHash);
      const type = sp.get("type");
      if (type) cb.searchParams.set("type", type);
    }
    // Keep the page the link was aimed at: the password-reset email sends
    // members to /auth/reset?code=…, and they must come back here (not
    // /account) once the callback has signed them in. The homepage stays
    // the default-to-/account case; the callback sanitises `next` anyway.
    const nextParam = sp.get("next") ?? (path !== "/" ? path : null);
    if (nextParam) cb.searchParams.set("next", nextParam);
    return NextResponse.redirect(cb);
  }

  if (isProtected(path) && !request.cookies.get(COOKIE_NAME)?.value) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({ request });
}
