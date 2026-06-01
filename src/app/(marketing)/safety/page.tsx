import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Safety",
  description:
    "The floor is high. The ceiling is mandatory. Every operator audited every twelve months, with spot-checks in between.",
  path: "/safety",
  image: "/images/fleet/heavy.webp",
  imageAlt: "JetNine safety — Gulfstream G450 banking against cloudscape",
});

const ACCREDITATIONS = [
  { id: "A/G", name: "ARG/US Gold", role: "FLOOR · ALL OPERATORS", desc: "Aviation Research Group. The standard accreditation for serious charter — historical safety audit and operator profile." },
  { id: "A/P", name: "ARG/US Platinum", role: "PREFERRED · 78% OF FLIGHTS", desc: "Highest ARG/US tier. On-site audit plus emergency-response, ground-handling and security review." },
  { id: "WW", name: "Wyvern Wingman", role: "REQUIRED · INTL & ULTRA", desc: "Pilot-specific qualifications, trip-level safety review, real-time risk assessment for every leg." },
  { id: "IS-2", name: "IS-BAO Stage 2", role: "PREFERRED · LARGE-CABIN", desc: "International Standard for Business Aircraft Operations. SMS implemented, audited, and demonstrated in operation." },
];

const FLOOR = [
  { num: "01", area: "Certification", lead: "FAA Part 135 certificate, current and unblemished.", body: "No suspensions, no enforcement actions, no certificate amendments under review in the last 24 months. Foreign equivalents must be verified by recognized aviation authority.", preferred: "ICAO Annex 6 Part II compliance for cross-border missions." },
  { num: "02", area: "Audit standing", lead: "ARG/US Gold or higher; current.", body: "Audit cannot have lapsed. Wyvern Wingman or IS-BAO Stage 2 required for international, transoceanic, and ultra-long-range missions.", preferred: "ARG/US Platinum + Wyvern Wingman dual rating." },
  { num: "03", area: "Pilot qualification", lead: "Two ATP-rated pilots, in-type, on every flight.", body: "Pilot-in-command minimum 3,500 total hours, 1,500 hours in-type. SIC minimum 2,500 total hours. Both current on aircraft within 90 days. No exceptions for daylight, short-leg, or VFR conditions.", preferred: "PIC 5,000+ hours, augmented crew on legs >8 hours block-time." },
  { num: "04", area: "Insurance", lead: "$300M minimum hull-and-liability for light through midsize.", body: "$500M minimum for super-mid through ultra. Policy must be primary, not contingent on a fractional or fleet umbrella. Certificate provided to JetNine in advance of every booking.", preferred: "$500M+ across the board, AM Best A or higher carrier." },
  { num: "05", area: "Maintenance", lead: "Continuous Airworthiness Maintenance Program (CAMP) or equivalent.", body: "No deferred maintenance items at dispatch. All inspections current within manufacturer-recommended intervals (not regulatory minimums). Aircraft must have completed a full Phase inspection within the last 12 months.", preferred: "Factory-authorized service center, single-fleet operator." },
  { num: "06", area: "Safety record", lead: "No event-of-significance in the last 24 months.", body: "No fatal accidents in the last 60 months. No NTSB-reportable incidents under review. FAA enforcement history reviewed back five years; any enforcement action is grounds for rejection unless cleared by our chief pilot.", preferred: "Zero NTSB-reportable events lifetime, fleet-wide." },
  { num: "07", area: "Operator stability", lead: "Minimum 5 years in continuous Part 135 operation.", body: "Verified financial standing — no bankruptcy, receivership, or aircraft repossession events in the last 36 months. Single-fleet operators preferred over fragmented charter brokers re-selling under their certificate.", preferred: "Founder-owned, >15 years operation, single-flag-carrier." },
];

const CYCLE = [
  { num: "01", freq: "EVERY 12 MO", title: "Document review", body: "Insurance certificate, ARG/US or Wyvern audit, current rosters, training records, type-rating proofs, AD/SB compliance." },
  { num: "02", freq: "EVERY 12 MO", title: "On-site visit", body: "Our chief pilot or a qualified third party — JetNine standards must be observed in operation. Maintenance hangar, training facility, dispatch operations." },
  { num: "03", freq: "PER FLIGHT", title: "Trip-level review", body: "Before every booking — current pilot duty time, aircraft maintenance status, weather, route alternates. Wyvern Wingman runs this automatically." },
  { num: "04", freq: "CONTINUOUS", title: "Spot-check & debrief", body: "Random flight-by-flight crew checks, post-flight client surveys, anonymous tip line for crew & FBO staff. One strike on safety — out." },
];

