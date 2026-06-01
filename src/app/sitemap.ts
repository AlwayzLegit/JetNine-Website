import type { MetadataRoute } from "next";
import { FLEET } from "@/lib/fleet";

// Marketing pages — static, change infrequently, every URL should be indexable.
const MARKETING_ROUTES: { path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }[] = [
  { path: "/",                 priority: 1.0, changeFreq: "weekly" },
  { path: "/aircraft",         priority: 0.8, changeFreq: "monthly" },
  { path: "/memberships",      priority: 0.8, changeFreq: "monthly" },
  { path: "/empty-legs",       priority: 0.7, changeFreq: "daily"   },
  { path: "/how-it-works",     priority: 0.7, changeFreq: "monthly" },
  { path: "/safety",           priority: 0.7, changeFreq: "monthly" },
  { path: "/about",            priority: 0.7, changeFreq: "monthly" },
  { path: "/contact",          priority: 0.7, changeFreq: "monthly" },
  { path: "/faq",              priority: 0.6, changeFreq: "monthly" },
  { path: "/legal",            priority: 0.3, changeFreq: "monthly" },
  { path: "/quote/mission",    priority: 0.9, changeFreq: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const now = new Date();

  return [
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
