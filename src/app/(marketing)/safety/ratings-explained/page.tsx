import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";

// Safety cluster subpage — plain-language explainer for the third-party
// certifications the /safety pillar requires. How JetNine applies each
// rating quotes the pillar's own policy (Gold floor, Platinum preferred
// and used on 78% of flights, Wingman for intl/ultra, IS-BAO Stage 2).
export const metadata: Metadata = pageMetadata({
  title: "ARG/US, Wyvern & IS-BAO Ratings Explained",
  description:
    "What ARG/US Gold and Platinum, Wyvern Wingman, and IS-BAO Stage 2 actually certify — and how JetNine applies each rating as a floor, not a marketing badge.",
  path: "/safety/ratings-explained",
});

const RATINGS = [
  {
    id: "A/G",
    name: "ARG/US Gold",
    what: "ARG/US (Aviation Research Group/US) is an independent auditor that rates charter operators. Gold means the operator's certificates, insurance, pilots, and aircraft records passed a historical safety analysis — a documented, third-party-checked baseline, not a self-declaration.",
    how: "Our floor. Every operator in the JetNine network holds ARG/US Gold or higher, current — a lapsed audit removes the operator until it's renewed. No exceptions.",
  },
  {
    id: "A/P",
    name: "ARG/US Platinum",
    what: "The highest ARG/US tier. Everything in Gold, plus an on-site audit of the operation itself: emergency-response planning, ground handling, security procedures, and a functioning safety management system observed in practice.",
    how: "Preferred, and what most of our missions actually fly: Platinum operators carry 78% of JetNine flights. When two airframes price alike, the Platinum operator wins the quote.",
  },
  {
    id: "WW",
    name: "Wyvern Wingman",
    what: "Wyvern audits at the trip level, not just the operator level: pilot-specific qualifications, aircraft records, and a real-time risk assessment run for every leg before it flies. It's the difference between 'the operator is safe' and 'this crew, on this airframe, on this route, today, is safe.'",
    how: "Required for international, transoceanic, and ultra-long-range missions. Its per-leg check runs automatically as part of our trip-level review before every booking.",
  },
  {
    id: "IS-2",
    name: "IS-BAO Stage 2",
    what: "The International Standard for Business Aircraft Operations, from the International Business Aviation Council. Stage 2 certifies that a safety management system isn't just written down — it's implemented, audited, and demonstrated working in day-to-day operations.",
    how: "Preferred for large-cabin operators, and accepted alongside Wyvern Wingman as the qualifying standard for international and ultra-long-range flying.",
  },
];

const FAQ = [
  {
    q: "Aren't these badges on every charter site?",
    a: "The logos are; the policy usually isn't. Many brokers display ratings some of their operators hold. The difference worth asking any broker: is the rating a floor (no operator flies without it) or a decoration (some operators happen to have it)? At JetNine, ARG/US Gold is a written floor and the rest are enforced by mission type.",
  },
  {
    q: "What happens when an operator's rating lapses?",
    a: "They stop receiving JetNine missions until the audit is current again. Audit standing is re-verified in the annual document review and checked against the live ARG/US and Wyvern databases at booking time.",
  },
  {
    q: "Which rating matters most for my flight?",
    a: "Domestic light-to-midsize missions fly on the ARG/US Gold floor, most on Platinum operators. Anything international, transoceanic, or ultra-long-range adds the Wyvern Wingman or IS-BAO Stage 2 requirement on top. You don't have to pick — the requirement attaches automatically to the mission profile.",
  },
];

export default function RatingsExplainedPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Safety", item: `${siteUrl}/safety` },
      { "@type": "ListItem", position: 3, name: "Ratings explained", item: `${siteUrl}/safety/ratings-explained` },
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
        kicker="Safety · ratings explained"
        title="What the badges actually certify."
        lead="ARG/US, Wyvern, IS-BAO — every charter site shows the logos. Here's what each rating audits, in plain language, and the difference between displaying a badge and enforcing one."
      />

      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {RATINGS.map((r, i) => (
              <Reveal
                key={r.id}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[auto_1fr_1fr]"
              >
                <div className="flex items-start gap-5 lg:w-[230px]">
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ink-4 bg-ink-2 font-mono text-[12px] tracking-[0.04em] text-clearance">
                    {r.id}
                  </span>
                  <h2 className="font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
                    {r.name}
                  </h2>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — What it certifies
                  </p>
                  <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.65] text-bone-2">{r.what}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — How JetNine applies it
                  </p>
                  <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.65] text-bone-2">{r.how}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="mt-10 max-w-[70ch] text-[15px] leading-[1.6] text-bone-2">
            The full written floor these ratings plug into is on the{" "}
            <Link href="/safety" className="text-clearance">
              safety standards page
            </Link>
            ; the funnel that enforces it is on{" "}
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
              <p className="caption mb-6">— Asked about ratings</p>
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
        heading="Badges enforced, not displayed."
        body="Every quote we return already clears the ratings on this page. Price a mission and see what comes back."
      />
    </>
  );
}
