import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { FloorAccordion, type FloorItem } from "@/components/safety/floor-accordion";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Safety — ARG/US & Wyvern Vetting",
  description:
    "Private jet safety at JetNine: every operator vetted against a written floor — ARG/US or Wyvern audited, re-checked every twelve months, spot-checked between.",
  path: "/safety",
});

const ACCREDITATIONS = [
  { name: "ARG/US Gold", role: "Minimum · all operators", desc: "Aviation Research Group. The standard accreditation for serious charter — historical safety audit and operator profile." },
  { name: "ARG/US Platinum", role: "Preferred · 78% of flights", desc: "Highest ARG/US tier. On-site audit plus emergency-response, ground-handling and security review." },
  { name: "Wyvern Wingman", role: "Required · international & ultra long range", desc: "Pilot-specific qualifications, trip-level safety review, real-time risk assessment for every leg." },
  { name: "IS-BAO Stage 2", role: "Preferred · large cabin", desc: "International Standard for Business Aircraft Operations. Safety management system implemented, audited, and demonstrated in operation." },
];

// Funnel counts are the pillar's published numbers; bar width is
// count / 5,000 (the starting universe).
const FUNNEL_TOP = 5000;
const FUNNEL = [
  { name: "All US licensed charter operators", desc: "Every certificated charter operator in the country. The starting universe before any filter.", count: "~5,000", n: 5000, unit: "certificates", highlight: false },
  { name: "After certification & insurance filter", desc: "Drop operators with certificate amendments, insurance below threshold, or fewer than five years continuous operation.", count: "~2,100", n: 2100, unit: "remaining", highlight: false },
  { name: "After audit-standing filter", desc: "Drop operators below ARG/US Gold or with lapsed audits. Drop any operator with an NTSB-reportable event in the last 24 months.", count: "~880", n: 880, unit: "remaining", highlight: false },
  { name: "After on-site visit & chief-pilot review", desc: "In-person hangar & ops walk-through. Roughly half the operators that look good on paper don't survive a site visit.", count: "~410", n: 410, unit: "remaining", highlight: false },
  { name: "JetNine approved operators", desc: "Operators currently flying for our clients. Re-audited every 12 months, spot-checked continuously, with a one-strike policy on safety events.", count: "380", n: 380, unit: "in network today", highlight: true },
];

const FLOOR: FloorItem[] = [
  { area: "Certification", lead: "Licensed and unblemished — a current FAA Part 135 certificate.", body: "No suspensions, no enforcement actions, no certificate amendments under review in the last 24 months. Foreign equivalents must be verified by recognized aviation authority.", preferred: "ICAO Annex 6 Part II compliance for cross-border missions." },
  { area: "Audit standing", lead: "ARG/US Gold or higher; current.", body: "Audit cannot have lapsed. Wyvern Wingman or IS-BAO Stage 2 required for international, transoceanic, and ultra-long-range missions.", preferred: "ARG/US Platinum + Wyvern Wingman dual rating." },
  { area: "Pilots", lead: "Two fully licensed pilots, experienced on that aircraft, on every flight.", body: "Captain minimum 3,500 total hours, 1,500 hours in-type. Co-pilot minimum 2,500 total hours. Both current on aircraft within 90 days. No exceptions for daylight, short-leg, or clear-weather conditions.", preferred: "Captain 5,000+ hours, extra crew on legs over 8 hours." },
  { area: "Insurance", lead: "$300M minimum hull-and-liability for light through midsize.", body: "$500M minimum for super-mid through ultra. Policy must be primary, not contingent on a fractional or fleet umbrella. Certificate provided to JetNine in advance of every booking.", preferred: "$500M+ across the board, AM Best A or higher carrier." },
  { area: "Maintenance", lead: "A continuous, tracked maintenance program — nothing deferred at dispatch.", body: "All inspections current within manufacturer-recommended intervals (not regulatory minimums). Aircraft must have completed a full phase inspection within the last 12 months.", preferred: "Factory-authorized service center, single-fleet operator." },
  { area: "Safety record", lead: "No significant event in the last 24 months.", body: "No fatal accidents in the last 60 months. No NTSB-reportable incidents under review. FAA enforcement history reviewed back five years; any enforcement action is grounds for rejection unless cleared by our chief pilot.", preferred: "Zero NTSB-reportable events lifetime, fleet-wide." },
  { area: "Operator stability", lead: "Minimum 5 years in continuous charter operation.", body: "Verified financial standing — no bankruptcy, receivership, or aircraft repossession events in the last 36 months. Single-fleet operators preferred over fragmented brokers re-selling under their certificate.", preferred: "Founder-owned, over 15 years in operation." },
];

