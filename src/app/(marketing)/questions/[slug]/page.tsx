import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { DeskNotes } from "@/components/desk-notes";
import { QuoteLauncher } from "@/components/quote-launcher";
import { pageMetadata } from "@/lib/page-meta";
import { QUESTIONS, getQuestion, relatedQuestions } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

// Question pages — audit item 13. Answer-shaped by design: the literal
// question as H1, the one-line answer first (bigger type than the body,
// because it IS the page), detail after. That's the shape featured
// snippets and AI answers lift — and robots.txt explicitly invites the
// AI crawlers to lift it.
type RouteParams = { params: Promise<{ slug: string }> };

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

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

      <header className="bg-ink pt-[96px] max-md:pt-14">
        <div className="container-jn">
          <p className="eyebrow">
            <Link href="/questions" className="tap-pad transition-colors hover:text-bone">
              Good questions
            </Link>
            <span aria-hidden> · </span>
            {question.category}
          </p>
          <h1 className="title-page max-w-[22ch] !text-[clamp(36px,4.5vw,56px)]">{question.q}</h1>
          {/* The answer, first and biggest — the page exists for this
              paragraph; everything below is supporting detail. */}
          <p className="mt-6 max-w-[60ch] font-serif text-[26px] font-light leading-[1.35] tracking-tight text-bone max-md:text-[22px]">
            {question.short}
          </p>
          <p className="mt-6 text-[14px] text-steel">
            Answered by the JetNine dispatch desk · Updated {RATES_UPDATED}
          </p>
        </div>
      </header>

      <section className="section-jn">
        <div className="container-jn grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex max-w-[72ch] flex-col gap-5 text-[17px] leading-[1.6] text-bone-2">
            {question.body.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
            {question.checklist ? (
              <ol className="card mt-2 divide-y divide-line-faint">
                {question.checklist.map((item, i) => (
                  <li key={item} className="grid grid-cols-[auto_1fr] gap-4 px-6 py-4 text-[16px] leading-[1.6] text-bone-2 max-md:px-5">
                    <span className="label-jn pt-[2px] tabular-nums">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="card card-pad max-md:p-5">
              <h2 className="title-card-sm text-bone">Go deeper</h2>
              <ul className="mt-3 flex flex-col divide-y divide-line-faint">
                {question.goDeeper.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="group flex min-h-[44px] items-center justify-between gap-4 py-3">
                      <span className="text-[15px] leading-[1.5] text-bone-2 transition-colors group-hover:text-bone">
                        {l.label}
                      </span>
                      <span aria-hidden className="text-bone-2">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {related.length > 0 ? (
              <div className="card card-pad max-md:p-5">
                <h2 className="title-card-sm text-bone">Also asked</h2>
                <ul className="mt-3 flex flex-col divide-y divide-line-faint">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/questions/${r.slug}`} className="group flex min-h-[44px] items-center justify-between gap-4 py-3">
                        <span className="text-[15px] leading-[1.5] text-bone-2 transition-colors group-hover:text-bone">
                          {r.q}
                        </span>
                        <span aria-hidden className="text-bone-2">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <DeskNotes terms={[question.category, ...question.q.toLowerCase().split(/\W+/).filter((w) => w.length > 4)]} />

      <QuoteLauncher
        context={`question-${question.slug}`}
        heading="Question answered. Price the trip."
        body="Route, date, and passenger count — live indicative pricing in four steps, from the desk that wrote this answer."
      />

      <CtaBand
        title="The rest we answer live."
        body="Anything this page didn't cover goes straight to a senior dispatcher — average pick-up under twenty seconds, every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
