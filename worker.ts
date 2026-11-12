// Cloudflare Worker entry. Wraps the OpenNext build output (.open-next/,
// produced by `opennextjs-cloudflare build`) and adds the cron triggers that
// vercel.json used to schedule.
//
// Each Cron Trigger in wrangler.jsonc maps to one /api/cron/* route. The
// scheduled handler calls the app's own fetch handler in-process with the
// same `Authorization: Bearer $CRON_SECRET` header Vercel Cron sent, so the
// routes themselves are unchanged and still fail closed without the secret.

import * as Sentry from "@sentry/cloudflare";
// @ts-expect-error -- generated at build time
import { default as handler } from "./.open-next/worker.js";

const CRON_ROUTES: Record<string, string> = {
  "*/15 * * * *": "/api/cron/empty-leg-watchlists",
  "*/10 * * * *": "/api/cron/sla-watch",
  "0 15 * * *": "/api/cron/invoice-watch",
  "0 16 * * 5": "/api/cron/blog-digest",
  "0 14,15 * * *": "/api/cron/morning-summary",
  "20 9 * * *": "/api/cron/api-maintenance",
};

type Env = {
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

const app = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    withImageCaching(request, (handler as Handler).fetch(request, env, ctx)),

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
    const res = await (handler as Handler).fetch(
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

// Server-side error reporting on Workers. With no SENTRY_DSN the SDK stays
// disabled. src/instrumentation.ts reports Next's caught request errors
// through this same per-request client; uncaught ones land here directly.
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    environment: env.DEPLOY_ENV,
    release: env.GIT_COMMIT_SHA,
    tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  }),
  app,
);

// Durable Object classes the OpenNext cache needs (see open-next.config.ts).
// @ts-expect-error -- generated at build time
export { DOQueueHandler } from "./.open-next/worker.js";
