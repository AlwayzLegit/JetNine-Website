import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { GUIDE_CHAPTERS, type GuideChapter } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";

/**
 * Shared frame for pricing-guide chapters: chapter kicker, H1, byline
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

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-16 max-md:pt-[140px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            <Link href="/guides" className="transition-colors hover:text-bone">
              The charter pricing guide
            </Link>
            <span aria-hidden>·</span>
            <span>
              Chapter {String(chapter.chapter).padStart(2, "0")} of{" "}
              {String(GUIDE_CHAPTERS.length).padStart(2, "0")}
            </span>
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[20ch]">
            {chapter.title}
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            {lead}
          </Reveal>
          <Reveal stagger={3} className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
            — By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly
          </Reveal>
        </div>
      </header>

      {children}

      {/* Prev / next chapter nav */}
      <nav aria-label="Guide chapters" className="border-t border-ink-3 bg-ink">
        <div className="container-jn grid grid-cols-1 sm:grid-cols-2">
          {prev ? (
            <Link
              href={prev.href}
              className="group flex flex-col gap-2 border-b border-ink-3 py-10 pr-8 transition-colors hover:bg-ink-2 sm:border-b-0 sm:border-r"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                ← Chapter {String(prev.chapter).padStart(2, "0")}
              </span>
              <span className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                {prev.navTitle}
              </span>
            </Link>
          ) : (
            <Link
              href="/guides"
              className="group flex flex-col gap-2 border-b border-ink-3 py-10 pr-8 transition-colors hover:bg-ink-2 sm:border-b-0 sm:border-r"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                ← All chapters
              </span>
              <span className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                The charter pricing guide
              </span>
            </Link>
          )}
          {next ? (
            <Link
              href={next.href}
              className="group flex flex-col items-end gap-2 py-10 pl-8 text-right transition-colors hover:bg-ink-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                Chapter {String(next.chapter).padStart(2, "0")} →
              </span>
              <span className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                {next.navTitle}
              </span>
            </Link>
          ) : (
            <Link
              href="/cost-calculator"
              className="group flex flex-col items-end gap-2 py-10 pl-8 text-right transition-colors hover:bg-ink-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                Put it to work →
              </span>
              <span className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                Cost calculator
              </span>
            </Link>
          )}
        </div>
      </nav>

      <QuoteLauncher
        context={`guide-${chapter.slug}`}
        heading="Numbers read. Now price yours."
        body="Route, date, and passenger count — the same engine behind every figure in this guide, live on your trip."
      />

      <ClosingCTA
        heading="Or just ask a human."
        body="The dispatch desk wrote this guide and picks up in under twenty seconds — every hour of every day."
      />
    </>
  );
}
