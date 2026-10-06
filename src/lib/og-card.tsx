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
  /** Context line at the top, set uppercase + tracked. e.g. "About JetNine". */
  kicker: string;
  /** Optional absolute URL of a background photo. Renders behind a
   *  diagonal dark gradient so the text stays legible. */
  bgImageUrl?: string;
  /** Optional sentence-case sans line at the bottom-left. Used by aircraft
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
        background: "#12232E",
        color: "#FFFFFF",
        fontFamily: '"Times New Roman", Times, Georgia, serif',
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
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      ) : null}

      {/* Navy left-to-right scrim (the light hero grammar) for legibility */}
      {opts.bgImageUrl ? (
        <div
          style={{
            position: "absolute",
            // Satori ignores the `inset` shorthand — size the scrim explicitly.
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(18,35,46,0.97) 0%, rgba(18,35,46,0.9) 34%, rgba(18,35,46,0.35) 66%, rgba(18,35,46,0.05) 100%)",
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
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#C9A56E",
          }}
        >
          <span>{opts.kicker}</span>
        </div>

        {/* Middle — title + lead */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 400,
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
              color: "#D8D3C9",
              maxWidth: 800,
              fontFamily: "Arial, Helvetica, sans-serif",
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
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#D8D3C9",
          }}
        >
          <span>{opts.bottomLeft ?? ""}</span>
          <span style={{ fontFamily: '"Times New Roman", Times, Georgia, serif', fontSize: 24, fontWeight: 400, letterSpacing: "0.27em", color: "#FFFFFF" }}>
            JETNINE
          </span>
        </div>
      </div>
    </div>
  );
}
