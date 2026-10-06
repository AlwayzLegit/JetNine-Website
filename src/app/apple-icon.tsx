import { ImageResponse } from "next/og";

// Apple Touch Icon. iOS Safari and the home-screen "Add to Home Screen"
// flow look for this at 180×180. Without it, iOS falls back to a
// downscaled screenshot of the page, which
// rarely reads well at icon size.
//
// Same mark as icon.tsx (white serif "J9" on navy), drawn bigger so it
// scans cleanly on the springboard.

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
          background: "#12232E",
          color: "#FFFFFF",
          fontFamily: "Georgia, serif",
          fontSize: 92,
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        J9
      </div>
    ),
    { ...size },
  );
}
