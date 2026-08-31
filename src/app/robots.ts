import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * Production: allow indexing of the marketing surface, block account /
 * admin / quote-wizard internals (they're behind auth or session state
 * and have no value in the index).
 *
 * Preview & non-prod Vercel environments: disallow everything so we
 * don't accidentally let Google index preview deployments under
 * *.vercel.app subdomains.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (!isProduction) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      sitemap: `${base}/sitemap.xml`,
    };
  }

  const disallow = [
    // No trailing slash: covers the bare /account path the nav and
    // footer link to, which 307s to /sign-in for the (logged-out)
    // crawler — Semrush flagged those as 17 temporary-redirect hits.
    "/account",
    "/admin/",
    "/api/",
    "/auth/",
    "/sign-in",
    "/quote/aircraft",
    "/quote/contact",
    "/quote/review",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Explicitly welcome AI-answer crawlers (same private-area
      // disallows). The published rate card and FAQ answers are exactly
      // the concrete, citable data LLM answers surface for "how much
      // does a private jet cost" queries — being crawlable there is
      // distribution the competitor set mostly ignores.
      ...["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended"].map(
        (userAgent) => ({ userAgent, allow: "/", disallow }),
      ),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
