import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { GUIDE_CHAPTERS, type GuideChapter } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

/**
 * Shared frame for pricing-guide chapters: chapter eyebrow, H1, byline
 * with a visible update date (the audited leader's guide hub has neither
 * byline nor dates — cheap E-E-A-T ground to take), Article +
 * BreadcrumbList JSON-LD, chapter content, prev/next navigation, and the
 * standard quote CTA. Chapters supply their body (and any FAQPage
 * schema) as children.
 *
 * Authorship is the desk, not an invented person: content is written and
 * reviewed by JetNine dispatch, and the schema says exactly that.
 */
export function GuideShell({
  chapter,
  lead,
  children,
}: {
  chapter: GuideChapter;
  lead: string;
  children: React.ReactNode;
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const prev = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter - 1);
  const next = GUIDE_CHAPTERS.find((c) => c.chapter === chapter.chapter + 1);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: chapter.title,
    description: chapter.description,
    url: `${siteUrl}${chapter.href}`,
    isPartOf: { "@type": "CreativeWorkSeries", name: "The JetNine Charter Pricing Guide", url: `${siteUrl}/guides` },
    author: {
      "@type": "Organization",
      name: "JetNine Dispatch Desk",
      url: `${siteUrl}/about`,
      parentOrganization: { "@id": `${siteUrl}/#organization` },
    },
    publisher: { "@id": `${siteUrl}/#organization` },
    dateModified: "2026-08-31",
    datePublished: "2026-08-31",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Pricing guide", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 3, name: chapter.navTitle, item: `${siteUrl}${chapter.href}` },
    ],
  };

  const prevLink = prev
    ? { href: prev.href, small: `← Chapter ${prev.chapter}`, big: prev.navTitle }
    : { href: "/guides", small: "← All chapters", big: "The charter pricing guide" };
  const nextLink = next
    ? { href: next.href, small: `Chapter ${next.chapter} →`, big: next.navTitle }
    : { href: "/cost-calculator", small: "Put it to work →", big: "Cost calculator" };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="bg-ink pt-[96px] max-md:pt-14">
        <div className="container-jn">
          <p className="eyebrow">
            <Link href="/guides" className="transition-colors hover:text-bone">
              The charter pricing guide
            </Link>
            <span aria-hidden> · </span>
            Chapter {chapter.chapter} of {GUIDE_CHAPTERS.length}
          </p>
          <h1 className="title-page max-w-[18ch] !text-[clamp(40px,5vw,60px)]">{chapter.title}</h1>
          <p className="lead mt-5 max-w-[62ch]">{lead}</p>
          <p className="mt-6 text-[14px] text-steel">
            By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly
          </p>
        </div>
      </header>

      {children}

      {/* Prev / next chapter nav */}
      <nav aria-label="Guide chapters" className="section-jn">
        <div className="container-jn grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href={prevLink.href} className="card card-pad flex flex-col gap-2 max-md:p-5">
            <span className="label-jn">{prevLink.small}</span>
            <span className="title-card-sm text-bone">{prevLink.big}</span>
          </Link>
          <Link
            href={nextLink.href}
            className="card card-pad flex flex-col items-end gap-2 text-right max-md:p-5"
          >
            <span className="label-jn">{nextLink.small}</span>
            <span className="title-card-sm text-bone">{nextLink.big}</span>
          </Link>
        </div>
      </nav>

      <QuoteLauncher
        context={`guide-${chapter.slug}`}
        heading="Numbers read. Now price yours."
        body="Route, date, and passenger count — the same engine behind every figure in this guide, live on your trip."
      />

      <CtaBand
        title="Or just ask a human."
        body="The dispatch desk wrote this guide and picks up in under twenty seconds — every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