const CYCLE = [
  { freq: "Every 12 months", title: "Document review", body: "Insurance certificate, ARG/US or Wyvern audit, current rosters, training records, type-rating proofs, airworthiness-directive compliance." },
  { freq: "Every 12 months", title: "On-site visit", body: "Our chief pilot or a qualified third party — JetNine standards must be observed in operation. Maintenance hangar, training facility, dispatch operations." },
  { freq: "Every flight", title: "Trip-level review", body: "Before every booking — current pilot duty time, aircraft maintenance status, weather, route alternates. Wyvern Wingman runs this automatically." },
  { freq: "Continuous", title: "Spot-check & debrief", body: "Random flight-by-flight crew checks, post-flight client surveys, anonymous tip line for crew & terminal staff. One strike on safety — out." },
];

const INSURANCE = [
  { label: "Light & midsize jets", value: "$300M", body: "Per-occurrence hull-and-liability minimum. Most operators in this category carry $500M; we publish the floor, not the average." },
  { label: "Super-mid through ultra long range", value: "$500M", body: "Per-occurrence hull-and-liability minimum. Higher floor reflects passenger count, transoceanic exposure, and aircraft replacement cost." },
];

const DEEPER = [
  { href: "/safety/operator-vetting", h: "How we vet operators", p: "The 5,000 → 380 funnel, filter by filter — and what removes an operator once they're in." },
  { href: "/safety/pilot-standards", h: "Pilot standards", p: "Two fully licensed pilots, a 3,500-hour captain floor, 90-day currency. Who's actually flying you." },
  { href: "/safety/ratings-explained", h: "Ratings, explained", p: "What ARG/US Gold and Platinum, Wyvern Wingman, and IS-BAO Stage 2 certify in plain language." },
];

