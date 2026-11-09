// Edge cache Worker: the small Worker that owns jetnine.com and sits in front
// of the Next app (`jetnine-web`, reached through the APP service binding).
//
// Why it exists. The app is a ~34 MB script. On a low-traffic site Cloudflare
// has to load it into a fresh isolate for a large share of requests, and that
// load alone took one to three seconds before a single line ran, even for a
// page Next already had rendered and cached. This Worker is a few kilobytes,
// so it starts in milliseconds; it answers public pages from the data
// centre's cache and only wakes the app when it has to.
//
// What is cached. Anonymous GET requests for documents the app itself marks
// as shared (`s-maxage`, no cookie set): the ISR marketing pages. A copy is
// served as-is for up to five minutes (less if the page's own revalidate
// window is shorter), then keeps being served for a day while a background
// request refreshes it, so an edit shows within minutes and no visitor waits
// on a render. Everything else (API routes, the quote flow, the account and
// admin areas, signed-in visitors, RSC navigations) passes straight through.
//
// Entries are keyed by APP_VERSION, which each release sets to the commit it
// deployed (see DEPLOY.md). A release therefore starts from an empty cache
// and never serves HTML that points at the previous build's files.
//
// Keep this file free of imports: its size is the whole point.

type Fetcher = { fetch(request: Request): Promise<Response> };

type Env = {
  APP: Fetcher;
  APP_VERSION?: string;
};

type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

type EdgeCache = {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
};

const FRESH_MAX_S = 300;
const KEEP_S = 86_400;
const STORED_AT = "x-edge-stored-at";
const FRESH_FOR = "x-edge-fresh-for";
const ORIGIN_CC = "x-edge-origin-cache-control";

/** Paths that are personal, transactional or not pages at all. */
const SKIP = /^\/(?:api|admin|account|quote|request|sign-in|auth|_next|cdn-cgi|images)(?:\/|$)/;

function edgeCache(): EdgeCache | null {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
}

/** Cache key for this request, or null when it must always reach the app. */
export function cacheKey(request: Request, version: string | undefined): string | null {
  if (request.method !== "GET" || !version) return null;
  const url = new URL(request.url);
  // Query strings carry auth codes, campaign tags and filters; RSC and
  // prefetch requests return a different body for the same URL.
  if (url.search || SKIP.test(url.pathname)) return null;
  const h = request.headers;
  if (h.has("rsc") || h.has("next-router-prefetch") || h.has("next-router-state-tree")) return null;
  if (h.has("authorization") || h.has("range")) return null;
  // A Supabase session cookie means the app's middleware may need to refresh it.
  if (/(?:^|;\s*)sb-/.test(h.get("cookie") ?? "")) return null;
  return `https://edge-cache.invalid/${encodeURIComponent(version)}/${url.host}${url.pathname}`;
}

/** Seconds this response may be reused without revalidating; 0 = don't store. */
export function sharedMaxAge(res: Response): number {
  if (res.status !== 200 || res.headers.has("set-cookie")) return 0;
  if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return 0;
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  if (/private|no-store|no-cache/.test(cc)) return 0;
  const m = /s-maxage=(\d+)/.exec(cc);
  return m ? Number(m[1]) : 0;
}

/** Asks the app and, when the page is shareable, stores a copy. */
async function fetchAndStore(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
  store: EdgeCache,
): Promise<{ res: Response; stored: boolean }> {
  const res = await env.APP.fetch(request);
  const maxAge = sharedMaxAge(res);
  if (maxAge === 0 || !res.body) return { res, stored: false };
  const [forClient, forCache] = res.body.tee();
  const copy = new Response(forCache, res);
  copy.headers.set(ORIGIN_CC, res.headers.get("cache-control") ?? "");
  copy.headers.set(STORED_AT, String(Date.now()));
  copy.headers.set(FRESH_FOR, String(Math.max(1, Math.min(maxAge, FRESH_MAX_S))));
  copy.headers.set("Cache-Control", `public, s-maxage=${KEEP_S}`);
  ctx.waitUntil(store.put(key, copy).catch((err) => console.error("[edge] put failed", err)));
  return { res: new Response(forClient, res), stored: true };
}

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const store = edgeCache();
  const key = store ? cacheKey(request, env.APP_VERSION) : null;
  if (!store || !key) return env.APP.fetch(request);

  // A cache fault must never take a page down: fall through to the app.
  const hit = await store.match(key).catch(() => undefined);
  if (!hit) {
    // The original request is passed on untouched; a clone goes to the cache path.
    const { res, stored } = await fetchAndStore(request, env, ctx, key, store);
    if (stored) res.headers.set("x-edge-cache", "MISS");
    return res;
  }

  const ageS = (Date.now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000;
  const stale = ageS > Number(hit.headers.get(FRESH_FOR) ?? 0);
  if (stale) {
    ctx.waitUntil(
      fetchAndStore(request, env, ctx, key, store)
        .then(({ res }) => res.body?.cancel())
        .catch((err) => console.error("[edge] refresh failed", err)),
    );
  }
  const out = new Response(hit.body, hit);
  out.headers.set("Cache-Control", hit.headers.get(ORIGIN_CC) || "private, no-cache");
  out.headers.delete(ORIGIN_CC);
  out.headers.delete(STORED_AT);
  out.headers.delete(FRESH_FOR);
  out.headers.set("x-edge-cache", stale ? "STALE" : "HIT");
  return out;
}

const worker = { fetch: serve };
export default worker;