const FUNNEL = [
  { stage: "01", name: "All US Part 135 operators", desc: "Every certificated charter operator in the country. The starting universe before any filter.", count: "~5,000", unit: "CERTIFICATES", highlight: false },
  { stage: "02", name: "After certification & insurance filter", desc: "Drop operators with certificate amendments, insurance below threshold, or fewer than five years continuous operation.", count: "~2,100", unit: "REMAINING", highlight: false },
  { stage: "03", name: "After audit-standing filter", desc: "Drop operators below ARG/US Gold or with lapsed audits. Drop any operator with an NTSB-reportable event in the last 24 months.", count: "~880", unit: "REMAINING", highlight: false },
  { stage: "04", name: "After on-site visit & chief-pilot review", desc: "In-person hangar & ops walk-through. Roughly half the operators that look good on paper don't survive a site visit.", count: "~410", unit: "REMAINING", highlight: false },
  { stage: "05", name: "JetNine approved operators", desc: "Operators currently flying for our clients. Re-audited every 12 months, spot-checked continuously, with a one-strike policy on safety events.", count: "380", unit: "CURRENT · IN NETWORK", highlight: true },
];

const STATS = [
  { period: "Lifetime", value: "0", body: "NTSB-reportable accidents on JetNine-arranged flights since founding (2014)." },
  { period: "Last 12 months", value: "14,800", body: "Hours flown, network-wide. Zero significant events." },
  { period: "Operator turnover", value: "~6%", body: "Annual rate at which approved operators drop out of the network. About half are voluntary, half are removed." },
  { period: "Audit pass rate", value: "62%", body: "Of operators that submit for re-audit, the percentage that pass on the first attempt." },
];

