// Cloudflare Worker entry. Wraps the OpenNext build output (.open-next/,
// produced by `opennextjs-cloudflare build`) and adds the cron triggers that
// vercel.json used to schedule.
//
// Each Cron Trigger in wrangler.jsonc maps to one /api/cron/* route. The
// scheduled handler calls the app's own fetch handler in-process with the
// same `Authorization: Bearer $CRON_SECRET` header Vercel Cron sent, so the
// routes themselves are unchanged and still fail closed without the secret.
//
// Nothing heavy is imported at the top of this file. Cloudflare starts a new
// isolate for a large share of requests on a low-traffic site, and whatever
// is imported statically here is evaluated before that isolate can answer at
// all. The Next app and Sentry load on first use (`loadApp`), so a page that
// is already in the edge cache is served without booting either.

const CRON_ROUTES: Record<string, string> = {
  "*/15 * * * *": "/api/cron/empty-leg-watchlists",
  "*/10 * * * *": "/api/cron/sla-watch",
  "0 15 * * *": "/api/cron/invoice-watch",
  "0 16 * * 5": "/api/cron/blog-digest",
  "0 14,15 * * *": "/api/cron/morning-summary",
  "20 9 * * *": "/api/cron/api-maintenance",
};

type Env = {
  CF_VERSION_METADATA?: { id?: string };
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  DEPLOY_ENV?: string;
  GIT_COMMIT_SHA?: string;
};

// Minimal Workers runtime types; the root tsconfig targets Next (DOM lib),
// and @cloudflare/workers-types would clash with it.
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };
type ScheduledController = { cron: string; scheduledTime: number };

type Handler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};

type App = Handler & {
  scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void>;
};

// OpenNext's image optimizer sets Cache-Control only for images it knows are
// immutable (static imports). Everything under public/ comes back with no
// caching header at all, so a browser refetches every optimized image on
// every page view, each one through this Worker and the Images binding.
// The sources are unhashed files that change only with a deploy: a day in
// the browser, then a week of serving stale while it revalidates.
const OPTIMIZED_IMAGE_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

async function withImageCaching(request: Request, response: Promise<Response>): Promise<Response> {
  const res = await response;
  if (request.method !== "GET" || !res.ok || res.headers.has("cache-control")) return res;
  if (new URL(request.url).pathname !== "/_next/image") return res;
  const cached = new Response(res.body, res);
  cached.headers.set("Cache-Control", OPTIMIZED_IMAGE_CACHE);
  return cached;
}

let appPromise: Promise<App> | undefined;

/** The Next app wrapped in Sentry, loaded once per isolate on first need. */
function loadApp(): Promise<App> {
  if (appPromise) return appPromise;
  const loading = (async (): Promise<App> => {
    const [Sentry, next] = await Promise.all([
      import("@sentry/cloudflare"),
      // @ts-expect-error -- generated at build time
      import("./.open-next/worker.js") as Promise<{ default: Handler }>,
    ]);
    const handler = next.default;

    const app = {
      fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
        withImageCaching(request, handler.fetch(request, env, ctx)),

      async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        const path = CRON_ROUTES[event.cron];
        if (!path) {
          console.error(`[cron] no route for schedule "${event.cron}"`);
          return;
        }
        if (!env.CRON_SECRET) {
          console.error(`[cron] CRON_SECRET is not set; skipping ${path}`);
          return;
        }
        const base = (env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
        const res = await handler.fetch(
          new Request(`${base}${path}`, {
            headers: { Authorization: `Bearer ${env.CRON_SECRET}`, "user-agent": "cloudflare-cron" },
          }),
          env,
          ctx,
        );
        const body = (await res.text()).slice(0, 500);
        const line = `[cron] ${path} -> ${res.status} ${body}`;
        if (res.ok) console.log(line);
        else throw new Error(line); // marks the invocation failed in Workers logs
      },
    };

    // Server-side error reporting on Workers. With no SENTRY_DSN the SDK
    // stays disabled. src/instrumentation.ts reports Next's caught request
    // errors through this same per-request client; uncaught ones land here.
    return Sentry.withSentry(
      (env: Env) => ({
        dsn: env.SENTRY_DSN,
        enabled: Boolean(env.SENTRY_DSN),
        environment: env.DEPLOY_ENV,
        release: env.GIT_COMMIT_SHA,
        tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      }),
      app,
    ) as unknown as App;
  })();
  appPromise = loading;
  // A failed load (a transient import error) must not poison the isolate.
  loading.catch(() => {
    if (appPromise === loading) appPromise = undefined;
  });
  return loading;
}

// ─── Edge cache for public pages ────────────────────────────────────────
//
// Next already keeps rendered pages in R2 (ISR), but reaching that copy
// means booting the app: about a second in a fresh isolate, against tens of
// milliseconds once it is running. This keeps the finished HTML in the data
// centre's own cache so a fresh isolate can answer straight away.
//
// Only anonymous document requests for pages Next itself marks as shared
// (`s-maxage`, no cookie set) are stored. A copy is served as-is for up to
// five minutes (less if the page's own revalidate window is shorter), then
// keeps being served for a day while a background request refreshes it, so
// an edit shows within minutes and no visitor waits on a render. Entries are
// keyed by Worker version: a deploy starts from an empty cache and never
// serves HTML that points at the previous build's files.

