"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
    // Lazy-load Sentry — error boundaries are off the hot path; the
    // tiny extra latency to fetch the SDK chunk is worth keeping it
    // out of the shared bundle.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then(({ captureException }) => captureException(error));
    }
  }, [error]);

  return (
    <main className="container-jn flex min-h-[70vh] items-center py-16">
      <div className="mx-auto max-w-[640px] text-center">
        <p className="caption mb-6">— Status · 500</p>
        <h1 className="display-l">Something went sideways.</h1>
        <p className="mx-auto mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-bone-2">
          The page hit an unexpected error. Dispatch has been notified. You can retry,
          head back to the homepage, or call us at <a className="text-clearance underline-offset-2 hover:underline" href="tel:+18888475669">+1 (888) 847-5669</a>.
        </p>
        {error.digest ? (
          <p className="mx-auto mt-4 inline-block rounded-[3px] border border-ink-3 bg-ink-2 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-steel">
            ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again <span className="arrow">→</span>
          </button>
          <Link href="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
