import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { RateTable } from "@/components/rate-table";
import { getGuideChapter } from "@/lib/guides";
import { FLEET } from "@/lib/fleet";
import { CRUISE_KT } from "@/lib/quote-pricing";
import { ChapterSection, ChapterShell } from "@/components/guide-long/chapter-shell";
import { FaqJsonLd, FaqList } from "@/components/guide-long/faq";
import { AutoGrid } from "@/components/guide-long/ui";

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
    a: "On a JetNine quote: the aircraft, two-pilot crew, fuel, landing fees, repositioning, 7.5% FET, standard catering, and a sedan transfer. Some brokers quote a bare hourly and add those back later — always compare all-in totals, not headline rates.",
  },
  {
    q: "Is billed time the same as time in the air?",
    a: "No — charter is billed on block time: engine start at the departure ramp to shutdown at arrival, so taxi and climb-out count. Our indicative engine pads great-circle flight time for exactly that, which is why its estimates track final quotes closely.",
  },
  {
    q: "Why is a heavy jet three times the hourly of a light jet?",
    a: "Fuel burn scales with aircraft size, crews are larger, maintenance reserves are higher, and acquisition costs are in a different bracket. You're paying for range and cabin: a light jet does 3-hour legs for 6–7 people; a heavy does transatlantic legs with two cabin zones for 12.",
  },
];

export default function CostPerHourPage() {
  return (
    <ChapterShell
      chapter={chapter}
      crumb="Cost per hour"
      subtitle="The hourly rate, by category — and what the hour includes."
      lead="The hourly rate is the industry's real unit of price — and the number most sites hide. Here's ours by category, what the hour includes, and how the meter actually runs."
      image="/images/light/cabin-midsize.webp"
      toc={[
        { label: "The rate card", href: "#card" },
        { label: "Rate × speed", href: "#speed" },
        { label: "Questions", href: "#faqs" },
      ]}
    >
      <FaqJsonLd items={FAQ} />

      <ChapterSection id="card" eyebrow="The card" title="Six categories, two rates each." first>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
          Market is what on-demand missions run today; locked is the 24-month fixed rate for JetNine Card holders. Either way
          the quote you accept is all-in and doesn&rsquo;t move.
        </p>
        <div className="mt-6">
          <RateTable />
        </div>
      </ChapterSection>

      <ChapterSection id="speed" eyebrow="Rate × speed = the real comparison" title="A cheaper hour isn’t always a cheaper trip.">
        <p className="mt-3 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
          Categories cruise at different speeds, so the hourly rate alone can mislead: a turboprop&rsquo;s lower hourly buys a{" "}
          {CRUISE_KT.turboprop}-knot cruise, while a super-mid covers the same ground at {CRUISE_KT.supermid} knots — fewer
          billed hours on long legs. Rule of thumb: under about 600 nm the cheaper hourly usually wins; past about 1,500 nm
          the faster aircraft often costs less all-in, and it always costs less of your day. The wizard runs this math per
          route automatically.
        </p>
        <AutoGrid min={150} className="mt-6">
          {FLEET.map((f) => (
            <Link key={f.slug} href={f.href} className="group flex flex-col border border-line bg-white p-4 text-bone hover:border-gold hover:text-bone">
              <span className="text-[12px] font-bold uppercase tracking-[.14em] text-gold">{f.shortName}</span>
              <span className="mt-3 font-serif text-[28px] leading-none tracking-tight">{f.speedKt} kt</span>
              <span className="mt-2 text-[13px] text-bone-2">About {nmFormat.format(f.rangeNm)} nm range</span>
              <span className="mt-3 text-[13px] font-semibold group-hover:text-gold">
                Rates &amp; specs <span className="arrow">→</span>
              </span>
            </Link>
          ))}
        </AutoGrid>
      </ChapterSection>

      <ChapterSection id="faqs" eyebrow="Questions" title="Asked about hourly rates.">
        <FaqList items={FAQ} name="per-hour-faq" className="mt-5" />
        <p className="mt-6 text-[14px] text-steel">
          Fees beyond the hourly rate are covered in{" "}
          <Link href="/guides/private-jet-charter-fees" className="text-link-strong">
            charter fees and additional charges
          </Link>
          .
        </p>
      </ChapterSection>
    </ChapterShell>
  );
}
