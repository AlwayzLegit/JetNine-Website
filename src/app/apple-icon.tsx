import { ImageResponse } from "next/og";

// Apple Touch Icon. iOS Safari and the home-screen "Add to Home Screen"
// flow look for this at 180×180. Without it, iOS falls back to a
// downscaled screenshot of the page, which on the dark JetNine palette
// is unreadable.
//
// Bigger canvas than the favicon icon.tsx, so we can render the 09
// monogram at a size that scans cleanly on the springboard.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 110,
          fontWeight: 300,
          letterSpacing: "-0.04em",
        }}
      >
        09
      </div>
    ),
    { ...size },
  );
}
