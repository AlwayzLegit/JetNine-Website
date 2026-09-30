import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { SITE } from "@/lib/constants";

// Safety cluster subpage — expands the /safety pillar's vetting funnel
// into a standalone page. Every figure here comes from the pillar
// (5,000 → 380 funnel, 12-month re-audit cycle, one-strike policy);
// this page explains the process, the pillar states the standard.
export const metadata: Metadata = pageMetadata({
  title: "How We Vet Private Jet Operators",
  description:
    "From ~5,000 US Part 135 certificates to 380 approved operators: the certification, insurance, audit, and on-site filters every JetNine operator passes — re-checked every 12 months.",
  path: "/safety/operator-vetting",
});

const STAGES = [
  {
    num: "01",
    name: "The starting universe",
    count: "~5,000",
    body: "Every certificated Part 135 charter operator in the United States. Anyone can broker flights across this whole list — most brokers effectively do. The vetting below is what separates a network from a directory.",
  },
  {
    num: "02",
    name: "Certification & insurance filter",
    count: "~2,100",
    body: "We drop operators with certificate amendments under review, enforcement actions in the last 24 months, insurance below our $300M–$500M hull-and-liability floor, or fewer than five years of continuous Part 135 operation. Financial standing is verified — no bankruptcy, receivership, or repossession events in the last 36 months.",
  },
  {
    num: "03",
    name: "Audit-standing filter",
    count: "~880",
    body: "Below ARG/US Gold, or with a lapsed audit, an operator is out — no exceptions. Any NTSB-reportable event in the last 24 months is disqualifying. For international, transoceanic, and ultra-long-range missions, we additionally require Wyvern Wingman or IS-BAO Stage 2.",
  },
  {
    num: "04",
    name: "On-site visit & chief-pilot review",
    count: "~410",
    body: "Our chief pilot — or a qualified third party applying JetNine standards — walks the maintenance hangar, training facility, and dispatch operation in person. Roughly half the operators that look good on paper don't survive a site visit. That number is why this stage exists.",
  },
  {
    num: "05",
    name: "In the network",
    count: "380",
    body: "Operators currently flying for our clients. Approval isn't permanent: documents are re-reviewed and sites re-visited every twelve months, trip-level checks run before every booking, and random spot-checks plus a crew tip line run continuously. One strike on safety — out.",
  },
];

const FAQ = [
  {
    q: "How often is an approved operator re-checked?",
    a: "On a fixed twelve-month cycle for documents (insurance, audits, rosters, training records, AD/SB compliance) and on-site visits — plus a trip-level review before every booking and continuous random spot-checks. Approval lapses; it is never grandfathered.",
  },
  {
    q: "What gets an operator removed from the network?",
    a: "One safety strike. A lapsed audit, an insurance shortfall, an NTSB-reportable event, or anything our chief pilot flags on a spot-check ends the relationship. We would rather refund an entire trip than fly an aircraft we aren't comfortable with.",
  },
  {
    q: "Does a client request ever override the floor?",
    a: "No. There is no exception process, no rate that justifies a waiver, and no schedule pressure that changes the answer. If the only available aircraft is one we rejected, we'll say so and help you wait or fly commercial.",
  },
];

export default function OperatorVettingPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Safety", item: `${siteUrl}/safety` },
      { "@type": "ListItem", position: 3, name: "Operator vetting", item: `${siteUrl}/safety/operator-vetting` },
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
        eyebrow="Safety · operator vetting"
        title="5,000 operators go in. 380 come out."
        lead="A charter broker's real product is the operators it says no to. This is the funnel every aircraft on a JetNine quote has already passed — and keeps passing, every twelve months."
      />

      <section className="container-jn pt-12">
        <ol className="flex flex-col gap-4">
          {STAGES.map((s) => (
            <li
              key={s.num}
              className="card grid grid-cols-1 gap-5 p-7 max-md:p-5 lg:grid-cols-[64px_220px_minmax(0,1fr)] lg:gap-8"
            >
              <span className="font-serif text-[36px] font-light leading-none text-clearance">
                {s.num}
              </span>
              <div>
                <div className="font-serif text-[36px] font-light leading-none tracking-tight text-bone">
                  {s.count}
                </div>
                <div className="label-jn mt-2">{s.name}</div>
              </div>
              <p className="max-w-[64ch] text-[16px] leading-[1.6] text-bone-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-[70ch] text-[16px] leading-[1.6] text-bone-2">
          The written floor behind these filters — certification, audit standing, pilot
          qualification, insurance, maintenance, safety record, operator stability — is published
          in full on the{" "}
          <Link href="/safety" className="text-link-strong">
            safety standards page
          </Link>
          . What the certifications themselves mean is on{" "}
          <Link href="/safety/ratings-explained" className="text-link-strong">
            ratings, explained
          </Link>
          .
        </p>
      </section>

      <section className="container-jn section-jn max-md:pt-20">
        <h2 className="eyebrow">Asked about vetting</h2>
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
        title="Fly the 380, not the 5,000."
        body="Every quote we return is an aircraft that already passed this page. Price a trip and see."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
