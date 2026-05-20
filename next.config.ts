import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes intentionally off until all routes are scaffolded (phase 4).
  // Re-enable once /aircraft, /memberships, /empty-legs, etc. exist.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "jetnine.com" },
    ],
  },
};

export default nextConfig;
