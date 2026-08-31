import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { GuideShell } from "@/components/guide/guide-shell";
import { RateTable } from "@/components/rate-table";
import { getGuideChapter } from "@/lib/guides";
import { FLEET } from "@/lib/fleet";
import { CRUISE_KT } from "@/lib/quote-pricing";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Cost Per Hour — 2026 Rates",
  description:
    "Hourly charter rates by category, published: $3,200–$3,600 for a light jet up to $10,400–$11,200 for ultra-long-range, what the hour includes, and how block time is counted.",
  path: "/guides/private-jet-cost-per-hour",
});

const chapter = getGuideChapter("private-jet-cost-per-hour")!;

const FAQ = [
  {
    q: "What does the hourly rate include?",
    a: "On a JetNine quote: the airframe, two-pilot crew, fuel, landing fees, repositioning, 7.5% FET, standard catering, and a sedan transfer. Some brokers quote a bare hourly and add those back later — always compare all-in totals, not headline rates.",
  },
  {
    q: "Is billed time the same as time in the air?",
    a: "No — charter is billed on block time: engine start at the departure ramp to shutdown at arrival, so taxi and climb-out count. Our indicative engine pads great-circle flight time for exactly that, which is why its estimates track final quotes closely.",
  },
  {
    q: "Why is a heavy jet three times the hourly of a light jet?",
    a: "Fuel burn scales with airframe size, crews are larger, maintenance reserves are higher, and acquisition costs are in a different bracket. You're paying for range and cabin: a light jet does 3-hour legs for 6–7 people; a heavy does transatlantic legs with two cabin zones for 12.",
  },
];

export default function CostPerHourPage() {
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
      lead="The hourly rate is the industry's real unit of price — and the number most sites hide. Here's ours by category, what the hour includes, and how the meter actually runs."
    >
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— The card</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            Six categories, two rates each.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            Market is what on-demand missions run today; locked is the 24-month fixed rate for
            JetNine Card holders. Either way the quote you accept is all-in and doesn&rsquo;t move.
          </Reveal>
          <div className="mt-12">
            <RateTable />
          </div>
        </div>
      </section>

      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— Rate × speed = the real comparison</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            A cheaper hour isn&rsquo;t always a cheaper trip.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            Categories cruise at different speeds, so the hourly rate alone can mislead: a
            turboprop&rsquo;s lower hourly buys a {CRUISE_KT.turboprop}-knot cruise, while a super-mid
            covers the same ground at {CRUISE_KT.supermid} knots — fewer billed hours on long
            sectors. Rule of thumb: under ~600 NM the cheaper hourly usually wins; past ~1,500 NM
            the faster airframe often costs less all-in, and it always costs less of your day. The
            wizard runs this math per route automatically.
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {FLEET.map((f) => (
              <Reveal key={f.slug} className="rounded-[4px] border border-ink-3 bg-ink p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                  {f.shortName}
                </div>
                <div className="mt-3 font-serif text-[24px] font-light leading-none tracking-tight text-bone">
                  {f.speedKt} kt
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
                  ~{f.rangeNm.toLocaleString()} NM range
                </div>
                <Link
                  href={f.href}
                  className="mt-4 block font-mono text-[10px] uppercase tracking-[0.12em] text-clearance"
                >
                  Rates &amp; specs <span className="arrow">→</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink-3 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about hourly rates</p>
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
