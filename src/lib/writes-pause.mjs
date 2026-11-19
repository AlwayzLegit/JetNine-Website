// The write pause for the database cutover (OPS-205, part of OPS-93). A plain
// module, like src/db/target.mjs, so `node --test` loads it without a build.
//
// While the Worker variable WRITES_PAUSED is exactly "cutover", the app Worker
// (worker.ts) answers every request that writes with 503 and a Retry-After
// header, and skips its cron jobs. Reads keep working. Unset means off: nothing
// here changes anything until the cutover row (OPS-206) sets it, and the flip
// to D1 removes it in the same change. The standard is a write freeze
// (maintenance mode): 503 Service Unavailable with Retry-After (RFC 9110
// sections 15.6.4 and 10.2.3), so a browser, Stripe or another sender tries again later.

/** The only value of WRITES_PAUSED that turns the pause on. Compared exactly: no trim, no case folding. */
export const PAUSE_VALUE = "cutover";

/** Seconds a sender is told to wait before it tries again. */
export const RETRY_AFTER_SECONDS = 600;

/** The header added to every response while the pause is on, so a reader can see it from outside. */
export const PAUSE_HEADER = "x-jetnine-writes";

// GET and HEAD that change data anyway: they consume a one time sign-in token and start a session.
const WRITING_GET_PATHS = ["/auth/callback", "/auth/link"];

// GET and HEAD under these prefixes write: API key last use and the request log (/api/v1), the admin
// API, and the cron routes. Page renders also touch a session row or a rate limit counter; a write of
// that kind lost around the flip is harmless, so pages are not blocked.
const WRITING_GET_PREFIXES = ["/api/v1/", "/api/admin/", "/api/cron/"];

/**
 * @param {unknown} value the WRITES_PAUSED setting
 * @returns {boolean} true only for exactly "cutover"
 */
export function isPaused(value) {
  return value === PAUSE_VALUE;
}

/**
 * @param {string} method the request method
 * @param {string} pathname the request path
 * @returns {boolean} true when a paused site must not run this request
 */
export function blocksRequest(method, pathname) {
  const m = String(method).toUpperCase();
  if (m === "OPTIONS") return false;
  if (m !== "GET" && m !== "HEAD") return true;
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (WRITING_GET_PATHS.includes(path)) return true;
  return WRITING_GET_PREFIXES.some((p) => pathname.startsWith(p) || `${path}/` === p);
}

const PAUSED_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  "<title>JetNine</title></head><body>" +
  "<p>JetNine is moving to a new system. Requests are paused for a few minutes. Please try again shortly.</p>" +
  "</body></html>";

/**
 * @param {string} pathname the request path, to pick JSON for /api/ and a short page otherwise
 * @returns {Response} the 503 a paused site answers with
 */
export function pausedResponse(pathname) {
  const isApi = pathname.startsWith("/api/");
  const headers = {
    "Retry-After": String(RETRY_AFTER_SECONDS),
    "Cache-Control": "no-store",
    [PAUSE_HEADER]: "paused",
    "Content-Type": isApi ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
  };
  const body = isApi ? JSON.stringify({ error: "paused", retryAfterSeconds: RETRY_AFTER_SECONDS }) : PAUSED_HTML;
  return new Response(body, { status: 503, headers });
}
