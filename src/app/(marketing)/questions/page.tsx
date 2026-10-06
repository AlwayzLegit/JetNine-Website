import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { PlanBox } from "@/components/light/plan-box";
import { CtaBand } from "@/components/cta-band";
import { QUESTIONS, QUESTION_CATEGORIES } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

// The question hub — a categorized index with native <details>
// accordions (server-rendered, zero JS) where every answer's opening
// line is readable in place and every question links to its standalone
// page. Light grammar from the FAQ / guide pages: paper intro, bordered
// white question cards with a bronze eyebrow, a sticky planning rail.
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

      <div className="container-jn pt-[18px]">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Good questions" }]} />
        <p className="eyebrow mb-[6px] mt-[14px]">Good questions · {QUESTIONS.length} answered</p>
        <h1 className="max-w-[20ch] font-serif text-[clamp(34px,9vw,54px)] font-normal leading-[1.04] tracking-[-.01em]">
          Asked at the desk, answered in writing.
        </h1>
        <p className="mt-[10px] max-w-[62ch] font-serif text-[20px] leading-[1.4] max-sm:text-[18px]">
          The questions that actually come in — before a first booking, at 11pm on a Sunday, halfway through
          comparing three quotes. Each one gets the straight answer first and the reasoning after, with the
          numbers left in.
        </p>
        <nav aria-label="Question topics" className="mt-4 flex flex-wrap items-center gap-[10px] text-[14px]">
          <span className="text-steel">Jump to:</span>
          {QUESTION_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#${anchor(c)}`}
              className="inline-flex h-8 items-center rounded-pill border border-line bg-white px-4 text-[14px] text-bone hover:border-steel"
            >
              {c}
            </a>
          ))}
        </nav>

        <div className="mt-[26px] flex flex-wrap items-start gap-7 pb-4">
          <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-9">
            {QUESTION_CATEGORIES.map((category) => {
              const items = QUESTIONS.filter((q) => q.category === category);
              if (items.length === 0) return null;
              return (
                <section key={category} id={anchor(category)} className="scroll-mt-[calc(var(--header-h)+20px)]">
                  <h2 className="font-serif text-[32px] font-normal leading-[1.1] max-sm:text-[28px]">{category}</h2>
                  <div className="mt-3 flex flex-col gap-2">
                    {items.map((q) => (
                      /* Native accordion: server-rendered, keyboard
                         accessible, and every answer is in the HTML for
                         crawlers whether or not it's open. */
                      <details key={q.slug} className="group border border-line bg-white open:border-gold">
                        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_28px] items-center gap-4 px-[18px] py-[14px] [&::-webkit-details-marker]:hidden">
                          <span>
                            <span className="block font-serif text-[21px] leading-[1.2]">{q.q}</span>
                          </span>
                          <span
                            aria-hidden
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-gold text-[18px] leading-none text-gold"
                          >
                            <span className="group-open:hidden">+</span>
                            <span className="hidden group-open:inline">−</span>
                          </span>
                        </summary>
                        <div className="px-[18px] pb-4">
                          <p className="max-w-[70ch] text-[15px] leading-[1.55] text-steel">{q.short}</p>
                          <Link href={`/questions/${q.slug}`} className="text-link mt-[10px] inline-block text-[14px]">
                            The full answer <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
            <p className="text-[13px] text-steel">
              Answered by the JetNine dispatch desk · Updated {RATES_UPDATED} · Quick answers to thirty more on the{" "}
              <Link href="/faq" className="text-link">
                FAQ
              </Link>
            </p>
          </div>

          <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
            <aside className="sticky top-[calc(var(--header-h)+20px)] flex flex-col gap-[14px]">
              <PlanBox sub="Enough reading — run a number." context="questions-hub" />
              <div className="on-navy bg-navy p-5">
                <h2 className="font-serif text-[24px] font-normal leading-[1.15]">Still have a question?</h2>
                <p className="mt-[6px] text-[14px] text-bone-2">Ask the question your way.</p>
                <a
                  href={`tel:${SITE.dispatchPhoneE164}`}
                  className="mt-[14px] flex h-10 w-full items-center justify-center rounded-control border border-white text-[14px] font-bold text-white hover:bg-[rgba(255,255,255,0.08)]"
                >
                  Call {SITE.dispatchPhone}
                </a>
                <Link href="/faq" className="rule-link rule-link-on-navy mt-[14px] !text-[14px]">
                  Browse the FAQ <span aria-hidden="true">→</span>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <CtaBand
        title="The desk that wrote these picks up."
        body="Every hour of every day. Ask the question your way."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
