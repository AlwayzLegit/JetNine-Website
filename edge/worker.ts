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
// It also serves site media (blog hero images) from R2 at /media/<key>; see
// the "Media" section below.
//
// Keep this file free of imports: its size is the whole point.

type Fetcher = { fetch(request: Request): Promise<Response> };

type R2Object = {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
};

type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
};

type Env = {
  APP: Fetcher;
  APP_VERSION?: string;
  MEDIA?: R2Bucket;
  /** Supabase project origin the media used to live on, for the one-time copy. */
  MEDIA_LEGACY_ORIGIN?: string;
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
const SKIP = /^\/(?:api|admin|account|quote|request|sign-in|auth|_next|cdn-cgi|images|media)(?:\/|$)/;

/**
 * Exceptions to SKIP. The quote wizard's first step is its one indexable,
 * server-rendered page (an ISR page like the marketing pages; the draft
 * itself lives in the browser). Later steps stay uncached.
 */
const ALLOW = new Set(["/quote/mission"]);

function edgeCache(): EdgeCache | null {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
}

/** Cache key for this request, or null when it must always reach the app. */
export function cacheKey(request: Request, version: string | undefined): string | null {
  if (request.method !== "GET" || !version) return null;
  const url = new URL(request.url);
  // Query strings carry auth codes, campaign tags and filters; RSC and
  // prefetch requests return a different body for the same URL.
  if (url.search || (SKIP.test(url.pathname) && !ALLOW.has(url.pathname))) return null;
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

// ─── Media ──────────────────────────────────────────────────────────────
//
// Blog hero images live in the MEDIA bucket under blog/heroes/. They used to
// be hot-linked from Supabase Storage, which ran that project through its
// egress quota. Files uploaded before the move are copied across lazily: the
// first request for one that is not in the bucket fetches it from Supabase
// once, stores it, and every later request is served from here. Filenames
// carry a timestamp and are never overwritten, so responses are immutable.

/** Keep in sync with MEDIA_KEY in src/lib/media.ts. */
const MEDIA_KEY = /^\/media\/(blog\/heroes\/[A-Za-z0-9._-]+\.webp)$/;
const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

function mediaResponse(body: ReadableStream | ArrayBuffer, contentType: string, etag?: string): Response {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": MEDIA_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  });
  if (etag) headers.set("ETag", etag);
  return new Response(body, { headers });
}

function mediaNotFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

// Stand-ins for a hero that is neither in the bucket nor obtainable from
// Supabase (its storage is restricted until the quota resets). Rather than a
// broken image, the page gets one of the site's own library photos, picked by
// the file name so each post keeps the same one. Served with a short browser
// cache and not stored at the edge, so the real image takes over as soon as
// the copy succeeds.
const MEDIA_STAND_INS = [
  "cabin-interior",
  "city-night-window",
  "desert-city-approach",
  "fbo-lounge",
  "ramp-arrival",
  "turboprop-mountains",
  "winter-ramp",
];

async function mediaStandIn(request: Request, env: Env, key: string): Promise<Response> {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const file = MEDIA_STAND_INS[hash % MEDIA_STAND_INS.length];
  const url = new URL(request.url);
  url.pathname = `/images/blog/library/${file}.webp`;
  url.search = "";
  const res = await env.APP.fetch(new Request(url.href, { method: "GET" })).catch(() => null);
  if (!res?.ok || !res.body) return mediaNotFound();
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/webp",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Media-Stand-In": file,
    },
  });
}

async function serveMedia(request: Request, env: Env, ctx: ExecutionContext, key: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  if (!env.MEDIA) return mediaNotFound();

  const store = edgeCache();
  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  const cached = await store?.match(cacheUrl.href).catch(() => undefined);
  if (cached) return cached;

  let res: Response | null = null;
  const object = await env.MEDIA.get(key);
  if (object) {
    res = mediaResponse(object.body, object.httpMetadata?.contentType || "image/webp", object.httpEtag);
  } else if (env.MEDIA_LEGACY_ORIGIN) {
    // One-time copy out of Supabase Storage. A failure is never cached, so
    // the copy is retried on the next request.
    const legacy = await fetch(`${env.MEDIA_LEGACY_ORIGIN}/storage/v1/object/public/${key}`).catch(() => null);
    const type = legacy?.headers.get("content-type") ?? "";
    if (legacy?.ok && type.startsWith("image/")) {
      const bytes = await legacy.arrayBuffer();
      if (bytes.byteLength > 0 && bytes.byteLength <= MEDIA_MAX_BYTES) {
        ctx.waitUntil(
          env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } }).catch((err) =>
            console.error("[edge] media copy failed", key, err),
          ),
        );
        res = mediaResponse(bytes, type);
      }
    }
  }
  if (!res) return mediaStandIn(request, env, key);
  if (store && request.method === "GET") {
    ctx.waitUntil(store.put(cacheUrl.href, res.clone()).catch(() => undefined));
  }
  return res;
}

/**
 * The site has one public host, jetnine.com; www.jetnine.com is a custom
 * domain of this Worker only so that typed and legacy links land here. Both
 * used to answer 200 with the same HTML (canonical tags pointed at the apex),
 * so crawlers indexed every page twice and Semrush reported the site at
 * double its size. Send the www host to the apex with a 301, keeping path
 * and query (auth callbacks and campaign tags survive). Staging and other
 * hosts are untouched.
 */
export function canonicalHostRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (!url.hostname.startsWith("www.")) return null;
  url.hostname = url.hostname.slice(4);
  return new Response(null, {
    status: 301,
    headers: { Location: url.href, "Cache-Control": "public, max-age=86400" },
  });
}

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const redirect = canonicalHostRedirect(request);
  if (redirect) return redirect;

  const media = MEDIA_KEY.exec(new URL(request.url).pathname);
  if (media) return serveMedia(request, env, ctx, media[1]);

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
