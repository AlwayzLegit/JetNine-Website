import type { MetadataRoute } from "next";

// Web App Manifest at /manifest.webmanifest. Tells iOS/Android "Add to
// Home Screen" flows what to use for the installed app's name, icon,
// theme color, and default display mode. Without this, the install
// prompt either doesn't fire or installs with a generic page-thumbnail
// icon.
//
// The icons[] array references the same Next.js icon convention routes
// (icon.tsx and apple-icon.tsx) — no separate assets to ship or keep
// in sync.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JetNine — Private aviation",
    short_name: "JetNine",
    description:
      "Senior-dispatcher private charter brokerage. Part 295 indirect air carrier on ARG/US Platinum operators. Quote returned in under 30 minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080A",
    theme_color: "#07080A",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "travel"],
  };
}
