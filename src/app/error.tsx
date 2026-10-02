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
        <p className="eyebrow">Something went wrong</p>
        <h1 className="title-app text-bone">Something went sideways.</h1>
        <p className="lead mx-auto mt-5 max-w-[52ch]">
          The page hit an unexpected error. Dispatch has been notified. You can retry, head back
          to the homepage, or call us at{" "}
          <a className="text-link" href="tel:+14244872707">
            +1 (424) 487-2707
          </a>
          .
        </p>
        {error.digest ? (
          <p className="mt-4 text-[13px] leading-[1.5] text-steel">Reference {error.digest}</p>
        ) : null}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={reset} className="btn btn-primary btn-lg">
            Try again <span className="arrow">→</span>
          </button>
          <Link href="/" className="btn btn-secondary btn-lg">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
