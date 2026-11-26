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
// Second tier (OPS-332). The data centre's cache is per data centre, so the
// first visit to a page in a data centre that has not served it since the
// last release waited 1.5 to 4.8 s for the app to load. With EDGE_TIER set to
// "r2", a copy is also kept in one R2 object per page (edge-tier/<host><path>
// in the MEDIA bucket, the version inside the object), and a data centre that
// misses reads that object before it wakes the app. Answers from it carry
// x-edge-cache: TIER. Every answer from a copy carries x-edge-age. Setting
// EDGE_TIER to an empty string turns the tier off with a redeploy.
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
  arrayBuffer(): Promise<ArrayBuffer>;
};

type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
};

type Env = {
  APP: Fetcher;
  APP_VERSION?: string;
  MEDIA?: R2Bucket;
  /** "r2" turns the shared second tier on; anything else leaves it off. */
  EDGE_TIER?: string;
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
const AGE = "x-edge-age";

/** Second tier (OPS-332): where objects live, and the limits that keep it small. */
const TIER_PREFIX = "edge-tier/";
/** A copy being refreshed is written to the tier only when it is older than this. */
const TIER_WRITE_MIN_S = 300;
const TIER_MAX_BYTES = 8 * 1024 * 1024;
const TIER_MAX_KEY = 900;

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

// ─── Why the app failed (OPS-195) ───────────────────────────────────────
//
// Every call to the app goes through appFetch. It changes nothing for the
// visitor: a thrown error is rethrown and a 5xx is returned as it came. It
// only writes ONE short log line, so the next break names its own cause
// (OPS-158 had none: the edge logged only the request line).
//
// The line is plain `key=value` words with no quote character and no run of
// six digits, so scripts/worker-errors/query.mjs redact() leaves it as it is.
// Never logged: a header, a cookie, a query string, the ray id, an HTML body.
// The one thing read from a body is Cloudflare's own platform error code
// ("error code: 1102") from a text/plain answer, at most 200 characters.

type Where = "pass" | "miss" | "refresh" | "standin";

/** Take out what must not reach a log line, then cut. */
function logSafe(value: string, max: number): string {
  return value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "")
    .replace(/["'`]/g, "")
    .replace(/\d{6,}/g, "")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function requestFacts(request: Request): string {
  let path = "";
  try {
    path = logSafe(new URL(request.url).pathname, 60);
  } catch {
    path = "";
  }
  const colo = (request as { cf?: { colo?: unknown } }).cf?.colo;
  const where = typeof colo === "string" && /^[A-Za-z]{2,5}$/.test(colo) ? colo : "none";
  const method = /^[A-Za-z]{3,10}$/.test(request.method) ? request.method : "none";
  return `colo=${where} method=${method} path=${path || "none"}`;
}

/** The first 200 characters of a body, read and then dropped. Never throws. */
async function bodyHead(res: Response): Promise<string> {
  try {
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let text = "";
    while (text.length < 200) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => undefined);
    return text.slice(0, 200);
  } catch {
    return "";
  }
}

async function logAppFailure(probe: Response | null, status: number, where: Where, facts: string): Promise<void> {
  let code = "none";
  if (probe && (probe.headers.get("content-type") ?? "").toLowerCase().startsWith("text/plain")) {
    const m = /error code:\s*(\d{3,5})/i.exec(await bodyHead(probe));
    if (m) code = m[1];
  } else {
    probe?.body?.cancel().catch(() => undefined);
  }
  console.error(`[edge] app 5xx where=${where} status=${status} code=${code} ${facts}`);
}

/** env.APP.fetch with one log line when the app throws or answers 5xx. */
async function appFetch(request: Request, env: Env, ctx: ExecutionContext, where: Where): Promise<Response> {
  let res: Response;
  try {
    res = await env.APP.fetch(request);
  } catch (err) {
    const name = logSafe(err instanceof Error ? err.name : typeof err, 40) || "none";
    const msg = logSafe(err instanceof Error ? err.message : "", 60) || "none";
    console.error(`[edge] app fetch threw where=${where} name=${name} ${requestFacts(request)} msg=${msg}`);
    throw err;
  }
  if (res.status >= 500) {
    // The clone is taken now, before anyone reads the body; the visitor gets the original.
    let probe: Response | null = null;
    try {
      probe = res.clone();
    } catch {
      probe = null;
    }
    ctx.waitUntil(logAppFailure(probe, res.status, where, requestFacts(request)).catch(() => undefined));
  }
  return res;
}

// ─── Second tier (OPS-332) ──────────────────────────────────────────────
//
// One R2 object per page and host, no version in the key: the version lives
// inside the object, so storage stays at about one copy per page and needs no
// clean-up. An object is one line of JSON {v, storedAt, freshFor, originCc,
// headers}, a newline byte (0x0A), then the HTML bytes. JSON text never holds
// a raw newline, so the first 0x0A ends the header line. A fault anywhere in
// the tier is a miss for the visitor: the page still comes from the app.

function tierOn(env: Env): boolean {
  return env.EDGE_TIER === "r2" && !!env.MEDIA;
}

function tierKey(request: Request): string | null {
  const url = new URL(request.url);
  const key = `${TIER_PREFIX}${url.host}${url.pathname}`;
  return key.length <= TIER_MAX_KEY ? key : null;
}

type TierCopy = { body: Uint8Array<ArrayBuffer>; headers: Headers; storedAt: number };

function tierFault(what: string, err: unknown): void {
  const name = logSafe(err instanceof Error ? err.name : typeof err, 40) || "none";
  console.error(`[edge] tier ${what} failed name=${name}`);
}

async function putTier(env: Env, request: Request, res: Response, bytes: ArrayBuffer, storedAt: number, freshFor: number, originCc: string): Promise<void> {
  const key = tierKey(request);
  if (!key || !env.MEDIA || bytes.byteLength > TIER_MAX_BYTES) return;
  try {
    const headers: [string, string][] = [];
    res.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") headers.push([name, value]);
    });
    const head = new TextEncoder().encode(JSON.stringify({ v: env.APP_VERSION, storedAt, freshFor, originCc, headers }));
    const out = new Uint8Array(head.length + 1 + bytes.byteLength);
    out.set(head, 0);
    out[head.length] = 10;
    out.set(new Uint8Array(bytes), head.length + 1);
    await env.MEDIA.put(key, out.buffer, { httpMetadata: { contentType: "application/octet-stream" } });
  } catch (err) {
    tierFault("put", err);
  }
}

