import { ImageResponse } from "next/og";

// Default OG card served for every route that doesn't provide its own.
// Rendered by Next.js at build/request time via the Edge `ImageResponse`
// helper — no static asset to ship, no design tooling.
//
// Satori (the engine behind ImageResponse) requires every div with more
// than one child to declare `display: flex` (or `display: none`). All
// containers below set it explicitly.

export const runtime = "edge";
export const alt = "JetNine — Private aviation, ready when you are";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#07080A",
          color: "#F4F1EA",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "ui-serif, Georgia, serif",
        }}
      >
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
          <span>JetNine</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 80,
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              maxWidth: 980,
            }}
          >
            <span>Private aviation,</span>
            <span>ready when you are.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              lineHeight: 1.5,
              color: "#C9C4B8",
              maxWidth: 880,
              fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
              fontWeight: 400,
            }}
          >
            Part 295 indirect air carrier · senior dispatch desk · ARG/US PLATINUM
            operators only · quote returned in under 30 minutes.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 14,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#8A8678",
          }}
        >
          <span>jetnine.com</span>
          <span style={{ color: "#E8E2D2" }}>+1 (818) 900-5278</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
