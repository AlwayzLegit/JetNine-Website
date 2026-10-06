import type { MetadataRoute } from "next";
import { FLEET } from "./fleet";
import { GUIDE_CHAPTERS, LONG_GUIDES } from "./guides";
import { SHORT_GUIDES, shortGuideHref } from "./guides-short";
import { MODELS } from "./models";
import { ROUTES } from "./routes";
import { QUESTIONS } from "./questions";
import { CITIES } from "./cities";

export type SitemapPost = {
  slug: string;
  updatedAt: Date;
  heroImageUrl: string | null;
};

// Public canonical landing pages. Private/token URLs and later wizard steps
// intentionally never enter the sitemap. Catalogs below own dynamic coverage.
const LANDINGS = [
  "/", "/aircraft", "/memberships", "/empty-legs", "/cost-calculator",
  "/guides", "/how-it-works", "/safety", "/safety/operator-vetting",
  "/safety/pilot-standards", "/safety/ratings-explained", "/about",
  "/contact", "/faq", "/legal", "/quote/mission", "/blog",
  "/questions", "/private-jet-charter", "/routes",
  "/private-jet-concierge", "/private-jet-birthday-party",
];

export function sitemapOrigin(siteUrl = "https://jetnine.com"): string {
  const url = new URL(siteUrl);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Sitemap site URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  return url.origin;
}

/** Pure catalog builder: no fabricated dates and no ignored priority/frequency. */
export function buildSitemap(posts: SitemapPost[], siteUrl?: string): MetadataRoute.Sitemap {
  const base = sitemapOrigin(siteUrl);
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  function add(path: string, images: (string | null | undefined)[] = [], lastModified?: Date) {
    const url = new URL(path, base);
    if (url.origin !== base || url.search || url.hash) throw new Error(`Noncanonical sitemap path: ${path}`);
    const existing = entries.get(url.href);
    const imageUrls = [...new Set([
      ...(existing?.images ?? []),
      ...images.filter((image): image is string => Boolean(image)).map((image) => {
        const imageUrl = new URL(image, base);
        if (!/^https?:$/.test(imageUrl.protocol) || imageUrl.username || imageUrl.password) {
          throw new Error("Sitemap images must use public HTTP(S) URLs.");
        }
        return imageUrl.href;
      }),
    ])];
    entries.set(url.href, {
      url: url.href,
      ...(imageUrls.length ? { images: imageUrls } : {}),
      ...(lastModified && Number.isFinite(lastModified.getTime()) ? { lastModified } : {}),
    });
  }
  LANDINGS.forEach((path) => add(path));
  add("/private-jet-concierge", [
    "/images/concierge/hero.webp", "/images/concierge/cabin-dining.webp",
    "/images/concierge/cabin-notebook.webp", "/images/concierge/corporate.webp",
    "/images/concierge/birthday-transfer.webp", "/images/concierge/jet-hero.webp",
  ]);
  add("/private-jet-birthday-party", [
    "/images/concierge/birthday-hero.webp", "/images/concierge/birthday-cake.webp",
    "/images/concierge/birthday-jet.webp", "/images/concierge/birthday-transfer.webp",
  ]);
  GUIDE_CHAPTERS.forEach((guide) => add(guide.href));
  LONG_GUIDES.forEach((guide) => add(guide.href, [guide.image]));
  SHORT_GUIDES.forEach((guide) => add(shortGuideHref(guide.slug), [guide.hero, guide.heroB]));
  QUESTIONS.forEach((question) => add(`/questions/${question.slug}`));
  CITIES.forEach((city) => add(`/private-jet-charter/${city.slug}`));
  ROUTES.forEach((route) => add(`/routes/${route.slug}`));
  MODELS.forEach((model) => add(`/aircraft/${model.category}/${model.slug}`, [model.sample.imageUrl]));
  FLEET.forEach((category) => add(`/aircraft/${category.slug}`, [category.imageUrl, ...(category.cabin.imageUrls ?? [])]));
  posts.forEach((post) => add(`/blog/${encodeURIComponent(post.slug)}`, [post.heroImageUrl], post.updatedAt));
  return [...entries.values()].sort((a, b) => a.url.localeCompare(b.url));
}

/** A failed runtime refresh must propagate so ISR retains the last good XML. */
export async function loadSitemap(
  readPosts: () => Promise<SitemapPost[]>,
  { buildPhase = false, siteUrl }: { buildPhase?: boolean; siteUrl?: string } = {},
): Promise<MetadataRoute.Sitemap> {
  let posts: SitemapPost[];
  try {
    posts = await readPosts();
  } catch (error) {
    if (!buildPhase) throw error;
    // Credential-free CI builds can seed the catalog; runtime errors cannot
    // overwrite a previously successful sitemap with a blog-free fallback.
    posts = [];
  }
  return buildSitemap(posts, siteUrl);
}

// Next 15's metadata serializer interpolates URLs directly into XML. Escape
// only at that boundary, keeping the catalog's actual URLs intact for checks.
export function sitemapMetadata(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
  return entries.map((entry) => ({
    ...entry,
    url: escape(entry.url),
    ...(entry.images ? { images: entry.images.map(escape) } : {}),
  }));
}
