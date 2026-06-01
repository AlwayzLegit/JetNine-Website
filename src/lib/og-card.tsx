/* eslint-disable @next/next/no-img-element */
import type React from "react";

// Shared 1200×630 OG card composition. Page-specific opengraph-image.tsx
// routes call ogCardJsx() with their own title/lead/kicker/bg and feed
// the result into ImageResponse — so every JetNine social share lands
// with the same editorial layout regardless of which page generated it.
//
// Satori (the renderer behind ImageResponse) requires every div with
// more than one child to declare `display: flex` or `display: none`.
// All containers below set it explicitly.

export const ogCardSize = { width: 1200, height: 630 } as const;
export const ogCardContentType = "image/png";

// Resolve the deployment's own base URL so `bgImageUrl` paths starting
// with /images/... can be turned into absolute URLs Satori can fetch.
export function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://jetnine.com")
  ).replace(/\/$/, "");
}

export function ogCardJsx(opts: {
  /** Display-serif headline. Falls naturally onto 1-2 lines at 76px. */
  title: string;
  /** Sans secondary line under the headline. ≤140 chars renders well. */
  lead: string;
  /** Mono uppercase context line at the top. e.g. "About JetNine". */
  kicker: string;
  /** Optional absolute URL of a background photo. Renders behind a
   *  diagonal dark gradient so the text stays legible. */
  bgImageUrl?: string;
  /** Optional mono uppercase line at the bottom-left. Used by aircraft
   *  category cards to show the spec triple. */
  bottomLeft?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#07080A",
        color: "#F4F1EA",
        fontFamily: "ui-serif, Georgia, serif",
      }}
    >
      {opts.bgImageUrl ? (
        <img
          src={opts.bgImageUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      ) : null}

      {/* Diagonal dark gradient overlay for text legibility on photos */}
      {opts.bgImageUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(105deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0.72) 38%, rgba(7,8,10,0.18) 70%, rgba(7,8,10,0) 100%)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        {/* Top — kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#E8E2D2",
          }}
        >
          <span>—</span>
          <span>{opts.kicker}</span>
        </div>

        {/* Middle — title + lead */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 300,
              lineHeight: 1.04,
              letterSpacing: "-0.018em",
              maxWidth: 820,
            }}
          >
            {opts.title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              lineHeight: 1.5,
              color: "#C9C4B8",
              maxWidth: 800,
              fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
              fontWeight: 400,
            }}
          >
            {opts.lead}
          </div>
        </div>

        {/* Bottom — optional spec + jetnine.com */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 14,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#E8E2D2",
          }}
        >
          <span>{opts.bottomLeft ?? ""}</span>
          <span style={{ color: "#8A8678" }}>jetnine.com</span>
        </div>
      </div>
    </div>
  );
}