export default function SafetyPage() {
  return (
    <>
      <PageHero
        eyebrow="Safety · standards & vetting"
        title="Private jet safety standards: the floor is high, the ceiling is mandatory."
        lead="Every operator in our network meets a written safety floor before they're eligible for a single flight. We re-audit every twelve months. The protocol is below — the same one our chief pilot uses to vet his own family's flights."
        imageSrc="/images/hero/safety.webp"
        imagePosition="center"
        className="[&_h1]:!max-w-[18ch] [&_h1]:!text-[clamp(40px,4.5vw,56px)] [&_h1]:!leading-[1.05]"
      />

      {/* Accreditations */}
      <section className="container-jn pt-12">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ACCREDITATIONS.map((a) => (
            <div key={a.name} className="card p-6">
              <h3 className="text-[18px] font-medium leading-[1.3] text-bone">{a.name}</h3>
              <p className="mt-0.5 text-[13px] font-semibold text-gold">{a.role}</p>
              <p className="mt-2.5 text-[15px] leading-[1.55] text-bone-2">{a.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] leading-[1.55] text-steel">
          In plain terms: independent auditors visit the operator, check the pilots, maintenance
          and insurance, and rate them. We only fly operators that pass — and we visit them
          ourselves too.
        </p>
      </section>

      {/* The funnel */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">The funnel</p>
        <h2 className="title-section max-w-[22ch]">From 5,000 operators to 380 in network.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
          There are roughly five thousand licensed charter operators in the United States. Most
          are excellent. Some are not. Our job is to know which is which — and we are aggressive
          about saying no.
        </p>
        <ol className="mt-8 flex flex-col gap-2">
          {FUNNEL.map((f) => {
            const width = `${Math.max(4, Math.round((f.n / FUNNEL_TOP) * 100))}%`;
            return (
              <li
                key={f.name}
                className={[
                  "card grid grid-cols-1 items-center gap-4 px-7 py-[18px] max-md:px-5 md:grid-cols-[minmax(0,1fr)_140px] md:gap-6",
                  f.highlight ? "!border-clearance" : "",
                ].join(" ")}
              >
                <div>
                  <p className="text-[17px] font-medium text-bone">{f.name}</p>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-[4px] bg-surface-2"
                    role="img"
                    aria-label={`${f.count} of ~5,000`}
                  >
                    <div
                      className={["h-full rounded-[4px]", f.highlight ? "bg-gold" : "bg-clearance"].join(" ")}
                      style={{ width }}
                    />
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.5] text-bone-2">{f.desc}</p>
                </div>
                <div className="md:text-right">
                  <div
                    className={[
                      "font-serif text-[36px] font-light leading-none tracking-tight",
                      f.highlight ? "text-gold" : "text-bone",
                    ].join(" ")}
                  >
                    {f.count}
                  </div>
                  <div className="mt-1 text-[13px] text-steel">{f.unit}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The floor */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">The floor</p>
        <h2 className="title-section max-w-[24ch]">
          The non-negotiables. Every operator. Every flight.
        </h2>
        <p className="mt-4 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
          Below this line, an operator does not enter the network. There is no exception process,
          no client request that overrides it, no rate that justifies a waiver.
        </p>
        <FloorAccordion items={FLOOR} />
      </section>

      {/* Audit cycle */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Audit cycle</p>
        <h2 className="title-section max-w-[24ch]">
          A standard isn&rsquo;t a standard unless it&rsquo;s enforced.
        </h2>
        <p className="mt-4 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
          Approval isn&rsquo;t a ribbon to be cut and forgotten. Every operator runs through this
          four-stage cycle, every twelve months, with spot-checks in between. The grading is
          binary: stay in network, or out.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CYCLE.map((c) => (
            <div key={c.title} className="card p-6">
              <p className="text-[13px] font-semibold text-gold">{c.freq}</p>
              <h3 className="mt-2.5 text-[20px] font-medium leading-[1.25] text-bone">{c.title}</h3>
              <p className="mt-2.5 text-[15px] leading-[1.55] text-bone-2">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Insurance */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Insurance</p>
        <h2 className="title-section max-w-[24ch]">Hull-and-liability, at the levels above.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
          Operator-level coverage — primary, not contingent. JetNine carries an additional $50M
          umbrella as broker. Certificates verified before every booking; clients can request a
          copy on confirmation.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {INSURANCE.map((c) => (
            <div key={c.value} className="card p-8">
              <p className="label-jn">{c.label}</p>
              <div className="mt-3 font-serif text-[64px] font-light leading-none tracking-tight text-bone max-md:text-[52px]">
                {c.value}
              </div>
              <p className="mt-3.5 text-bone-2">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Broker disclosure */}
      <section className="container-jn section-jn max-md:pt-20">
        <div className="card grid grid-cols-1 gap-10 p-10 max-md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <p className="eyebrow">Who actually flies you</p>
            <h2 className="title-section !text-[clamp(30px,3.2vw,36px)] !leading-[1.1]">
              What &ldquo;we are a broker&rdquo; means.
            </h2>
            <p className="mt-3.5 text-[17px] leading-[1.55] text-bone-2">
              JetNine arranges your flight. An independent, licensed airline — the operator — flies
              it. That is the standard, regulated structure for premium charter in the United
              States.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-[15px]">
              <Link href="/legal#part-295" className="text-link">
                Read the full broker disclosure →
              </Link>
              <Link href="/legal#operator-detail" className="text-link">
                What the operator is responsible for →
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 leading-[1.65] text-bone-2">
            <p>
              JetNine LLC is an indirect air carrier registered under{" "}
              <strong className="font-medium text-bone">14 CFR Part 295</strong> with the United
              States Department of Transportation. We are not a direct air carrier — we do not
              operate aircraft, and we do not hold an FAA Part 135 certificate.
            </p>
            <p>
              For every flight, we arrange charter on behalf of our clients with a{" "}
              <strong className="font-medium text-bone">
                third-party FAA Part 135 certificated direct air carrier
              </strong>
              . That carrier is the operator of record, holds operational control of the aircraft,
              employs the pilots, holds the maintenance program, and carries the insurance.
            </p>
            <p>
              The identity of the operator, their FAA certificate number, their insurance carrier,
              and the operating-control documentation is provided to every client at the time of
              booking and is included in the charter agreement. Our role is to source, vet,
              contract, and coordinate — not to fly.
            </p>
          </div>
        </div>
      </section>

      {/* Go deeper — the safety cluster subpages */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Go deeper</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DEEPER.map((c) => (
            <Link key={c.href} href={c.href} className="card card-pad flex h-full flex-col">
              <h3 className="title-card-sm text-bone">{c.h}</h3>
              <p className="mt-2.5 flex-1 text-[15px] leading-[1.55] text-bone-2">{c.p}</p>
              <span className="mt-5 text-[15px] font-medium text-bone">
                Read <span className="arrow" aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand
        title="Questions about the protocol?"
        body="Our chief pilot will take your call. The vetting documents for any specific operator are available on request."
      />
    </>
  );
}
