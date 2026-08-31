import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";

// Safety cluster subpage — expands the pilot-qualification line of the
// /safety floor (item 03) into a standalone page. All minimums quoted
// here are the pillar's own published numbers.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Pilot Standards — Crew Minimums",
  description:
    "Two ATP-rated pilots on every JetNine flight: 3,500-hour PIC minimum with 1,500 in-type, 2,500-hour SIC, 90-day currency. No exceptions for daylight, short legs, or VFR.",
  path: "/safety/pilot-standards",
});

const STANDARDS = [
  {
    num: "01",
    k: "TWO PILOTS, ALWAYS",
    h: "Two ATP-rated pilots, in-type, on every flight.",
    p: "The Airline Transport Pilot certificate is the FAA's highest — the same license the airlines require of a captain. Both seats on a JetNine flight hold one, and both pilots are rated on the specific aircraft type they're flying, not just the class.",
  },
  {
    num: "02",
    k: "HOURS FLOOR",
    h: "3,500 hours minimum for the pilot-in-command. 1,500 in-type.",
    p: "The second-in-command holds a 2,500-hour minimum. For context, an airline first officer can be hired at 1,500 total hours — our SIC floor exceeds it, and our PIC floor more than doubles it. Preferred operators field PICs above 5,000 hours.",
  },
  {
    num: "03",
    k: "CURRENCY",
    h: "Both pilots current on the aircraft within 90 days.",
    p: "Currency is checked at the operator level during the annual audit and again at the trip level before every booking — along with duty-time limits, so a crew that's legal on paper but fatigued in practice doesn't fly.",
  },
  {
    num: "04",
    k: "NO CARVE-OUTS",
    h: "No exceptions for daylight, short-leg, or VFR conditions.",
    p: "Minimums that flex with the weather aren't minimums. A twenty-minute repositioning hop in clear skies is crewed to the same standard as a transatlantic night crossing — and legs over 8 hours block-time get an augmented crew on preferred operators.",
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
    a: "Yes. An empty leg is the same airframe, the same operator, and the same crew standard as a full-price charter — the discount comes from the repositioning economics, never from the safety floor.",
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

      <PageHeader
        kicker="Safety · pilot standards"
        title="Who's flying you, exactly."
        lead="Aircraft get the photographs; crews decide the outcome. These are the pilot minimums behind every JetNine flight — written, audited annually, and re-checked before each booking."
      />

      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {STANDARDS.map((c, i) => (
              <Reveal
                key={c.num}
                stagger={(i % 3) as 0 | 1 | 2}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-10"
              >
                <div className="mb-6 flex items-baseline gap-4">
                  <span className="font-mono text-[42px] font-light leading-none text-clearance">
                    {c.num}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                    — {c.k}
                  </span>
                </div>
                <h2 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {c.h}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 max-w-[70ch] text-[15px] leading-[1.6] text-bone-2">
            Pilot qualification is one line of a seven-part floor — certification, audit standing,
            insurance, maintenance, safety record, and operator stability are published on the{" "}
            <Link href="/safety" className="text-clearance">
              safety standards page
            </Link>
            , and the process that enforces them is on{" "}
            <Link href="/safety/operator-vetting" className="text-clearance">
              operator vetting
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Asked about crews</p>
            </Reveal>
          </div>
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

      <ClosingCTA
        heading="The crew standard rides on every quote."
        body="Price a mission — the airframes that come back already meet everything on this page."
      />
    </>
  );
}
