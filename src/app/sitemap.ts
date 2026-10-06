import { getSitemapPosts } from "@/lib/blog";
import { loadSitemap, sitemapMetadata } from "@/lib/sitemap-data";

// ISR serves the last successful sitemap while refreshing hourly. Let runtime
// database errors propagate: Next retains the old result and retries later.
export const revalidate = 3600;

export default async function sitemap() {
  return sitemapMetadata(await loadSitemap(getSitemapPosts, {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    production: process.env.VERCEL_ENV === "production",
    buildPhase: process.env.NEXT_PHASE === "phase-production-build",
  }));
}
