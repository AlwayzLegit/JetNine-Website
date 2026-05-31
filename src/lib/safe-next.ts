/**
 * Constrain a `next` redirect target to a same-origin pathname. Anything
 * else falls back to `/account`.
 *
 * Why this is a security primitive, not a UX one: `next` flows from the
 * /sign-in form → Supabase magic link → /auth/callback's redirect. The
 * Node URL spec resolves `new URL("https://evil.com", base)` to
 * `https://evil.com/` (absolute URLs ignore the base), so without this
 * filter, an attacker who tricks a user into starting sign-in with
 * `?next=https://evil.com` lands the freshly-authenticated victim on
 * the attacker's page — a textbook post-auth phishing pivot.
 *
 * Both /sign-in and /auth/callback call this. Defense in depth: blocking
 * at the action layer keeps the magic link itself benign, and blocking
 * again at the callback prevents bypass if a future caller forwards an
 * unfiltered `next` elsewhere.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/account";
  // Must be server-relative. Reject absolute URLs (`https://…`),
  // protocol-relative (`//evil.com`), and backslash variants that some
  // browsers normalize to `/`.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/account";
  }
  return raw;
}
