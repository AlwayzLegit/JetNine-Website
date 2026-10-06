import Link from "next/link";
import type { ReactNode } from "react";
import type { GuideChapter } from "@/lib/guides";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { SplitHero } from "./hero";
import { TocNav, type TocItem } from "./toc";
import { Byline, ChapterJsonLd, ChapterKicker, ChapterNav } from "./chapter";
import { BTN, BrokerNote } from "./ui";

/**
 * A pricing-guide chapter in the light long-form template (Light - Guide
 * page): split hero, broker note, then "On this page" rail | chapter body
 * | "On every JetNine quote" aside, chapter navigation, the quote launcher
 * and the closing band. Keeps the chapters' schema, byline and analytics
 * context exactly as GuideShell had them.
 */
export function ChapterShell({
  chapter,
  crumb,
  subtitle,
  lead,
  image,
  toc,
  children,
}: {
  chapter: GuideChapter;
  crumb: string;
  subtitle: string;
  lead: string;
  image: string;
  toc: TocItem[];
  children: ReactNode;
}) {
  return (
    <>
      <ChapterJsonLd chapter={chapter} />

      <SplitHero
        crumb={crumb}
        kicker={<ChapterKicker chapter={chapter} />}
        title={chapter.title}
        titleMax="16ch"
        subtitle={subtitle}
        description={
          <>
            {lead}
            <span className="mt-3 block">
              <Byline className="m-0" />
            </span>
          </>
        }
        image={image}
        actions={
          <>
            <a href={toc[0]?.href ?? "#main-content"} className={BTN.navy}>
              Read the chapter <span aria-hidden="true">↓</span>
            </a>
            <Link href="/quote/mission" className={BTN.outline}>
              Request a quote
            </Link>
          </>
        }
      />

      <BrokerNote />

      <section className="container-jn flex flex-wrap items-start gap-7 pt-[26px]">
        <div className="min-w-0 max-w-full flex-[1_1_150px] self-stretch">
          <TocNav items={toc} />
        </div>
        <div className="min-w-0 flex-[999_1_440px] border-l border-line pl-6 max-sm:border-l-0 max-sm:pl-0">{children}</div>
        <aside className="min-w-0 max-w-full flex-[1_1_260px] self-stretch">
          <div className="sticky top-[calc(var(--header-h)+16px)] border border-line bg-[#FBFAF7] px-[22px] py-5">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[.16em] text-gold">On every JetNine quote</p>
            <h2 className="mt-2 font-serif text-[22px] font-normal leading-[1.2]">One all-in number.</h2>
            <ul className="mt-[14px] flex list-none flex-col gap-[9px] p-0">
              {["Flight time and fuel", "Two-pilot crew", "Landing and repositioning", "7.5% Federal Excise Tax", "Standard catering and sedan transfer"].map((c) => (
                <li key={c} className="flex gap-[10px] text-[14px] leading-[1.45]">
                  <span aria-hidden="true" className="mt-[3px] flex h-4 w-4 flex-none items-center justify-center rounded-[2px] border border-gold text-[11px] text-gold">
                    ✓
                  </span>
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-steel">Itemized before you accept: premium catering, de-icing, international handling.</p>
            <Link href="/cost-calculator" className="mt-4 flex h-10 w-full items-center justify-center rounded-[2px] border border-bone bg-white text-[13px] font-bold text-bone hover:text-gold">
              Open the cost calculator →
            </Link>
            <p className="mt-3 text-[12px] text-steel">An estimate is not a booking. The quote you accept is locked.</p>
          </div>
        </aside>
      </section>

      <ChapterNav chapter={chapter} />

      <QuoteLauncher
        context={`guide-${chapter.slug}`}
        heading="Numbers read. Now price yours."
        body="Route, date, and passenger count — the same engine behind every figure in this guide, live on your trip."
      />

      <CtaBand
        title="Start with a clear trip brief."
        body="Share your route, dates and cabin needs."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Contact dispatch", href: "/contact" }}
      />
    </>
  );
}

/** Section block inside a chapter body (rule above, serif title). */
export function ChapterSection({ id, eyebrow, title, children, first = false }: { id: string; eyebrow?: string; title: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <section id={id} className={first ? "" : "mt-9 border-t border-line pt-7"}>
      {eyebrow ? <p className="mb-2 text-[12px] font-bold uppercase tracking-[.18em] text-gold">{eyebrow}</p> : null}
      <h2 className="m-0 font-serif font-normal leading-[1.1]" style={{ fontSize: "clamp(28px, 6vw, 34px)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
