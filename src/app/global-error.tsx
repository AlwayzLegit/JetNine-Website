"use client";

import { useEffect } from "react";

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
          background: "#07080A",
          color: "#F4F1EA",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#C9C4B8",
              marginBottom: 16,
            }}
          >
            — Status · 500
          </p>
          <h1
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontWeight: 300,
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              margin: 0,
            }}
          >
            We&rsquo;re grounded for a moment.
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: "52ch",
              marginInline: "auto",
              fontSize: 15,
              lineHeight: 1.65,
              color: "#C9C4B8",
            }}
          >
            The site hit a top-level error. Refresh to retry, or call dispatch directly at +1 (888) 847-5669.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: 16,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "#8A8678",
              }}
            >
              ref · {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              background: "#E8E2D2",
              color: "#07080A",
              border: "none",
              padding: "14px 28px",
              fontSize: 13,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
