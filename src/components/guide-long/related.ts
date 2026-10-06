import { GUIDE_CHAPTERS, LONG_GUIDES } from "@/lib/guides";
import type { RelatedCard } from "./ui";

// Card images for the pricing chapters (they have no hero photo of their own).
const CHAPTER_IMAGE: Record<string, string> = {
  "private-jet-charter-cost": "/images/light/page-02-hero.webp",
  "private-jet-cost-per-hour": "/images/light/cabin-midsize.webp",
  "what-affects-charter-price": "/images/light/leather-duffel-on-seat.webp",
  "one-way-vs-round-trip": "/images/light/jet-golden-hour.webp",
  "last-minute-private-jet": "/images/light/boarding-golden-hour.webp",
};

/** Build a related-guide card from a guide slug (long-form or pricing chapter). */
export function related(slug: string, body?: string, link = "Read the guide"): RelatedCard {
  const g = LONG_GUIDES.find((x) => x.slug === slug);
  if (g) return { title: g.navTitle, body: body ?? g.description, link, href: g.href, image: g.image };
  const c = GUIDE_CHAPTERS.find((x) => x.slug === slug);
  if (c) return { title: c.navTitle, body: body ?? c.description, link, href: c.href, image: CHAPTER_IMAGE[c.slug] ?? "/images/light/wing-clouds.webp" };
  throw new Error(`Unknown guide slug: ${slug}`);
}
