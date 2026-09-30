import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
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
const nmFormat = new Intl.NumberFormat("en-US");

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

      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">The card</p>
          <h2 className="title-section max-w-[26ch]">Six categories, two rates each.</h2>
          <p className="mt-5 max-w-[68ch] text-[17px] leading-[1.6] text-bone-2">
            Market is what on-demand missions run today; locked is the 24-month fixed rate for
            JetNine Card holders. Either way the quote you accept is all-in and doesn&rsquo;t move.
          </p>
          <div className="mt-8">
            <RateTable />
          </div>
        </div>
      </section>

      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Rate × speed = the real comparison</p>
          <h2 className="title-section max-w-[26ch]">A cheaper hour isn&rsquo;t always a cheaper trip.</h2>
          <p className="mt-5 max-w-[68ch] text-[17px] leading-[1.6] text-bone-2">
            Categories cruise at different speeds, so the hourly rate alone can mislead: a
            turboprop&rsquo;s lower hourly buys a {CRUISE_KT.turboprop}-knot cruise, while a super-mid
            covers the same ground at {CRUISE_KT.supermid} knots — fewer billed hours on long
            legs. Rule of thumb: under about 600 nm the cheaper hourly usually wins; past about
            1,500 nm the faster aircraft often costs less all-in, and it always costs less of your
            day. The wizard runs this math per route automatically.
          </p>
          <div className="-mx-5 mt-8 flex gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-6">
            {FLEET.map((f) => (
              <Link key={f.slug} href={f.href} className="card card-pad group min-w-[200px] md:min-w-0 max-md:p-5">
                <div className="label-jn">{f.shortName}</div>
                <div className="mt-3 font-serif text-[28px] font-light leading-none tracking-tight text-bone">
                  {f.speedKt} kt
                </div>
                <div className="mt-2 text-[14px] text-bone-2">About {nmFormat.format(f.rangeNm)} nm range</div>
                <span className="mt-4 block text-[15px] font-medium text-bone">
                  Rates &amp; specs <span className="arrow">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Asked about hourly rates.</h2>
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
