import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { FaqList } from "@/components/company/faq-list";
import { DisclosureStrip, GoDeeper, SafetyClose, SafetyHero, SourcesRow } from "@/components/safety/parts";

// Safety cluster subpage — expands the pilot line of the /safety floor
// into a standalone page. All minimums quoted here are the pillar's own
// published numbers.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Pilot Standards — Experience & Training",
  description:
    "Review JetNine’s charter pilot standards, including ATP certification, flight experience, aircraft type ratings, recent flying experience and duty-time checks.",
  path: "/safety/pilot-standards",
});

const STANDARDS = [
  {
    num: "01",
    k: "Two pilots, always",
    h: "Two ATP-rated pilots, in-type, on every flight.",
    p: "The Airline Transport Pilot certificate is the FAA's highest — the same license the airlines require of a captain. Both seats on a JetNine flight hold one, and both pilots are rated on the specific aircraft type they're flying, not just the class.",
  },
  {
    num: "02",
    k: "Hours floor",
    h: "3,500 hours minimum for the captain. 1,500 in-type.",
    p: "The co-pilot holds a 2,500-hour minimum. For context, an airline first officer can be hired at 1,500 total hours — our co-pilot floor exceeds it, and our captain floor more than doubles it. Preferred operators field captains above 5,000 hours.",
  },
  {
    num: "03",
    k: "Currency",
    h: "Both pilots current on the aircraft within 90 days.",
    p: "Currency is checked at the operator level during the annual audit and again at the trip level before every booking — along with duty-time limits, so a crew that's legal on paper but fatigued in practice doesn't fly.",
  },
  {
    num: "04",
    k: "No carve-outs",
    h: "No exceptions for daylight, short-leg, or clear-weather conditions.",
    p: "Minimums that flex with the weather aren't minimums. A twenty-minute repositioning hop in clear skies is crewed to the same standard as a transatlantic night crossing — and legs over 8 hours get an extra crew member on preferred operators.",
  },
];

const FAQ = [
  {
    q: "Who verifies the pilot records?",
    a: "The operator's rosters, training records, and type-rating proofs are reviewed in the annual document audit, and Wyvern Wingman runs pilot-specific qualification checks at the trip level for missions that require it. Duty time and currency are confirmed before every booking.",
  },
  {
    q: "What is an ATP certificate?",
    a: "The Airline Transport Pilot certificate — the FAA's highest pilot certification, required to captain a scheduled airline flight. Both pilots on a JetNine mission hold one; many charter operators only require it of the captain.",
  },
  {
    q: "Do these standards apply to empty legs too?",
    a: "Yes. An empty leg is the same aircraft, the same operator, and the same crew standard as a full-price charter — the discount comes from the repositioning economics, never from the safety floor.",
  },
];

export default function PilotStandardsPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Safety", item: `${siteUrl}/safety` },
      { "@type": "ListItem", position: 3, name: "Pilot standards", item: `${siteUrl}/safety/pilot-standards` },
    ],
  };
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
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SafetyHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Safety", href: "/safety" }, { label: "Pilot standards" }]}
        title="Who’s flying you, exactly."
        subtitle="Private jet pilot standards."
        body="Aircraft get the photographs; crews decide the outcome. These are the pilot minimums behind every JetNine flight — written, audited annually, and re-checked before each booking."
        actions={
          <>
            <Link href="/quote/mission" className="btn h-[42px] border-gold bg-gold !text-[14px] !font-bold text-white hover:bg-[#6b4c2b]">
              Request a quote →
            </Link>
            <Link href="/safety" className="btn h-[42px] !border-bone bg-transparent !text-[14px] !font-bold text-bone hover:bg-surface-2">
              The full safety standard
            </Link>
          </>
        }
        imageSrc="/images/light/cockpit.webp"
      />
      <DisclosureStrip />

      <section className="container-jn pt-7">
        <h2 className="font-serif text-[32px] leading-[1.1]">Four crew minimums.</h2>
        <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
          {STANDARDS.map((c) => (
            <div key={c.num} className="border border-t-2 border-line border-t-gold bg-white px-5 py-[18px]">
              <div className="flex items-baseline gap-4">
                <span className="font-serif text-[34px] leading-none text-gold">{c.num}</span>
                <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-gold">{c.k}</span>
              </div>
              <h2 className="mt-3 font-serif text-[22px] leading-[1.2]">{c.h}</h2>
              <p className="mt-2 text-[14px] leading-[1.6] text-steel">{c.p}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[70ch] text-[14px] leading-[1.6] text-steel">
          Pilot qualification is one line of a seven-part floor — certification, audit standing, insurance, maintenance, safety record,
          and operator stability are published on the{" "}
          <Link href="/safety#standard" className="text-link text-bone">safety standards page</Link>, and the process that enforces them
          is on <Link href="/safety/operator-vetting" className="text-link text-bone">operator vetting</Link>.
        </p>
      </section>

      <section className="container-jn pt-[30px]">
        <h2 className="font-serif text-[32px] leading-[1.1]">Asked about crews.</h2>
        <FaqList className="mt-3" joined items={FAQ} />
      </section>

      <SourcesRow />
      <GoDeeper current="/safety/pilot-standards" />
      <SafetyClose title="The crew standard rides on every quote." label="Request a quote" />
    </>
  );
}
