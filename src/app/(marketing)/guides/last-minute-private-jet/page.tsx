import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getGuideChapter } from "@/lib/guides";
import { getShortGuide } from "@/lib/guides-short";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";
import { ShortGuideTemplate } from "@/components/guide-short/guide-template";
import { ChapterBody, ChapterEyebrow, ChapterNav } from "@/components/guide-short/chapter-bits";
import { GuideJsonLd, faqJsonLd } from "@/components/guide-short/schema";

export const metadata: Metadata = pageMetadata({
  title: "Last-Minute Private Jet Charter — Cost & Reality",
  description:
    "Same-day and next-day charter is routine, not a splurge: what actually changes about the price, what changes about availability, and why an empty leg can make late the cheapest way to fly.",
  path: "/guides/last-minute-private-jet",
});

const chapter = getGuideChapter("last-minute-private-jet")!;
// Light handoff "Guide 14" content (sections, table, checklist, sources…).
const guide = getShortGuide("last-minute-private-jet")!;

const FAQ = [
  {
    q: "How fast can a charter actually depart?",
    a: "With passports, crew duty time, and an aircraft in position, wheels-up in as little as a few hours is realistic at major markets. The quote itself is faster: JetNine returns three to five real aircraft with all-in pricing within 30 minutes during operating hours, and the dispatch line answers around the clock.",
  },
  {
    q: "Does booking late always cost more?",
    a: "No — that's airline intuition, and charter doesn't price like airlines. The rate card doesn't change with the calendar. What changes is selection: fewer aircraft in position means the cheapest category for your mission may be gone, or a repositioning fee appears. Late on a busy lane often prices exactly like booking a month out.",
  },
  {
    q: "What's the cheapest last-minute play?",
    a: "An empty leg. Repositioning flights are inherently short-notice inventory — most list within days of departure at 30–60% off. If your dates were already loose, last-minute isn't a penalty; it's the discount window. The SMS watchlist is built for exactly this.",
  },
];

// The design's FAQ, minus the two questions the chapter already answers
// (departure speed, empty legs).
const DESIGN_FAQ = guide.faq.filter(
  (f) => !/how quickly can a private jet depart|empty legs suitable/i.test(f.q),
);

const ALL_FAQ = [...FAQ, ...DESIGN_FAQ];

export default function LastMinutePage() {
  return (
    <>
      <GuideJsonLd
        headline={chapter.title}
        description={chapter.description}
        path={chapter.href}
        crumb={chapter.navTitle}
        datePublished="2026-08-31"
        dateModified="2026-10-05"
        isPartOf={{
          "@type": "CreativeWorkSeries",
          name: "The JetNine Charter Pricing Guide",
          url: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "")}/guides`,
        }}
        extra={[faqJsonLd(ALL_FAQ)]}
      />
      <ShortGuideTemplate
        guide={guide}
        title={chapter.title}
        crumb={chapter.navTitle}
        dek="Charter exists for exactly this. The rate card doesn't punish late — availability does. What actually changes inside a same-day quote, and the one case where late is the discount."
        eyebrow={<ChapterEyebrow chapter={chapter} />}
        byline={<>By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly</>}
        faq={ALL_FAQ}
        context={`guide-${chapter.slug}`}
        extra={
          <ChapterBody
            eyebrow="What changes when it’s tomorrow"
            title="Not the rate. The map."
            cards={[
              {
                n: "01",
                k: "Price",
                h: "The hourly rate holds.",
                p: "Charter isn't yield-managed like an airline seat — the category rates on our card are the rates, tonight or next month. Card holders' locked rates apply with zero peak-day surcharges; on-demand quotes come off the same market card either way.",
              },
              {
                n: "02",
                k: "Availability",
                h: "Position is everything.",
                p: "What tightens late is which aircraft are near your departure airport with a legal, rested crew. Sometimes that's the exact category you wanted; sometimes the honest quote is one category up, or a short repositioning line on the invoice. Dispatch tells you which before you commit.",
              },
              {
                n: "03",
                k: "The flip side",
                h: "Late is when the discounts live.",
                p: "Empty legs are short-notice by nature — repositioning flights listed days or hours before departure at 30–60% off. A flexible traveler booking late isn't paying a premium; they're shopping the best-priced inventory in the market.",
              },
            ]}
          >
            The practical playbook: run the{" "}
            <Link href="/quote/mission" className="text-link-strong">
              wizard
            </Link>{" "}
            the moment the trip is real — thirty minutes to firm aircraft — and check the{" "}
            <Link href="/empty-legs" className="text-link-strong">
              live empty-legs board
            </Link>{" "}
            in parallel. Truly time-critical? Skip both and call {SITE.dispatchPhone}: average pick-up is under
            twenty seconds, every hour of every day, and &ldquo;first call wins&rdquo; is literal on board
            inventory.
          </ChapterBody>
        }
        after={<ChapterNav chapter={chapter} />}
      />
    </>
  );
}
