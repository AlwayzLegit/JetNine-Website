// Client-side Sentry init, runs in the browser.
//
// Sentry is dynamically imported so the SDK lives in its own chunk
// instead of the shared-by-all bundle — saves ~80kB on marketing pages
// where 95% of first-load JS bytes matter for LCP. The cost is a small
// boot-time window where uncaught errors before SDK load aren't
// captured; acceptable trade for a mostly-read marketing surface.
//
// Both SDKs also wait for the page to finish loading and the main thread
// to go idle before they download and initialise. Together they are
// ~210 kB of compressed JavaScript and ~1 s of main-thread work on a
// mid-range phone; run during start-up they sat squarely on top of the
// Largest Contentful Paint and Total Blocking Time windows. Nothing is
// lost by waiting: PostHog's pageview capture fires at init whenever it
// runs, and Sentry's queue starts when it loads as before.

type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | null = null;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Run `fn` after the load event, in an idle slot (or within 3 s). */
function whenIdle(fn: () => void): void {
  const schedule = () => {
    // Safari gained requestIdleCallback only in 17.x, hence the fallback.
    const idle: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    if (typeof idle === "function") idle(() => fn(), { timeout: 3000 });
    else window.setTimeout(fn, 1500);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

if (typeof window !== "undefined" && dsn) {
  whenIdle(() => {
    void import("@sentry/nextjs").then((mod) => {
      sentry = mod;
      mod.init({
        dsn,
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        environment:
          process.env.NEXT_PUBLIC_DEPLOY_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      });
    });
  });
}

// PostHog product analytics, same dynamic-import treatment as Sentry —
// the SDK chunk only downloads when a key is configured, and marketing
// pages don't carry it in their shared bundle. The `defaults` date opts
// into history-API pageview capture, so App Router client navigations
// count without a manual capture call on every route change.
if (typeof window !== "undefined" && posthogKey) {
  whenIdle(() => {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        defaults: "2025-05-24",
      });
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
