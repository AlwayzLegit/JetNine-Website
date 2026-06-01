import { ImageResponse } from "next/og";

// Next.js auto-discovers this and serves the result at /icon-<hash>.png
// (linked from <head>). Renders a JetNine "09" monogram in cream on the
// ink-deep background, matching the BrandMark component used in the nav.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E1014",
          color: "#F4F1EA",
          fontFamily: "serif",
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: "-0.04em",
          // Small font + small canvas means the "09" reads as a tight
          // glyph rather than two characters. That's the look we want
          // in the tab favicon.
        }}
      >
        09
      </div>
    ),
    { ...size },
  );
}
