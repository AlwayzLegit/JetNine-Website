import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { QUESTIONS, QUESTION_CATEGORIES } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

// The question hub — VistaJet's good-to-know architecture at small
// scale: a categorized index with native <details> accordions (server-
// rendered, zero JS) where every answer's opening line is readable in
// place and every question links to its standalone page.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Questions, Answered Straight",
  description:
    "The questions people actually ask a charter desk — what a broker does, what the taxes are, whether the dog can come — each answered with a number first and the reasoning after.",
  path: "/questions",
});

const anchor = (category: string) => category.toLowerCase().replace(/\s+/g, "-");

export default function QuestionsHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "JetNine — good questions, answered",
    itemListElement: QUESTIONS.map((q, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: q.q,
      url: `${siteUrl}/questions/${q.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />

      <PageHero
        eyebrow={`Good questions · ${QUESTIONS.length} answered`}
        title="Asked at the desk, answered in writing."
        lead="The questions that actually come in — before a first booking, at 11pm on a Sunday, halfway through comparing three quotes. Each one gets the straight answer first and the reasoning after, with the numbers left in."
      >
        <div className="mt-8 flex flex-wrap gap-2">
          {QUESTION_CATEGORIES.map((c) => (
            <a key={c} href={`#${anchor(c)}`} className="chip">
              {c}
            </a>
          ))}
        </div>
      </PageHero>

      <section className="section-jn">
        <div className="container-jn flex flex-col gap-14">
          {QUESTION_CATEGORIES.map((category) => {
            const items = QUESTIONS.filter((q) => q.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} id={anchor(category)} className="scroll-mt-24">
                <h2 className="title-section mb-6">{category}</h2>
                <div className="accordion">
                  {items.map((q) => (
                    /* Native accordion: server-rendered, keyboard
                       accessible, and every answer is in the HTML for
                       crawlers whether or not it's open. */
                    <details key={q.slug} className="accordion-row group">
                      <summary className="accordion-trigger list-none [&::-webkit-details-marker]:hidden">
                        <span>{q.q}</span>
                        <span aria-hidden className="accordion-sign">
                          <span className="group-open:hidden">+</span>
                          <span className="hidden group-open:inline">−</span>
                        </span>
                      </summary>
                      <div className="accordion-body">
                        <p className="text-[17px] leading-[1.6]">{q.short}</p>
                        <Link href={`/questions/${q.slug}`} className="text-link-strong mt-4 inline-block text-[15px]">
                          The full answer <span className="arrow">→</span>
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[14px] text-steel">
            Answered by the JetNine dispatch desk · Updated {RATES_UPDATED} · Quick answers to
            thirty more on the{" "}
            <Link href="/faq" className="text-link">
              FAQ
            </Link>
          </p>
        </div>
      </section>

      <QuoteLauncher
        context="questions-hub"
        heading="Enough reading. Run a number."
        body="Route, date, and passenger count — the wizard prices it live while the questions are still fresh."
      />

      <CtaBand
        title="The desk that wrote these picks up."
        body="Average pick-up under twenty seconds, every hour of every day. Ask the question your way."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
