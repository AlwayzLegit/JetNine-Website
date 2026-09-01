import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { QUESTIONS, QUESTION_CATEGORIES } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";

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

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-20 max-md:pt-[140px] max-md:pb-14">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Good questions · {QUESTIONS.length} answered
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
            Asked at the desk, answered in writing.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            The questions that actually come in — before a first booking, at 11pm on a Sunday,
            halfway through comparing three quotes. Each one gets the straight answer first and
            the reasoning after, with the numbers left in.
          </Reveal>
          <Reveal stagger={3} className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {QUESTION_CATEGORIES.map((c) => (
              <a
                key={c}
                href={`#${c.toLowerCase().replace(/\s+/g, "-")}`}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
              >
                — {c}
              </a>
            ))}
          </Reveal>
        </div>
      </header>

      <section className="py-24 max-md:py-16">
        <div className="container-jn flex flex-col gap-16">
          {QUESTION_CATEGORIES.map((category) => {
            const items = QUESTIONS.filter((q) => q.category === category);
            if (items.length === 0) return null;
            return (
              <div
                key={category}
                id={category.toLowerCase().replace(/\s+/g, "-")}
                className="scroll-mt-24"
              >
                <Reveal>
                  <p className="caption mb-8">— {category}</p>
                </Reveal>
                <div className="border-y border-ink-3 divide-y divide-ink-3">
                  {items.map((q) => (
                    <Reveal key={q.slug}>
                      {/* Native accordion: server-rendered, keyboard
                          accessible, and every answer is in the HTML for
                          crawlers whether or not it's open. */}
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                          <span className="font-serif text-[21px] font-normal leading-[1.25] tracking-tight text-bone transition-colors group-hover:text-clearance max-md:text-[18px]">
                            {q.q}
                          </span>
                          <span
                            aria-hidden
                            className="shrink-0 font-mono text-[14px] text-clearance transition-transform duration-200 group-open:rotate-45"
                          >
                            +
                          </span>
                        </summary>
                        <div className="pb-7">
                          <p className="max-w-[70ch] text-[15px] leading-[1.65] text-bone-2">
                            {q.short}
                          </p>
                          <Link
                            href={`/questions/${q.slug}`}
                            className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-clearance transition-colors hover:text-bone"
                          >
                            The full answer <span className="arrow">→</span>
                          </Link>
                        </div>
                      </details>
                    </Reveal>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
            — Answered by the JetNine dispatch desk · Updated {RATES_UPDATED} · Quick answers to
            thirty more on the{" "}
            <Link href="/faq" className="text-clearance normal-case tracking-normal">
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

      <ClosingCTA
        heading="The desk that wrote these picks up."
        body="Average pick-up under twenty seconds, every hour of every day. Ask the question your way."
      />
    </>
  );
}