/** The stored copy of this page when it is of this release and not older than KEEP_S; else undefined. */
async function readTier(request: Request, env: Env): Promise<TierCopy | undefined> {
  const key = tierKey(request);
  if (!key || !env.MEDIA) return undefined;
  try {
    const object = await env.MEDIA.get(key);
    if (!object) return undefined;
    const bytes = new Uint8Array(await object.arrayBuffer());
    const end = bytes.indexOf(10);
    if (end < 1) return undefined;
    const head = JSON.parse(new TextDecoder().decode(bytes.subarray(0, end))) as {
      v?: unknown;
      storedAt?: unknown;
      freshFor?: unknown;
      originCc?: unknown;
      headers?: unknown;
    };
    if (head.v !== env.APP_VERSION) return undefined;
    if (typeof head.storedAt !== "number" || typeof head.freshFor !== "number" || typeof head.originCc !== "string") return undefined;
    if (!Array.isArray(head.headers)) return undefined;
    const ageS = (Date.now() - head.storedAt) / 1000;
    // Older than a day, or stamped in the future by more than a minute: not usable.
    if (ageS > KEEP_S || ageS < -60) return undefined;
    const headers = new Headers();
    for (const pair of head.headers as unknown[]) {
      if (Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") headers.append(pair[0], pair[1]);
    }
    headers.set(ORIGIN_CC, head.originCc);
    headers.set(STORED_AT, String(head.storedAt));
    headers.set(FRESH_FOR, String(head.freshFor));
    // The data centre keeps it only for what is left of its day.
    headers.set("Cache-Control", `public, s-maxage=${Math.max(1, Math.floor(KEEP_S - Math.max(0, ageS)))}`);
    return { body: bytes.subarray(end + 1), headers, storedAt: head.storedAt };
  } catch (err) {
    tierFault("get", err);
    return undefined;
  }
}

/** Puts the page into the data centre's cache and, when asked, into the shared tier. */
async function storeCopy(
  store: EdgeCache,
  key: string,
  env: Env,
  request: Request,
  res: Response,
  copy: Response,
  writeTier: boolean,
  storedAt: number,
  freshFor: number,
  originCc: string,
): Promise<void> {
  if (!writeTier) {
    await store.put(key, copy).catch((err) => console.error("[edge] put failed", err));
    return;
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await copy.arrayBuffer();
  } catch (err) {
    console.error("[edge] put failed", err);
    return;
  }
  const colo = new Response(bytes, { status: copy.status, statusText: copy.statusText, headers: copy.headers });
  await Promise.all([
    store.put(key, colo).catch((err) => console.error("[edge] put failed", err)),
    putTier(env, request, res, bytes, storedAt, freshFor, originCc),
  ]);
}

/** Asks the app and, when the page is shareable, stores a copy. */
async function fetchAndStore(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
  store: EdgeCache,
  where: "miss" | "refresh",
  writeTier = false,
): Promise<{ res: Response; stored: boolean }> {
  const res = await appFetch(request, env, ctx, where);
  const maxAge = sharedMaxAge(res);
  if (maxAge === 0 || !res.body) return { res, stored: false };
  const [forClient, forCache] = res.body.tee();
  const storedAt = Date.now();
  const freshFor = Math.max(1, Math.min(maxAge, FRESH_MAX_S));
  const originCc = res.headers.get("cache-control") ?? "";
  const copy = new Response(forCache, res);
  copy.headers.set(ORIGIN_CC, originCc);
  copy.headers.set(STORED_AT, String(storedAt));
  copy.headers.set(FRESH_FOR, String(freshFor));
  copy.headers.set("Cache-Control", `public, s-maxage=${KEEP_S}`);
  ctx.waitUntil(storeCopy(store, key, env, request, res, copy, writeTier && tierOn(env), storedAt, freshFor, originCc));
  return { res: new Response(forClient, res), stored: true };
}

// ─── Media ──────────────────────────────────────────────────────────────
//
// Blog hero images live in the MEDIA bucket under blog/heroes/ and nowhere
// else: this Worker no longer calls Supabase (OPS-289). Filenames carry a
// timestamp and are never overwritten, so responses are immutable.

/** Keep in sync with MEDIA_KEY in src/lib/media.ts. */
const MEDIA_KEY = /^\/media\/(blog\/heroes\/[A-Za-z0-9._-]+\.webp)$/;
const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

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

// Stand-ins for a hero that is not in the bucket. Rather than a broken image,
// the page gets one of the site's own library photos, picked by the file name
// so each post keeps the same one. Served with a short browser cache and not
// stored at the edge, so the real image takes over as soon as it is uploaded.
// The deploy smoke test counts these (scripts/smoke-prod.mts, "media heroes").
const MEDIA_STAND_INS = [
  "cabin-interior",
  "city-night-window",
  "desert-city-approach",
  "fbo-lounge",
  "ramp-arrival",
  "turboprop-mountains",
  "winter-ramp",
];

async function mediaStandIn(request: Request, env: Env, ctx: ExecutionContext, key: string): Promise<Response> {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const file = MEDIA_STAND_INS[hash % MEDIA_STAND_INS.length];
  const url = new URL(request.url);
  url.pathname = `/images/blog/library/${file}.webp`;
  url.search = "";
  const res = await appFetch(new Request(url.href, { method: "GET" }), env, ctx, "standin").catch(() => null);
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

  const object = await env.MEDIA.get(key);
  if (!object) return mediaStandIn(request, env, ctx, key);
  const res = mediaResponse(object.body, object.httpMetadata?.contentType || "image/webp", object.httpEtag);
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
  if (!store || !key) return appFetch(request, env, ctx, "pass");

  // A cache fault must never take a page down: fall through to the app.
  let hit = await store.match(key).catch(() => undefined);
  let fromTier = false;
  if (!hit && tierOn(env)) {
    // No copy in this data centre: the shared tier may hold one of this release.
    const shared = await readTier(request, env);
    if (shared) {
      const make = () => new Response(shared.body, { status: 200, headers: shared.headers });
      ctx.waitUntil(store.put(key, make()).catch((err) => console.error("[edge] put failed", err)));
      hit = make();
      fromTier = true;
    }
  }
  if (!hit) {
    // The original request is passed on untouched; a clone goes to the cache path.
    const { res, stored } = await fetchAndStore(request, env, ctx, key, store, "miss", tierOn(env));
    if (stored) res.headers.set("x-edge-cache", "MISS");
    return res;
  }

  const ageS = (Date.now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000;
  const stale = ageS > Number(hit.headers.get(FRESH_FOR) ?? 0);
  if (stale) {
    // A refresh rewrites the shared copy only when the one it replaces is old enough.
    const writeTier = tierOn(env) && ageS > TIER_WRITE_MIN_S;
    ctx.waitUntil(
      fetchAndStore(request, env, ctx, key, store, "refresh", writeTier)
        .then(({ res }) => res.body?.cancel())
        .catch((err) => console.error("[edge] refresh failed", err)),
    );
  }
  const out = new Response(hit.body, hit);
  out.headers.set("Cache-Control", hit.headers.get(ORIGIN_CC) || "private, no-cache");
  out.headers.delete(ORIGIN_CC);
  out.headers.delete(STORED_AT);
  out.headers.delete(FRESH_FOR);
  out.headers.set(AGE, String(Math.max(0, Math.floor(ageS))));
  out.headers.set("x-edge-cache", fromTier ? "TIER" : stale ? "STALE" : "HIT");
  return out;
}

const worker = { fetch: serve };
export default worker;
