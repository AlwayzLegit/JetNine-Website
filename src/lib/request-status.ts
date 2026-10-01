// The "Your request" status page — the guest-readable page a quote lands on
// after submit and that every customer email links to. Keyed by the quote's
// status_token (24 random bytes, hex), never by its id or code.

export const STATUS_TOKEN_RE = /^[0-9a-f]{48}$/;

export function statusPath(token: string): string {
  return `/request/${token}`;
}

export function statusUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  return `${base}${statusPath(token)}`;
}