export default function SafetyPage() {
  return (
    <>
      <PageHeader
        kicker="Safety · standards & vetting"
        title="The floor is high. The ceiling is mandatory."
        lead="Every operator in our network meets a written safety floor before they're eligible for a single flight. We re-audit every twelve months. The protocol is below — the same one our chief pilot uses to vet his own family's flights."
      />

      {/* B1. Accreditations row */}
      <section className="border-b border-ink-3 bg-ink py-10">
        <div className="container-jn grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {ACCREDITATIONS.map((a) => (
            <Reveal key={a.id} className="flex items-start gap-5">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ink-4 bg-ink-2 font-mono text-[12px] tracking-[0.04em] text-clearance">
                {a.id}
              </span>
              <div>
                <h3 className="font-serif text-[18px] font-normal leading-[1.2] text-bone">
                  {a.name}
                </h3>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                  {a.role}
                </p>
                <p className="mt-2 text-[13px] leading-[1.55] text-bone-2">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* B2. The Floor */}
      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— The floor</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                The non-negotiables. Every operator. Every flight.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                Below this line, an operator does not enter the network. There is no exception
                process, no client request that overrides it, no rate that justifies a waiver.
              </Reveal>
            </div>
          </div>

          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {FLOOR.map((f, i) => (
              <Reveal
                key={f.num}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[auto_1fr_1.4fr]"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[36px] font-light leading-none text-clearance">
                    {f.num}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2">
                    — {f.area}
                  </span>
                </div>
                <div>
                  <p className="font-serif text-[20px] font-normal leading-[1.3] tracking-tight text-bone">
                    {f.lead}
                  </p>
                  <p className="mt-3 max-w-[52ch] text-[14px] leading-[1.65] text-bone-2">{f.body}</p>
                </div>
                <div className="border-l border-ink-3 pl-6 max-lg:border-l-0 max-lg:border-t max-lg:pt-6 max-lg:pl-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — Preferred
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.6] text-bone-2">{f.preferred}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* B3. Audit cycle */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Audit cycle</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                A standard isn&rsquo;t a standard unless it&rsquo;s enforced.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                Approval isn&rsquo;t a ribbon to be cut and forgotten. Every operator runs through
                this four-stage cycle, every twelve months, with spot-checks in between. The grading
                is binary: stay in network, or out.
              </Reveal>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {CYCLE.map((c, i) => (
              <Reveal
                key={c.num}
                stagger={(i as 0 | 1 | 2)}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-8"
              >
                <div className="mb-6 flex items-center justify-between">
                  <span className="font-mono text-[36px] font-light leading-none text-clearance">
                    {c.num}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                    {c.freq}
                  </span>
                </div>
                <h3 className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone">
                  {c.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-bone-2">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* B4. The Funnel */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— The funnel</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                From 5,000 operators to 380 in network.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                There are roughly five thousand FAA Part 135 charter certificates active in the
                United States. Most are excellent. Some are not. Our job is to know which is which
                — and we are aggressive about saying no.
              </Reveal>
            </div>
          </div>
          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {FUNNEL.map((f, i) => (
              <Reveal
                key={f.stage}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className={[
                  "grid grid-cols-1 items-baseline gap-6 px-1 py-6 lg:grid-cols-[auto_1fr_auto] lg:gap-12",
                  f.highlight ? "bg-clearance/[0.04]" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "font-mono text-[10px] uppercase tracking-[0.14em]",
                    f.highlight ? "text-clearance" : "text-bone-2",
                  ].join(" ")}
                >
                  STAGE {f.stage}
                </span>
                <div>
                  <h3 className="font-serif text-[20px] font-normal leading-[1.2] tracking-tight text-bone">
                    {f.name}
                  </h3>
                  <p className="mt-2 max-w-[58ch] text-[14px] leading-[1.6] text-bone-2">{f.desc}</p>
                </div>
                <div className="text-right">
                  <div
                    className={[
                      "font-serif font-light leading-none tracking-tight",
                      f.highlight ? "text-clearance" : "text-bone",
                    ].join(" ")}
                    style={{ fontSize: f.highlight ? "44px" : "32px", letterSpacing: "-0.01em" }}
                  >
                    {f.count}
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                    {f.unit}
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* B5. By the numbers */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— By the numbers</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                Safety is a metric. Here are ours.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
                Reported quarterly, audited annually, available on request from any client.
              </Reveal>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal
                key={s.period}
                stagger={(i as 0 | 1 | 2)}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-8"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                  — {s.period}
                </span>
                <div
                  className="mt-4 font-serif text-[56px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {s.value}
                </div>
                <p className="mt-4 text-[14px] leading-[1.6] text-bone-2">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* B6. Insurance */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Insurance</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                Hull-and-liability, at the levels above.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                Operator-level coverage — primary, not contingent. JetNine carries an additional
                $50M umbrella as broker. Certificates verified before every booking; clients can
                request a copy on confirmation.
              </Reveal>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { label: "LIGHT & MIDSIZE FLOOR", value: "$300M", body: "Per-occurrence hull-and-liability minimum. Most operators in this category carry $500M; we publish the floor, not the average." },
              { label: "SUPER-MID THROUGH ULTRA", value: "$500M", body: "Per-occurrence hull-and-liability minimum. Higher floor reflects passenger count, transoceanic exposure, and airframe replacement cost." },
            ].map((c, i) => (
              <Reveal
                key={c.label}
                stagger={(i as 0 | 1)}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-10"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                  — {c.label}
                </span>
                <div
                  className="mt-5 font-serif text-[72px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {c.value}
                </div>
                <p className="mt-5 max-w-[44ch] text-[14px] leading-[1.6] text-bone-2">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* B7. Part 295 disclosure */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <Reveal className="mb-6">
            <p className="caption">— Part 295 broker disclosure</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            What &ldquo;we are a broker&rdquo; actually means.
          </Reveal>
          <div className="mt-12 max-w-[78ch] space-y-6 text-[16px] leading-[1.7] text-bone-2">
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
              . The Part 135 carrier is the operator of record, holds operational control of the
              aircraft, employs the pilots, holds the maintenance program, and carries the
              insurance.
            </p>
            <p>
              The identity of the operator, their FAA certificate number, their insurance carrier,
              and the operating-control documentation is provided to every client at the time of
              booking and is included in the charter agreement. The trip is operated under the Part
              135 carrier&rsquo;s certificate and operating specifications. Our role is to source,
              vet, contract, and coordinate — not to fly.
            </p>
            <p>
              This is the standard, regulated structure for premium charter brokerage in the United
              States. It is the same structure used by every reputable broker in the industry. The
              Part 295 disclosure on the agreement makes liability and responsibility unambiguous,
              in plain language.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
            {[
              ["Read the full Part 295 disclosure", "/legal#part-295"],
              ["Sample charter agreement", "/legal#sample-agreement"],
              ["DOT registration on file", "/legal#dot"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-clearance transition-opacity hover:opacity-80"
              >
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="Questions about the protocol?"
        body="Our chief pilot will take your call. The vetting documents for any specific operator are available on request."
        primary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
        secondary={{ label: "Request a quote", href: "/quote" }}
      />
    </>
  );
}
