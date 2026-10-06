import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { DeskNotes } from "@/components/desk-notes";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { PlanBox } from "@/components/light/plan-box";
import { pageMetadata } from "@/lib/page-meta";
import { QUESTIONS, getQuestion, relatedQuestions } from "@/lib/questions";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

// Question pages — answer-shaped by design: the literal question as H1,
// the one-line answer first (bigger type than the body, because it IS
// the page), detail after. That's the shape featured snippets and AI
// answers lift. Light guide-page grammar: paper intro with breadcrumb,
// body column + sticky rail (plan box, go deeper, also asked).
type RouteParams = { params: Promise<{ slug: string }> };

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return QUESTIONS.map((q) => ({ slug: q.slug }));
}

// Reviewed question summaries are applied by pageMetadata. New questions use
// the complete answer as a fallback rather than cutting off mid-sentence.
export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const question = getQuestion(slug);
  if (!question) return {};
  return pageMetadata({
    title: question.q,
    description: question.short,
    path: `/questions/${question.slug}`,
  });
}

function RailList({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div className="border border-line bg-white px-5 py-[18px]">
      <p className="eyebrow !mb-1">{title}</p>
      <ul className="flex flex-col">
        {items.map((l) => (
          <li
            key={l.href}
            className="border-b border-[#ECE8DF] last:border-b-0"
          >
            <Link
              href={l.href}
              className="group flex min-h-[44px] items-center justify-between gap-4 py-[10px]"
            >
              <span className="font-serif text-[17px] leading-[1.3] group-hover:text-gold">
                {l.label}
              </span>
              <span aria-hidden className="text-gold">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function QuestionPage({ params }: RouteParams) {
  const { slug } = await params;
  const question = getQuestion(slug);
  if (!question) notFound();

  const related = relatedQuestions(question);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com"
  ).replace(/\/$/, "");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: [
            question.short,
            ...question.body,
            ...(question.checklist ?? []),
          ].join(" "),
        },
      },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Questions",
        item: `${siteUrl}/questions`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: question.q,
        item: `${siteUrl}/questions/${question.slug}`,
      },
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

      <header className="container-jn pt-[18px]">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Good questions", href: "/questions" },
            { label: question.category },
          ]}
        />
        <p className="eyebrow mb-[6px] mt-[14px]">{question.category}</p>
        <h1 className="max-w-[24ch] font-serif text-[clamp(34px,7vw,52px)] font-normal leading-[1.06] tracking-[-.01em]">
          {question.q}
        </h1>
        {/* The answer, first and biggest — the page exists for this
            paragraph; everything below is supporting detail. */}
        <p className="mt-4 max-w-[60ch] border-l-[3px] border-gold pl-5 font-serif text-[24px] leading-[1.35] max-md:text-[20px]">
          {question.short}
        </p>
        <p className="mt-4 text-[13px] text-steel">
          Answered by the JetNine dispatch desk · Updated {RATES_UPDATED}
        </p>
      </header>

      <div className="container-jn mt-8">
        <div className="flex flex-wrap items-start gap-7 border-t border-line pt-8">
          <article className="min-w-0 flex-[999_1_420px]">
            <div className="flex max-w-[70ch] flex-col gap-4 text-[16px] leading-[1.65] text-bone-2">
              {question.body.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
            {question.checklist ? (
              <section className="mt-7 max-w-[70ch]">
                <h2 className="font-serif text-[28px] font-normal leading-[1.1]">
                  Before you book, confirm.
                </h2>
                <ol className="mt-3 border border-line bg-white">
                  {question.checklist.map((item, i) => (
                    <li
                      key={item}
                      className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-[14px] border-b border-[#ECE8DF] px-5 py-[14px] last:border-b-0"
                    >
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-gold text-[12px] font-bold tabular-nums text-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="pt-[6px] text-[15px] leading-[1.55]">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <p className="mt-7 max-w-[70ch] border-t border-[#ECE8DF] pt-3 text-[12px] text-steel">
              {SITE.legal.part295}
            </p>
          </article>

          <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
            <aside className="sticky top-[calc(var(--header-h)+20px)] flex flex-col gap-[14px]">
              <PlanBox sub="Question answered — price the trip." context={`question-${question.slug}`} />
              <RailList title="Go deeper" items={question.goDeeper} />
              {related.length > 0 ? (
                <RailList
                  title="Also asked"
                  items={related.map((r) => ({
                    href: `/questions/${r.slug}`,
                    label: r.q,
                  }))}
                />
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      <DeskNotes
        terms={[
          question.category,
          ...question.q
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 4),
        ]}
      />

      <CtaBand
        title="The rest we answer live."
        body="Anything this page didn't cover goes straight to a senior dispatcher, every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
