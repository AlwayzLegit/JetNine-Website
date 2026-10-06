import type { MetadataRoute } from "next";

// These paths are crawl exclusions, not access controls or noindex directives.
// Authentication and page-level indexing policy remain responsible for privacy.
const PRIVATE_ROOTS = [
  "/account", "/admin", "/api", "/auth", "/sign-in",
  "/quote/aircraft", "/quote/contact", "/quote/review",
  "/request", "/downloads",
];

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";

  // A preview build also uses NODE_ENV=production. Vercel's environment wins.
  // Disallow is a crawl policy; preview access protection must be enforced by
  // the hosting platform to guarantee preview content remains private.
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [{
      // Share one rule group without changing the existing named-bot policy.
      userAgent: ["*", "GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended"],
      allow: "/",
      // Exact URL, query variant, and descendants; /accounting stays allowed.
      disallow: PRIVATE_ROOTS.flatMap((path) => [`${path}$`, `${path}?`, `${path}/`]),
    }],
    // Keep discovery on the canonical production host, independent of preview
    // URLs or malformed environment configuration. Google ignores Host:.
    sitemap: "https://jetnine.com/sitemap.xml",
  };
}
