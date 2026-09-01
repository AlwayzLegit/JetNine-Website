import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { pageMetadata } from "@/lib/page-meta";
import { QUESTIONS, getQuestion, relatedQuestions } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";

// Question pages — audit item 13. Answer-shaped by design: the literal
// question as H1, the one-line answer first (bigger type than the body,
// because it IS the page), detail after. That's the shape featured
// snippets and AI answers lift — and robots.txt explicitly invites the
// AI crawlers to lift it.
type RouteParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return QUESTIONS.map((q) => ({ slug: q.slug }));
}

// Titles: the question itself, minus the trailing question mark when
// the template suffix follows better without it.
export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const question = getQuestion(slug);
  if (!question) return {};
  return pageMetadata({
    title: question.q.replace(/\?$/, ""),
    description: question.short.length > 158 ? `${question.short.slice(0, question.short.lastIndexOf(" ", 157))}…` : question.short,
    path: `/questions/${question.slug}`,
  });
}

export default async function QuestionPage({ params }: RouteParams) {
  const { slug } = await params;
  const question = getQuestion(slug);
  if (!question) notFound();

  const related = relatedQuestions(question);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: [question.short, ...question.body, ...(question.checklist ?? [])].join(" "),
        },
      },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Questions", item: `${siteUrl}/questions` },
      { "@type": "ListItem", position: 3, name: question.q, item: `${siteUrl}/questions/${question.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="border-b border-ink-3 bg-ink pt-[180px] pb-16 max-md:pt-[130px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            <Link href="/questions" className="transition-colors hover:text-bone">
              Good questions
            </Link>
            <span aria-hidden>·</span>
            <span>{question.category}</span>
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-l max-w-[24ch]">
            {question.q}
          </Reveal>
          {/* The answer, first and biggest — the page exists for this
              paragraph; everything below is supporting detail. */}
          <Reveal as="p" stagger={2} className="mt-8 max-w-[64ch] font-serif text-[24px] font-light leading-[1.4] tracking-tight text-bone max-md:text-[20px]">
            {question.short}
          </Reveal>
          <Reveal stagger={3} className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
            — Answered by the JetNine dispatch desk · Updated {RATES_UPDATED}
          </Reveal>
        </div>
      </header>

      <section className="py-24 max-md:py-16">
        <div className="container-jn grid gap-16 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex max-w-[70ch] flex-col gap-6">
            {question.body.map((p) => (
              <Reveal key={p.slice(0, 40)} as="p" className="text-[16px] leading-[1.7] text-bone-2">
                {p}
              </Reveal>
            ))}
            {question.checklist ? (
              <Reveal as="ul" className="mt-4 flex flex-col gap-0 border-y border-ink-3">
                {question.checklist.map((item, i) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 border-b border-ink-3 py-4 text-[15px] leading-[1.6] text-bone-2 last:border-b-0"
                  >
                    <span className="font-mono text-[11px] leading-[1.6] text-clearance">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </Reveal>
            ) : null}
          </div>

          <aside className="flex flex-col gap-8">
            <Reveal className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
              <p className="caption mb-6">— Go deeper</p>
              <ul className="flex flex-col">
                {question.goDeeper.map((l) => (
                  <li key={l.href} className="border-b border-ink-3 last:border-b-0">
                    <Link
                      href={l.href}
                      className="group flex items-baseline justify-between gap-4 py-4 transition-colors"
                    >
                      <span className="text-[14px] leading-[1.5] text-bone group-hover:text-clearance">
                        {l.label}
                      </span>
                      <span aria-hidden className="font-mono text-[11px] text-clearance">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
            {related.length > 0 ? (
              <Reveal className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
                <p className="caption mb-6">— Also asked</p>
                <ul className="flex flex-col">
                  {related.map((r) => (
                    <li key={r.slug} className="border-b border-ink-3 last:border-b-0">
                      <Link
                        href={`/questions/${r.slug}`}
                        className="group flex items-baseline justify-between gap-4 py-4"
                      >
                        <span className="text-[14px] leading-[1.5] text-bone group-hover:text-clearance">
                          {r.q}
                        </span>
                        <span aria-hidden className="font-mono text-[11px] text-clearance">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </aside>
        </div>
      </section>

      <QuoteLauncher
        context={`question-${question.slug}`}
        heading="Question answered. Price the trip."
        body="Route, date, and passenger count — live indicative pricing in four steps, from the desk that wrote this answer."
      />

      <ClosingCTA
        heading="The rest we answer live."
        body="Anything this page didn't cover goes straight to a senior dispatcher — average pick-up under twenty seconds, every hour of every day."
      />
    </>
  );
}
