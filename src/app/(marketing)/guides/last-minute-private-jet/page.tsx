import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { GuideShell } from "@/components/guide/guide-shell";
import { getGuideChapter } from "@/lib/guides";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Last-Minute Private Jet Charter — Cost & Reality",
  description:
    "Same-day and next-day charter is routine, not a splurge: what actually changes about the price, what changes about availability, and why an empty leg can make late the cheapest way to fly.",
  path: "/guides/last-minute-private-jet",
});

const chapter = getGuideChapter("last-minute-private-jet")!;

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

export default function LastMinutePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <GuideShell
      chapter={chapter}
      lead="Charter exists for exactly this. The rate card doesn't punish late — availability does. What actually changes inside a same-day quote, and the one case where late is the discount."
    >
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">What changes when it&rsquo;s tomorrow</p>
          <h2 className="title-section max-w-[26ch]">Not the rate. The map.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
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
            ].map((c) => (
              <div key={c.n} className="card card-pad max-md:p-5">
                <div className="mb-5 flex items-baseline gap-4">
                  <span className="font-serif text-[48px] font-light leading-none text-clearance">{c.n}</span>
                  <span className="label-jn">{c.k}</span>
                </div>
                <h3 className="title-card-sm text-bone">{c.h}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-bone-2">{c.p}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            The practical playbook: run the{" "}
            <Link href="/quote/mission" className="text-link-strong">
              wizard
            </Link>{" "}
            the moment the trip is real — thirty minutes to firm aircraft — and check the{" "}
            <Link href="/empty-legs" className="text-link-strong">
              live empty-legs board
            </Link>{" "}
            in parallel. Truly time-critical? Skip both and call {SITE.dispatchPhone}: average
            pick-up is under twenty seconds, every hour of every day, and &ldquo;first call wins&rdquo; is
            literal on board inventory.
          </p>
        </div>
      </section>

      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Asked about short notice.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FAQ.map((f) => (
              <div key={f.q} className="card card-pad max-md:p-5">
                <h3 className="title-card-sm text-bone">{f.q}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-bone-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
