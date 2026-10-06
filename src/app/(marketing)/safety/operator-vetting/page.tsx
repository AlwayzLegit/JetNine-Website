import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { FaqList } from "@/components/company/faq-list";
import { DisclosureStrip, GoDeeper, SafetyClose, SafetyHero, SourcesRow } from "@/components/safety/parts";

// Safety cluster subpage — expands the /safety pillar's vetting funnel
// into a standalone page. Every figure here comes from the pillar
// (5,000 → 380 funnel, 12-month re-audit cycle, one-strike policy);
// this page explains the process, the pillar states the standard.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Operator Vetting — Safety Checks",
  description:
    "See how JetNine reviews charter operators, including operating certificates, insurance, independent safety audits, site visits and recurring checks.",
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

      <SafetyHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Safety", href: "/safety" }, { label: "Operator vetting" }]}
        title="5,000 operators go in. 380 come out."
        subtitle="How JetNine vets private jet operators."
        body="A charter broker’s real product is the operators it says no to. This is the funnel every aircraft on a JetNine quote has already passed — and keeps passing, every twelve months."
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
        imageSrc="/images/light/six-02-maintenance-hangar.webp"
      />
      <DisclosureStrip />

      <section className="container-jn pt-7">
        <h2 className="font-serif text-[32px] leading-[1.1]">Five stages, every operator.</h2>
        <p className="mt-1 text-[15px] text-steel">The network&rsquo;s published funnel, re-run every twelve months.</p>
        <ol className="mt-[14px] flex list-none flex-col border border-line bg-white p-0">
          {STAGES.map((s) => (
            <li key={s.num} className="grid gap-x-8 gap-y-3 border-b border-line px-5 py-[18px] last:border-b-0 lg:grid-cols-[56px_200px_minmax(0,1fr)] max-sm:px-4">
              <span className="font-serif text-[34px] leading-none text-gold">{s.num}</span>
              <div>
                <div className="font-serif text-[32px] leading-none">{s.count}</div>
                <div className="mt-2 text-[13px] font-bold">{s.name}</div>
              </div>
              <p className="max-w-[64ch] text-[14px] leading-[1.6] text-steel">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-[70ch] text-[14px] leading-[1.6] text-steel">
          The written floor behind these filters — certification, audit standing, pilot qualification, insurance, maintenance, safety
          record, operator stability — is published in full on the{" "}
          <Link href="/safety#standard" className="text-link text-bone">safety standards page</Link>. What the certifications themselves
          mean is on <Link href="/safety/ratings-explained" className="text-link text-bone">ratings, explained</Link>.
        </p>
      </section>

      <section className="container-jn pt-[30px]">
        <h2 className="font-serif text-[32px] leading-[1.1]">Asked about vetting.</h2>
        <FaqList className="mt-3" joined items={FAQ} />
      </section>

      <SourcesRow />
      <GoDeeper current="/safety/operator-vetting" />
      <SafetyClose title="Fly the 380, not the 5,000." label="Request a quote" />
    </>
  );
}
