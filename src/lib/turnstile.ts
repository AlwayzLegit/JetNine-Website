// Cloudflare Turnstile on the public forms (contact, quote, empty-leg
// watchlist). Off until BOTH keys are set:
//
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  build-time, public (renders the widget)
//   TURNSTILE_SECRET_KEY            Worker secret (verifies the token)
//
// With either one missing every check passes and no widget renders, so the
// forms behave exactly as they did before. The honeypot fields and per-IP
// rate limits stay in place either way; this is one more layer, not a
// replacement.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

/** Name of the form field / argument carrying the widget's token. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Error code the form actions return when the check fails. */
export const TURNSTILE_FAILED = "VERIFICATION_FAILED";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * True when the submission may proceed.
 *
 * Fails closed on a missing or rejected token. Fails OPEN when Cloudflare's
 * verify endpoint cannot be reached or answers nonsense: a lost lead costs
 * more than a missed bot, and the rate limiter still stands behind this.
 *
 * A token is single-use, so call this last, after validation and rate
 * limiting, or a typo in the form burns the visitor's token.
 */
export async function passesTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY as string, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    const json = (await res.json()) as { success?: unknown; "error-codes"?: unknown };
    if (typeof json.success !== "boolean") {
      console.error("[turnstile] unexpected verify response; allowing submission", res.status);
      return true;
    }
    if (!json.success) console.warn("[turnstile] token rejected", json["error-codes"]);
    return json.success;
  } catch (error) {
    console.error("[turnstile] verify request failed; allowing submission", error);
    return true;
  }
}
