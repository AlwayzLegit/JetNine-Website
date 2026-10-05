import { ImageResponse } from "next/og";

// Next.js auto-discovers this and serves the result at /icon-<hash>.png
// (linked from <head>). The light design's favicon: a white serif "J9" on
// a navy rounded square.

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
          background: "#12232E",
          borderRadius: 3,
          color: "#FFFFFF",
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          // Small font + small canvas means the "09" reads as a tight
          // glyph rather than two characters. That's the look we want
          // in the tab favicon.
        }}
      >
        J9
      </div>
    ),
    { ...size },
  );
}
