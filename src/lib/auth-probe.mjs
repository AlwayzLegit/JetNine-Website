// Not used by /api/health since OPS-121. Removed with the Supabase clean-up (OPS-93).
// Is Supabase Auth answering? (OPS-90.) No imports, so `node --test` loads it.
//
// The project sheet's sign-in goes through Supabase's API. On 2026-11-16 that
// API answered 402 for a whole day while /api/health, which only reads the
// database, said "healthy". This probe asks the same API sign-in uses, with
// the public anon key the browser already holds, and returns a fixed shape:
// never a response body, never a header, never the key.

/**
 * @param {{ url?: string, anonKey?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} opts
 * @returns {Promise<{ ok: boolean, configured: boolean, httpStatus: number | null, detail: "HTTP 200" | `HTTP ${number}` | "no response" | "not configured" }>}
 */
export async function probeSupabaseAuth({ url, anonKey, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  if (!url || !anonKey) return { ok: true, configured: false, httpStatus: null, detail: "not configured" };

  let target;
  try {
    target = new URL("/auth/v1/health", url).toString();
  } catch {
    return { ok: true, configured: false, httpStatus: null, detail: "not configured" };
  }

  try {
    const res = await fetchImpl(target, {
      method: "GET",
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Drain the body without reading it into the answer.
    await res.text().catch(() => "");
    return { ok: res.status === 200, configured: true, httpStatus: res.status, detail: `HTTP ${res.status}` };
  } catch {
    return { ok: false, configured: true, httpStatus: null, detail: "no response" };
  }
}
