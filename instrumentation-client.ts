// Client-side Sentry init, runs in the browser.
//
// Sentry is dynamically imported so the SDK lives in its own chunk
// instead of the shared-by-all bundle — saves ~80kB on marketing pages
// where 95% of first-load JS bytes matter for LCP. The cost is a small
// boot-time window where uncaught errors before SDK load aren't
// captured; acceptable trade for a mostly-read marketing surface.

type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | null = null;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (typeof window !== "undefined" && dsn) {
  void import("@sentry/nextjs").then((mod) => {
    sentry = mod;
    mod.init({
      dsn,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    });
  });
}

// Next.js calls this on every App Router navigation. We delegate to
// Sentry once it's loaded; before that, it's a no-op (early-load
// navigations are uncommon and lose only a trace, not an error).
export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
): void {
  sentry?.captureRouterTransitionStart(...args);
}
