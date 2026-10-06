import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";
import { FLEET } from "@/lib/fleet";
import { GUIDE_CHAPTERS, LONG_GUIDES } from "@/lib/guides";
import { SHORT_GUIDES, SHORT_GUIDE_STATIC_SLUGS, shortGuideHref } from "@/lib/guides-short";
import { MODELS } from "@/lib/models";
import { ROUTES } from "@/lib/routes";
import { QUESTIONS } from "@/lib/questions";
import { CITIES } from "@/lib/cities";

// Marketing pages — static, change infrequently, every URL should be indexable.
// `images` adds the page's photography to the image sitemap.
const MARKETING_ROUTES: {
  path: string;
  priority: number;
  changeFreq: "daily" | "weekly" | "monthly";
  images?: string[];
}[] = [
  { path: "/",                 priority: 1.0, changeFreq: "weekly" },
  { path: "/aircraft",         priority: 0.8, changeFreq: "monthly" },
  { path: "/memberships",      priority: 0.8, changeFreq: "monthly" },
  { path: "/empty-legs",       priority: 0.7, changeFreq: "daily"   },
  { path: "/cost-calculator",  priority: 0.8, changeFreq: "monthly" },
  { path: "/guides",           priority: 0.8, changeFreq: "monthly" },
  // The pricing-guide chapters (cornerstone first) — registry-driven so
  // a new chapter is one entry in src/lib/guides.ts.
  ...GUIDE_CHAPTERS.map((c) => ({
    path: c.href,
    priority: c.chapter === 1 ? 0.8 : 0.6,
    changeFreq: "monthly" as const,
  })),
  // Long-form and short planning guides (Light redesign). Chapters above
  // already cover the slugs that predate it, so skip those here.
  ...LONG_GUIDES.filter((g) => !GUIDE_CHAPTERS.some((c) => c.href === g.href)).map((g) => ({
    path: g.href,
    priority: 0.6,
    changeFreq: "monthly" as const,
  })),
  ...SHORT_GUIDES.filter((g) => !SHORT_GUIDE_STATIC_SLUGS.includes(g.slug)).map((g) => ({
    path: shortGuideHref(g.slug),
    priority: 0.5,
    changeFreq: "monthly" as const,
  })),
  {
    path: "/private-jet-concierge",
    priority: 0.7,
    changeFreq: "monthly",
    images: [
      "/images/concierge/hero.webp",
      "/images/concierge/cabin-dining.webp",
      "/images/concierge/cabin-notebook.webp",
      "/images/concierge/corporate.webp",
      "/images/concierge/birthday-transfer.webp",
      "/images/concierge/jet-hero.webp",
    ],
  },
  {
    path: "/private-jet-birthday-party",
    priority: 0.6,
    changeFreq: "monthly",
    images: [
      "/images/concierge/birthday-hero.webp",
      "/images/concierge/birthday-cake.webp",
      "/images/concierge/birthday-jet.webp",
      "/images/concierge/birthday-transfer.webp",
    ],
  },
  { path: "/how-it-works",     priority: 0.7, changeFreq: "monthly" },
  { path: "/safety",           priority: 0.7, changeFreq: "monthly" },
  { path: "/safety/operator-vetting",  priority: 0.6, changeFreq: "monthly" },
  { path: "/safety/pilot-standards",   priority: 0.6, changeFreq: "monthly" },
  { path: "/safety/ratings-explained", priority: 0.6, changeFreq: "monthly" },
  { path: "/about",            priority: 0.7, changeFreq: "monthly" },
  { path: "/contact",          priority: 0.7, changeFreq: "monthly" },
  { path: "/faq",              priority: 0.6, changeFreq: "monthly" },
  { path: "/legal",            priority: 0.3, changeFreq: "monthly" },
  { path: "/quote/mission",    priority: 0.9, changeFreq: "monthly" },
];

// Blog posts live in the DB, so the sitemap re-generates hourly instead of
// only at build time.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const now = new Date();
  // Pages whose content ships with the code change when a build deploys,
  // so their lastmod is the build time (next.config.ts), not the moment
  // this sitemap was regenerated — an hourly "now" on every URL tells
  // crawlers nothing and teaches them to ignore lastmod. Blog posts keep
  // their own dates from the database.
  const deployedAt = process.env.SITE_BUILT_AT ? new Date(process.env.SITE_BUILT_AT) : now;

  // Local builds run without a reachable DB (see src/db/index.ts) — the
  // registry-driven URLs must still emit, so blog entries just drop out.
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPublishedPosts();
    blogEntries = [
      {
        url: `${base}/blog`,
        lastModified: posts[0]?.publishedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      },
      ...posts.map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    blogEntries = [
      { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 },
    ];
  }

  return [
    ...blogEntries,
    ...MARKETING_ROUTES.map((r) => ({
      url: `${base}${r.path}`,
      lastModified: deployedAt,
      changeFrequency: r.changeFreq,
      priority: r.priority,
      ...(r.images ? { images: r.images.map((src) => `${base}${src}`) } : {}),
    })),
    // Question hub + standalone question pages.
    {
      url: `${base}/questions`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    ...QUESTIONS.map((q) => ({
      url: `${base}/questions/${q.slug}`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: q.slug === "what-does-a-private-jet-broker-do" ? 0.7 : 0.5,
    })),
    // City charter pages + hub.
    {
      url: `${base}/private-jet-charter`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...CITIES.map((c) => ({
      url: `${base}/private-jet-charter/${c.slug}`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Route landing pages + hub.
    {
      url: `${base}/routes`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...ROUTES.map((r) => ({
      url: `${base}/routes/${r.slug}`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Aircraft model pages under each category.
    ...MODELS.map((m) => ({
      url: `${base}/aircraft/${m.category}/${m.slug}`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(m.sample.imageUrl ? { images: [`${base}${m.sample.imageUrl}`] } : {}),
    })),
    // The six aircraft category pages. Image extension: the hero + 3 cabin
    // shots, so real fleet photography can surface in category-intent
    // image queries ("light jet interior", etc.).
    ...FLEET.map((entry) => ({
      url: `${base}/aircraft/${entry.slug}`,
      lastModified: deployedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: [
        ...(entry.imageUrl ? [`${base}${entry.imageUrl}`] : []),
        ...(entry.cabin.imageUrls?.map((u) => `${base}${u}`) ?? []),
      ],
    })),
  ];
}
