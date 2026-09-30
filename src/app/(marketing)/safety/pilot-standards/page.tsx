import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { SITE } from "@/lib/constants";

// Safety cluster subpage — expands the pilot line of the /safety floor
// into a standalone page. All minimums quoted here are the pillar's own
// published numbers.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Pilot Standards — Crew Minimums",
  description:
    "Two ATP-rated pilots on every JetNine flight: 3,500-hour PIC minimum with 1,500 in-type, 2,500-hour SIC, 90-day currency. No exceptions for daylight, short legs, or VFR.",
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

      <PageHero
        eyebrow="Safety · pilot standards"
        title="Who's flying you, exactly."
        lead="Aircraft get the photographs; crews decide the outcome. These are the pilot minimums behind every JetNine flight — written, audited annually, and re-checked before each booking."
      />

      <section className="container-jn pt-12">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STANDARDS.map((c) => (
            <div key={c.num} className="card card-pad">
              <div className="mb-5 flex items-baseline gap-4">
                <span className="font-serif text-[42px] font-light leading-none text-clearance">
                  {c.num}
                </span>
                <span className="label-jn">{c.k}</span>
              </div>
              <h2 className="title-card-sm text-bone">{c.h}</h2>
              <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[70ch] text-[16px] leading-[1.6] text-bone-2">
          Pilot qualification is one line of a seven-part floor — certification, audit standing,
          insurance, maintenance, safety record, and operator stability are published on the{" "}
          <Link href="/safety" className="text-link-strong">
            safety standards page
          </Link>
          , and the process that enforces them is on{" "}
          <Link href="/safety/operator-vetting" className="text-link-strong">
            operator vetting
          </Link>
          .
        </p>
      </section>

      <section className="container-jn section-jn max-md:pt-20">
        <h2 className="eyebrow">Asked about crews</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FAQ.map((f) => (
            <div key={f.q} className="card card-pad">
              <h3 className="title-card-sm text-bone">{f.q}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand
        title="The crew standard rides on every quote."
        body="Price a trip — the aircraft that come back already meet everything on this page."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
