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

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account/",
          "/admin/",
          "/api/",
          "/auth/",
          "/sign-in",
          "/quote/aircraft",
          "/quote/contact",
          "/quote/review",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
