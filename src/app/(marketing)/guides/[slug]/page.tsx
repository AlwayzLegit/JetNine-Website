import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/page-meta";
import { SHORT_GUIDES, SHORT_GUIDE_STATIC_SLUGS, getShortGuide, shortGuideHref } from "@/lib/guides-short";
import { ShortGuideTemplate } from "@/components/guide-short/guide-template";
import { GuideJsonLd, faqJsonLd } from "@/components/guide-short/schema";

// Short planning guides (Light - Guide 14 template), one route for all of
// them. Guides with their own static folder (one-way-vs-round-trip,
// last-minute-private-jet) render the same template from that folder —
// static siblings win over [slug], so they are left out of the params.
export const dynamicParams = false;

type GuideParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SHORT_GUIDES.filter((g) => !SHORT_GUIDE_STATIC_SLUGS.includes(g.slug)).map((g) => ({ slug: g.slug }));
}

// Reviewed search summaries are separate from the visible guide headings.
const GUIDE_METADATA: Partial<Record<string, { title: string; description: string }>> = {
  "how-to-choose-the-right-private-jet": {
    "title": "How to Choose a Private Jet — Cabin, Baggage & Range",
    "description": "Choose a charter aircraft around your group, baggage, airports and comfort needs. Compare cabin layouts, route suitability and the details to confirm before booking."
  },
  "on-demand-charter-vs-jet-cards-memberships": {
    "title": "On-Demand Charter vs. Jet Cards & Memberships",
    "description": "Compare on-demand charter, jet cards and memberships. Review deposits, access fees, availability, unused funds and contract terms against the trips you plan to take."
  },
  "first-private-jet-flight": {
    "title": "Your First Private Jet Flight — What to Expect",
    "description": "Prepare for your first private jet flight: confirm the FBO, identification and baggage, then learn about boarding, the cabin briefing and ground transfers."
  }
};

export async function generateMetadata({ params }: GuideParams): Promise<Metadata> {
  const { slug } = await params;
  const g = getShortGuide(slug);
  if (!g || SHORT_GUIDE_STATIC_SLUGS.includes(slug)) return {};
  return pageMetadata({
    title: GUIDE_METADATA[g.slug]?.title ?? g.metaTitle,
    description: GUIDE_METADATA[g.slug]?.description ?? g.description,
    path: shortGuideHref(g.slug),
    image: g.hero,
    imageAlt: g.title,
  });
}

export default async function ShortGuidePage({ params }: GuideParams) {
  const { slug } = await params;
  const g = getShortGuide(slug);
  if (!g || SHORT_GUIDE_STATIC_SLUGS.includes(slug)) notFound();

  return (
    <>
      <GuideJsonLd
        headline={g.title}
        description={g.description}
        path={shortGuideHref(g.slug)}
        crumb={g.short}
        image={g.hero}
        extra={[faqJsonLd(g.faq)]}
      />
      <ShortGuideTemplate guide={g} byline="By the JetNine dispatch desk · Planning guide" />
    </>
  );
}
