// Pure helpers for the site's own emailed links (OPS-94). No imports beyond
// the session core, so `node --test src/lib/auth-tokens/core.test.mjs` loads it
// without a build. The database work lives in ./index.ts.
//
// Standard: OWASP Forgot Password and Authentication cheat sheets. The token
// is at least 128 bits from a CSPRNG (here 256), only its hash is stored, it
// expires quickly, it works once, and the link is built from a fixed origin,
// never from the Host header. NIST SP 800-63B for the out-of-band link.

import { hashToken, looksLikeToken, newToken } from "../session/core.mjs";

export { hashToken, looksLikeToken, newToken };

export const PURPOSES = ["signin", "reset", "invite"];

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** How long a link works, per purpose, in milliseconds. */
export const TTL_MS = { signin: 15 * MIN, reset: 30 * MIN, invite: 7 * DAY };

/** The origin links are built from when NEXT_PUBLIC_SITE_URL is not set. */
export const FALLBACK_ORIGIN = "https://jetnine.com";

export function isPurpose(p) {
  return typeof p === "string" && PURPOSES.includes(p);
}

/** When a token issued at `now` for `purpose` stops working. */
export function expiryFor(purpose, now = new Date()) {
  if (!isPurpose(purpose)) throw new Error("unknown purpose");
  return new Date(now.getTime() + TTL_MS[purpose]);
}

/** True when the row is neither spent nor past its expiry. */
export function isUsable(row, now = new Date()) {
  if (!row || row.usedAt) return false;
  const expires = new Date(row.expiresAt).getTime();
  if (!Number.isFinite(expires)) return false;
  return now.getTime() < expires;
}

/** A same-site path or the fallback. Mirrors src/lib/safe-next.ts. */
export function safeNextPath(raw) {
  if (!raw || typeof raw !== "string") return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/account";
  return raw;
}

/** The origin to build links from: the configured site URL, else the fallback. */
export function linkOrigin(configured) {
  const raw = typeof configured === "string" ? configured.trim() : "";
  if (!raw) return FALLBACK_ORIGIN;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return FALLBACK_ORIGIN;
    return u.origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

/**
 * The link emailed to a person: {origin}/auth/link?t=..&p=..&next=..
 * `next` is dropped unless it is a same-site path, and left out when it is
 * the default. Opening the link only shows a button: the token is spent by
 * the POST behind that button, so a mail scanner that fetches the link
 * cannot use it up.
 */
export function linkFor(origin, token, purpose, next) {
  if (!isPurpose(purpose)) throw new Error("unknown purpose");
  if (!looksLikeToken(token)) throw new Error("bad token");
  const url = new URL("/auth/link", linkOrigin(origin));
  url.searchParams.set("t", token);
  url.searchParams.set("p", purpose);
  const safe = safeNextPath(next);
  if (safe !== "/account") url.searchParams.set("next", safe);
  return url.toString();
}
