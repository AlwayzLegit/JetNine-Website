import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";
import { FLEET } from "@/lib/fleet";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { MODELS } from "@/lib/models";
import { ROUTES } from "@/lib/routes";
import { QUESTIONS } from "@/lib/questions";
import { CITIES } from "@/lib/cities";

// Marketing pages — static, change infrequently, every URL should be indexable.
const MARKETING_ROUTES: { path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }[] = [
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
      lastModified: now,
      changeFrequency: r.changeFreq,
      priority: r.priority,
    })),
    // Each of the 6 aircraft category detail pages.
    // Image extension: list the hero + 3 cabin shots Google can index
    // for image search. Helps surface real fleet photography in
    // category-intent visual queries ("light jet interior", etc.).
    // Question hub + standalone question pages.
    {
      url: `${base}/questions`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    ...QUESTIONS.map((q) => ({
      url: `${base}/questions/${q.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: q.slug === "what-does-a-private-jet-broker-do" ? 0.7 : 0.5,
    })),
    // City charter pages + hub.
    {
      url: `${base}/private-jet-charter`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...CITIES.map((c) => ({
      url: `${base}/private-jet-charter/${c.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Route landing pages + hub.
    {
      url: `${base}/routes`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...ROUTES.map((r) => ({
      url: `${base}/routes/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Aircraft model pages under each category.
    ...MODELS.map((m) => ({
      url: `${base}/aircraft/${m.category}/${m.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(m.sample.imageUrl ? { images: [`${base}${m.sample.imageUrl}`] } : {}),
    })),
    ...FLEET.map((entry) => ({
      url: `${base}/aircraft/${entry.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: [
        ...(entry.imageUrl ? [`${base}${entry.imageUrl}`] : []),
        ...(entry.cabin.imageUrls?.map((u) => `${base}${u}`) ?? []),
      ],
    })),
  ];
}
