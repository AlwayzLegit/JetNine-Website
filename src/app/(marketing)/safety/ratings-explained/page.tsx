import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { SITE } from "@/lib/constants";

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
    name: "ARG/US Gold",
    role: "Minimum · all operators",
    what: "ARG/US (Aviation Research Group/US) is an independent auditor that rates charter operators. Gold means the operator's certificates, insurance, pilots, and aircraft records passed a historical safety analysis — a documented, third-party-checked baseline, not a self-declaration.",
    how: "Our floor. Every operator in the JetNine network holds ARG/US Gold or higher, current — a lapsed audit removes the operator until it's renewed. No exceptions.",
  },
  {
    name: "ARG/US Platinum",
    role: "Preferred · 78% of flights",
    what: "The highest ARG/US tier. Everything in Gold, plus an on-site audit of the operation itself: emergency-response planning, ground handling, security procedures, and a functioning safety management system observed in practice.",
    how: "Preferred, and what most of our missions actually fly: Platinum operators carry 78% of JetNine flights. When two aircraft price alike, the Platinum operator wins the quote.",
  },
  {
    name: "Wyvern Wingman",
    role: "Required · international & ultra long range",
    what: "Wyvern audits at the trip level, not just the operator level: pilot-specific qualifications, aircraft records, and a real-time risk assessment run for every leg before it flies. It's the difference between 'the operator is safe' and 'this crew, on this aircraft, on this route, today, is safe.'",
    how: "Required for international, transoceanic, and ultra-long-range missions. Its per-leg check runs automatically as part of our trip-level review before every booking.",
  },
  {
    name: "IS-BAO Stage 2",
    role: "Preferred · large cabin",
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

      <PageHero
        eyebrow="Safety · ratings explained"
        title="What the badges actually certify."
        lead="ARG/US, Wyvern, IS-BAO — every charter site shows the logos. Here's what each rating audits, in plain language, and the difference between displaying a badge and enforcing one."
      />

      <section className="container-jn pt-12">
        <ul className="flex flex-col gap-4">
          {RATINGS.map((r) => (
            <li
              key={r.name}
              className="card grid grid-cols-1 gap-6 p-7 max-md:p-5 lg:grid-cols-[230px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8"
            >
              <div>
                <h2 className="text-[22px] font-medium leading-[1.25] text-bone">{r.name}</h2>
                <p className="mt-1 text-[13px] font-semibold text-gold">{r.role}</p>
              </div>
              <div>
                <p className="label-jn">What it certifies</p>
                <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.6] text-bone-2">{r.what}</p>
              </div>
              <div>
                <p className="label-jn">How JetNine applies it</p>
                <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.6] text-bone-2">{r.how}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-[70ch] text-[16px] leading-[1.6] text-bone-2">
          The full written floor these ratings plug into is on the{" "}
          <Link href="/safety" className="text-link-strong">
            safety standards page
          </Link>
          ; the funnel that enforces it is on{" "}
          <Link href="/safety/operator-vetting" className="text-link-strong">
            operator vetting
          </Link>
          .
        </p>
      </section>

      <section className="container-jn section-jn max-md:pt-20">
        <h2 className="eyebrow">Asked about ratings</h2>
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
        title="Badges enforced, not displayed."
        body="Every quote we return already clears the ratings on this page. Price a trip and see what comes back."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
