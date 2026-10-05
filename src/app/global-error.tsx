"use client";

import { useEffect } from "react";

// Renders its own <html>, so globals.css may not be loaded: everything is
// inline in the simplification tokens (ink / bone / bone-2 / steel /
// clearance, 8px control radius, Instrument Sans with a system fallback).
// No var(--font-*) here: the root layout (which defines them) is not
// rendered, and an undefined var() would void the whole declaration.
const SANS = 'Arial, Helvetica, sans-serif';
const SERIF = '"Times New Roman", Times, Georgia, serif';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then(({ captureException }) => captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#F7F5F0",
          color: "#12232E",
          fontFamily: SANS,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.4,
              color: "#56616A",
              margin: "0 0 12px",
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 300,
              fontSize: "clamp(32px, 6vw, 44px)",
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              margin: 0,
            }}
          >
            We&rsquo;re grounded for a moment.
          </h1>
          <p
            style={{
              margin: "20px auto 0",
              maxWidth: "52ch",
              fontSize: 19,
              lineHeight: 1.5,
              color: "#33434D",
            }}
          >
            The site hit an unexpected error. Refresh to retry, or call dispatch directly at +1
            (424) 487-2707.
          </p>
          {error.digest ? (
            <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.5, color: "#56616A" }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              height: 52,
              padding: "0 28px",
              background: "#12232E",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
