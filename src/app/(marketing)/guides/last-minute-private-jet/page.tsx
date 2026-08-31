import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
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
    a: "With passports, crew duty time, and an airframe in position, wheels-up in as little as a few hours is realistic at major markets. The quote itself is faster: JetNine returns three to five real airframes with all-in pricing within 30 minutes during operating hours, and the dispatch line answers around the clock.",
  },
  {
    q: "Does booking late always cost more?",
    a: "No — that's airline intuition, and charter doesn't price like airlines. The rate card doesn't change with the calendar. What changes is selection: fewer airframes in position means the cheapest category for your mission may be gone, or a repositioning fee appears. Late on a busy lane often prices exactly like booking a month out.",
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

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— What changes when it&rsquo;s tomorrow</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            Not the rate. The map.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                k: "PRICE",
                h: "The hourly rate holds.",
                p: "Charter isn't yield-managed like an airline seat — the category rates on our card are the rates, tonight or next month. Card holders' locked rates apply with zero peak-day surcharges; on-demand quotes come off the same market card either way.",
              },
              {
                n: "02",
                k: "AVAILABILITY",
                h: "Position is everything.",
                p: "What tightens late is which airframes are near your departure airport with a legal, rested crew. Sometimes that's the exact category you wanted; sometimes the honest quote is one category up, or a short repositioning line on the invoice. Dispatch tells you which before you commit.",
              },
              {
                n: "03",
                k: "THE FLIP SIDE",
                h: "Late is when the discounts live.",
                p: "Empty legs are short-notice by nature — repositioning flights listed days or hours before departure at 30–60% off. A flexible traveler booking late isn't paying a premium; they're shopping the best-priced inventory in the market.",
              },
            ].map((c, i) => (
              <Reveal key={c.n} stagger={(i % 3) as 0 | 1 | 2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-10">
                <div className="mb-6 flex items-baseline gap-4">
                  <span className="font-mono text-[42px] font-light leading-none text-clearance">{c.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">— {c.k}</span>
                </div>
                <h3 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">{c.h}</h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            The practical playbook: run the{" "}
            <Link href="/quote/mission" className="text-clearance">
              wizard
            </Link>{" "}
            the moment the trip is real — thirty minutes to firm airframes — and check the{" "}
            <Link href="/empty-legs" className="text-clearance">
              live empty-legs board
            </Link>{" "}
            in parallel. Truly time-critical? Skip both and call {SITE.dispatchPhone}: average
            pick-up is under twenty seconds, every hour of every day, and &ldquo;first call wins&rdquo; is
            literal on board inventory.
          </p>
        </div>
      </section>

      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about short notice</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-3">
            {FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