const EDGE_FRESH_MAX_S = 300;
const EDGE_KEEP_S = 86_400;
const EDGE_STORED_AT = "x-edge-stored-at";
const EDGE_FRESH_FOR = "x-edge-fresh-for";
const EDGE_ORIGIN_CC = "x-edge-origin-cache-control";

/** Paths that are personal, transactional or not pages at all. */
const EDGE_SKIP = /^\/(?:api|admin|account|quote|request|sign-in|auth|_next|cdn-cgi)(?:\/|$)/;

type EdgeCache = {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
};

function edgeCache(): EdgeCache | null {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
}

/** Cache key for this request, or null when it must always reach the app. */
function edgeKey(request: Request, env: Env): string | null {
  if (request.method !== "GET") return null;
  const version = env.CF_VERSION_METADATA?.id;
  if (!version) return null;
  const url = new URL(request.url);
  // Query strings carry auth codes, campaign tags and filters; RSC and
  // prefetch requests return a different body for the same URL.
  if (url.search || EDGE_SKIP.test(url.pathname)) return null;
  const h = request.headers;
  if (h.has("rsc") || h.has("next-router-prefetch") || h.has("next-router-state-tree")) return null;
  if (h.has("authorization") || h.has("range")) return null;
  // A Supabase session cookie means the middleware may need to refresh it.
  if (/(?:^|;\s*)sb-/.test(h.get("cookie") ?? "")) return null;
  return `https://edge-cache.invalid/${version}/${url.host}${url.pathname}`;
}

/** Seconds this response may be reused without revalidating; 0 = don't store. */
function sharedMaxAge(res: Response): number {
  if (res.status !== 200 || res.headers.has("set-cookie")) return 0;
  if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return 0;
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  if (/private|no-store|no-cache/.test(cc)) return 0;
  const m = /s-maxage=(\d+)/.exec(cc);
  return m ? Number(m[1]) : 0;
}

/** Runs the app and, when the page is shareable, stores a copy. */
async function renderAndStore(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  key: string,
  store: EdgeCache,
): Promise<{ res: Response; stored: boolean }> {
  const res = await (await loadApp()).fetch(request, env, ctx);
  const maxAge = sharedMaxAge(res);
  if (maxAge === 0 || !res.body) return { res, stored: false };
  const [forClient, forCache] = res.body.tee();
  const copy = new Response(forCache, res);
  copy.headers.set(EDGE_ORIGIN_CC, res.headers.get("cache-control") ?? "");
  copy.headers.set(EDGE_STORED_AT, String(Date.now()));
  copy.headers.set(EDGE_FRESH_FOR, String(Math.max(1, Math.min(maxAge, EDGE_FRESH_MAX_S))));
  copy.headers.set("Cache-Control", `public, s-maxage=${EDGE_KEEP_S}`);
  ctx.waitUntil(store.put(key, copy).catch((err) => console.error("[edge-cache] put failed", err)));
  return { res: new Response(forClient, res), stored: true };
}

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const store = edgeCache();
  const key = store ? edgeKey(request, env) : null;
  if (!store || !key) return (await loadApp()).fetch(request, env, ctx);

  const hit = await store.match(key).catch(() => undefined);
  if (!hit) {
    const { res, stored } = await renderAndStore(request, env, ctx, key, store);
    if (stored) res.headers.set("x-edge-cache", "MISS");
    return res;
  }

  const ageS = (Date.now() - Number(hit.headers.get(EDGE_STORED_AT) ?? 0)) / 1000;
  const stale = ageS > Number(hit.headers.get(EDGE_FRESH_FOR) ?? 0);
  if (stale) {
    ctx.waitUntil(
      renderAndStore(request, env, ctx, key, store)
        .then(({ res }) => res.body?.cancel())
        .catch((err) => console.error("[edge-cache] refresh failed", err)),
    );
  }
  const out = new Response(hit.body, hit);
  out.headers.set("Cache-Control", hit.headers.get(EDGE_ORIGIN_CC) || "private, no-cache");
  out.headers.delete(EDGE_ORIGIN_CC);
  out.headers.delete(EDGE_STORED_AT);
  out.headers.delete(EDGE_FRESH_FOR);
  out.headers.set("x-edge-cache", stale ? "STALE" : "HIT");
  return out;
}

export default {
  fetch: serve,
  scheduled: async (event: ScheduledController, env: Env, ctx: ExecutionContext) =>
    (await loadApp()).scheduled(event, env, ctx),
};

// Durable Object class the OpenNext cache needs (see open-next.config.ts).
// Re-exported from its own small module: taking it from ./.open-next/worker.js
// would pull the whole app back into start-up.
// @ts-expect-error -- generated at build time
export { DOQueueHandler } from "./.open-next/.build/durable-objects/queue.js";
