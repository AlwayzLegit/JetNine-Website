// Client-side Sentry init, runs in the browser.
// Conditional on NEXT_PUBLIC_SENTRY_DSN so that without configuration the
// only cost is bundle weight, not actual telemetry.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });
}

// Required by the App Router `router.events` Sentry integration. Safe
// to export unconditionally; Sentry's helpers no-op when init wasn't
// called.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
