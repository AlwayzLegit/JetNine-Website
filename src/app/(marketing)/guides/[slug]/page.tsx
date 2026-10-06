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

export async function generateMetadata({ params }: GuideParams): Promise<Metadata> {
  const { slug } = await params;
  const g = getShortGuide(slug);
  if (!g || SHORT_GUIDE_STATIC_SLUGS.includes(slug)) return {};
  return pageMetadata({
    title: g.metaTitle,
    description: g.description,
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
