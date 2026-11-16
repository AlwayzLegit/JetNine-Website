// Pure helpers for the site's own sessions (OPS-91). No imports beyond
// node:crypto, so `node --test src/lib/session/core.test.mjs` loads it
// without a build. The database and cookie work lives in ./index.ts.
//
// Standard: OWASP Session Management Cheat Sheet. A session id is at least
// 128 bits from a CSPRNG, only its hash is stored, the cookie is HttpOnly,
// Secure, SameSite=Lax, Path=/ and carries the __Host- prefix, and a session
// ends on an absolute timeout, an idle timeout, sign-out and password change.

import { createHash, randomBytes } from "node:crypto";

export { COOKIE_NAME } from "./cookie-name.mjs";
/** A session lives at most 30 days from sign-in. */
export const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
/** ...and ends after 7 days without a request. */
export const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** last_seen_at is written at most once per 5 minutes. */
export const TOUCH_MS = 5 * 60 * 1000;

/** 32 random bytes (256 bits), base64url. This is the cookie value. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex of the token. The only form stored in the database. */
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/** A token that could have come from newToken(): 43 base64url characters. */
export function looksLikeToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Options for the session cookie. maxAge is in seconds. */
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  };
}

/** True when the session is past its absolute or its idle limit. */
export function isExpired(row, now = new Date()) {
  const t = now.getTime();
  const expires = new Date(row.expiresAt).getTime();
  const lastSeen = new Date(row.lastSeenAt).getTime();
  if (!Number.isFinite(expires) || !Number.isFinite(lastSeen)) return true;
  if (t >= expires) return true;
  if (t - lastSeen >= IDLE_MS) return true;
  return false;
}

/** True when last_seen_at is old enough to be worth writing again. */
export function shouldTouch(row, now = new Date()) {
  const lastSeen = new Date(row.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeen)) return true;
  return now.getTime() - lastSeen >= TOUCH_MS;
}

/** The expiry to store for a session created at `now`. */
export function expiryFrom(now = new Date()) {
  return new Date(now.getTime() + ABSOLUTE_MS);
}
