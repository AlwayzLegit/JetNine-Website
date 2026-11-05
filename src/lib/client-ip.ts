// The visitor's IP for rate limiting and audit rows. Cloudflare sets
// cf-connecting-ip on every request; x-forwarded-for (Vercel, local proxies)
// and x-real-ip are fallbacks. Returns null when none is present so callers
// choose their own placeholder.
export function clientIpFrom(headers: Pick<Headers, "get">): string | null {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    null
  );
}
