import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { WindowButton } from "@/components/light/window";
import { FaqList } from "@/components/company/faq-list";
import { FloorAccordion, type FloorItem } from "@/components/safety/floor-accordion";
import {
  DisclosureStrip,
  GoDeeper,
  IconDisc,
  SafetyClose,
  SafetyHero,
  SectionTabs,
  SourcesRow,
  WindowNotes,
} from "@/components/safety/parts";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Safety — ARG/US & Wyvern Vetting",
  description:
    "Private jet safety at JetNine: every operator vetted against a written floor — ARG/US or Wyvern audited, re-checked every twelve months, spot-checked between.",
  path: "/safety",
});

// Light - Safety. The prototype's consumer checks, ratings, roles and
// sources, with JetNine's own published standard (funnel, floor, audit
// cycle, insurance, broker disclosure) carried over from the previous
// page — those are the real vetting numbers.

const CHECKS = [
  ["Operating carrier", "Legal name, certificate and charter authorization."],
  ["Proposed aircraft", "Model, registration and actual seating layout."],
  ["Flight crew", "Qualifications, recent training and substitution process."],
  ["Insurance", "Current evidence, scope and applicable limits."],
  ["Safety processes", "Safety management and emergency response information."],
  ["Your itinerary", "Airport suitability, weather and operational review."],
];

const SIDE_CHECKS = ["Operator identified", "Aircraft details received", "Crew questions answered", "Insurance reviewed", "Terms understood"];

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

const FAQ = [
  { q: "Does an audit rating guarantee a safe flight?", a: "No. Confirm the actual operator, aircraft and trip details; no rating removes all risk." },
  { q: "How can I verify the operating carrier?", a: "Ask to see the carrier’s operating certificate and confirm that charter authorization covers the proposed aircraft. Check the legal name against the agreement." },
  { q: "What if my aircraft or crew changes?", a: "Request the replacement operator’s identity, the aircraft details and any revised terms in writing before accepting the change." },
  { q: "What documents can I request before booking?", a: "The operating certificate, aircraft registration and seating layout, insurance evidence, crew qualifications and the written terms." },
];

const TABS: [string, string][] = [
  ["Operator checks", "#checks"],
  ["Our standard", "#standard"],
  ["Ratings", "#ratings"],
  ["Responsibilities", "#roles"],
  ["FAQs", "#faq"],
];

const btnGold = "btn h-[42px] border-gold bg-gold !text-[14px] !font-bold text-white hover:bg-[#6b4c2b] hover:border-[#6b4c2b]";
const btnLine = "btn h-[42px] !border-bone bg-transparent !text-[14px] !font-bold text-bone hover:bg-surface-2";
const smallLink = "text-link cursor-pointer border-0 bg-transparent p-0 text-left text-[13px]";

function ChecklistBody() {
  return (
    <div>
      <div className="mt-4 flex flex-col gap-2">
        {[...SIDE_CHECKS, "Written terms received"].map((t) => (
          <label key={t} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" className="m-0 h-[17px] w-[17px] accent-[var(--gold)]" />
            {t}
          </label>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-steel">
        A checklist does not confirm a booking. Confirm each item in your written agreement.
      </p>
      <Link href="/contact" className="btn btn-secondary mt-3">
        Ask about an item
      </Link>
    </div>
  );
}

function RolesBody() {
  return (
    <div>
      <WindowNotes
        items={[
          "Charter broker: sources options, coordinates proposals and communicates updates.",
          "Operating carrier: holds operational control and handles flight operations.",
          "You can also book directly with an operator. Confirm the capacity of every company in your agreement.",
        ]}
      />
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 text-[14px] leading-[1.6] text-bone-2">
        <p>
          JetNine LLC is an indirect air carrier registered under <strong className="font-semibold text-bone">14 CFR Part 295</strong> with
          the United States Department of Transportation. We are not a direct air carrier — we do not operate aircraft, and we do not hold
          an FAA Part 135 certificate.
        </p>
        <p>
          For every flight, we arrange charter on behalf of our clients with a{" "}
          <strong className="font-semibold text-bone">third-party FAA Part 135 certificated direct air carrier</strong>. That carrier is
          the operator of record, holds operational control of the aircraft, employs the pilots, holds the maintenance program, and
          carries the insurance.
        </p>
        <p>
          The identity of the operator, their FAA certificate number, their insurance carrier, and the operating-control documentation is
          provided to every client at the time of booking and is included in the charter agreement. Our role is to source, vet, contract,
          and coordinate — not to fly.
        </p>
        <p className="flex flex-wrap gap-x-5">
          <Link href="/legal#part-295" className="text-link">Read the full broker disclosure →</Link>
          <Link href="/legal#operator-detail" className="text-link">What the operator is responsible for →</Link>
        </p>
      </div>
    </div>
  );
}

export default function SafetyPage() {
  return (
    <>
      <SafetyHero
        imageSrc="/images/light/page-20-hero.webp"
        crumbs={[{ label: "Home", href: "/" }, { label: "Safety" }]}
        title="Private Jet Charter Safety"
        subtitle="Know who flies you. Know what to ask."
        body="A practical guide to operator authorization, aircraft details and the questions to resolve before booking — and the written standard every JetNine operator meets."
        actions={
          <>
            <WindowButton label="Open safety checklist →" className={btnGold} title="Before you book." sub="Your pre-booking checklist." variant="drawer">
              <ChecklistBody />
            </WindowButton>
            <Link href="/contact" className={btnLine}>
              Ask a safety question
            </Link>
          </>
        }
      />
      <DisclosureStrip />
      <SectionTabs tabs={TABS} />

      {/* Checks + aside */}
      <div id="checks" className="container-jn flex scroll-mt-[var(--header-h)] flex-wrap items-start gap-6 pt-7">
        <div className="min-w-0 flex-[999_1_420px]">
          <h2 className="font-serif text-[32px] leading-[1.1]">Six checks before you book.</h2>
          <p className="mt-1 text-[15px] text-steel">Request information for the actual operator and aircraft proposed.</p>
          <div className="mt-[14px] border border-line bg-white">
            <div className="grid gap-x-4 border-b border-line bg-[#F3F0E9] px-4 py-[9px] text-[13px] font-bold [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))] max-sm:hidden">
              <span>Check</span>
              <span>What to request</span>
            </div>
            {CHECKS.map(([name, ask], i) => (
              <div key={name} className="grid items-baseline gap-x-4 border-b border-surface-2 px-4 py-[9px] text-[14px] last:border-b-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <span className="flex gap-[14px] font-bold">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>{name}</span>
                </span>
                <span className="text-steel max-sm:pl-[34px]">{ask}</span>
              </div>
            ))}
          </div>
          <WindowButton label="FAA: checking charter legitimacy ↗" className={`${smallLink} mt-3`} title="Know who operates your flight." variant="drawer">
            <WindowNotes
              source="faa"
              items={[
                "Request the carrier certificate and confirm charter authorization for the proposed aircraft.",
                "An aircraft registration record alone does not establish charter authorization.",
                "JetNine provides the operator's identity and FAA certificate number at booking, in the charter agreement.",
              ]}
            />
          </WindowButton>

          <h2 id="ratings" className="mt-7 scroll-mt-[var(--header-h)] font-serif text-[32px] leading-[1.1]">
            Understand what a rating tells you.
          </h2>
          <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
            {ACCREDITATIONS.map((r) => (
              <div key={r.name} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border border-line bg-white p-4">
                <IconDisc name="doc" />
                <div>
                  <div className="font-serif text-[19px]">{r.name}</div>
                  <div className="text-[12px] font-semibold text-gold">{r.role}</div>
                  <p className="mb-2 mt-1 text-[12px] leading-[1.5] text-steel">{r.desc}</p>
                  <Link href="/safety/ratings-explained" className="text-link text-[12px]">
                    What it certifies <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-[10px] text-[12px] text-steel">
            These programs are distinct. Verify current status; a badge alone does not establish suitability for your flight.{" "}
            <WindowButton label="How to check a credential" className={`${smallLink} !text-[12px]`} title="Understand the exact credential.">
              <WindowNotes
                source="faa"
                items={[
                  "Confirm the proposed operator’s legal name.",
                  "Ask for the exact rating, certification or registration claimed.",
                  "Check its scope, current status and supporting evidence.",
                  "Industry programs differ. A badge alone is not a guarantee of safety.",
                ]}
              />
            </WindowButton>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-[14px]">
          <div className="border border-line bg-white p-[18px]">
            <h2 className="font-serif text-[21px] leading-[1.2]">Your pre-booking checklist</h2>
            <div className="mt-3 flex flex-col gap-[9px]">
              {SIDE_CHECKS.map((t) => (
                <label key={t} className="flex min-h-7 cursor-pointer items-center gap-3 text-[14px]">
                  <input type="checkbox" className="m-0 h-4 w-4 accent-[var(--gold)]" />
                  {t}
                </label>
              ))}
            </div>
            <WindowButton label="Open full checklist →" className={`${btnGold} mt-[14px] w-full !h-[38px] !text-[13px]`} title="Before you book." sub="Your pre-booking checklist." variant="drawer">
              <ChecklistBody />
            </WindowButton>
            <p className="mt-2 text-[12px] text-steel">A planning aid, not flight clearance.</p>
          </div>
          <div className="on-navy bg-navy p-[18px]">
            <h2 className="font-serif text-[21px] leading-[1.2]">Have a question?</h2>
            <p className="mt-1 text-[13px] text-bone-2">Ask about the documents for your proposed trip. The vetting documents for any specific operator are available on request.</p>
            <Link href="/contact" className="btn mt-3 h-[38px] w-full border-white bg-transparent !text-[13px] !font-bold text-white hover:bg-[rgba(255,255,255,.08)]">
              Ask JetNine →
            </Link>
            <div className="mt-3 flex flex-col">
              {[
                ["How booking works", "/how-it-works"],
                ["Compare aircraft", "/aircraft"],
                ["Charter guides", "/guides"],
              ].map(([l, h]) => (
                <Link key={h} href={h} className="flex justify-between border-t border-[rgba(255,255,255,.2)] py-2 text-[13px] text-white hover:text-navy-on-2">
                  <span>{l}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* JetNine's standard */}
      <section id="standard" className="container-jn scroll-mt-[var(--header-h)] pt-[30px]">
        <p className="eyebrow !mb-2">How JetNine vets operators</p>
        <h2 className="font-serif text-[32px] leading-[1.1]">From 5,000 operators to 380 in network.</h2>
        <p className="mt-2 max-w-[68ch] text-[15px] text-steel">
          There are roughly five thousand licensed charter operators in the United States. Most are excellent. Some are not. Our job is
          to know which is which — and we are aggressive about saying no.
        </p>
        <ol className="mt-[14px] flex list-none flex-col border border-line bg-white p-0">
          {FUNNEL.map((f) => (
            <li key={f.name} className="grid items-center gap-x-6 gap-y-2 border-b border-line px-4 py-[14px] last:border-b-0 md:grid-cols-[minmax(0,1fr)_130px]">
              <div>
                <p className="text-[14px] font-bold">{f.name}</p>
                <div className="mt-2 h-[6px] overflow-hidden bg-surface-2" role="img" aria-label={`${f.count} of ~5,000`}>
                  <div className={`h-full ${f.highlight ? "bg-gold" : "bg-navy"}`} style={{ width: `${Math.max(4, Math.round((f.n / FUNNEL_TOP) * 100))}%` }} />
                </div>
                <p className="mt-2 text-[13px] leading-[1.5] text-steel">{f.desc}</p>
              </div>
              <div className="md:text-right">
                <div className={`font-serif text-[32px] leading-none ${f.highlight ? "text-gold" : ""}`}>{f.count}</div>
                <div className="mt-1 text-[12px] text-steel">{f.unit}</div>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/safety/operator-vetting" className="text-link mt-3 inline-block text-[13px]">
          How each filter works →
        </Link>

        <h3 className="mt-8 font-serif text-[26px] leading-[1.15]">The non-negotiables. Every operator. Every flight.</h3>
        <p className="mt-1 max-w-[68ch] text-[15px] text-steel">
          Below this line, an operator does not enter the network. There is no exception process, no client request that overrides it,
          no rate that justifies a waiver.
        </p>
        <div className="mt-2 bg-white px-5 [&_.accordion]:mt-0 [&_.accordion]:border-t-0 border border-line max-sm:px-4">
          <FloorAccordion items={FLOOR} />
        </div>

        <h3 className="mt-8 font-serif text-[26px] leading-[1.15]">A standard isn&rsquo;t a standard unless it&rsquo;s enforced.</h3>
        <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {CYCLE.map((c) => (
            <div key={c.title} className="border border-t-2 border-line border-t-gold bg-white p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gold">{c.freq}</p>
              <h4 className="mt-[6px] font-serif text-[20px]">{c.title}</h4>
              <p className="mt-[6px] text-[13px] leading-[1.5] text-steel">{c.body}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-8 font-serif text-[26px] leading-[1.15]">Hull-and-liability insurance, at these levels.</h3>
        <p className="mt-1 max-w-[68ch] text-[15px] text-steel">
          Operator-level coverage — primary, not contingent. JetNine carries an additional $50M umbrella as broker. Certificates
          verified before every booking; clients can request a copy on confirmation.
        </p>
        <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {INSURANCE.map((c) => (
            <div key={c.value} className="border border-line bg-white px-5 py-[18px]">
              <p className="text-[13px] font-bold">{c.label}</p>
              <div className="mt-2 font-serif text-[52px] leading-none">{c.value}</div>
              <p className="mt-2 text-[13px] leading-[1.5] text-steel">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="container-jn scroll-mt-[var(--header-h)] pt-[30px]">
        <h2 className="font-serif text-[32px] leading-[1.1]">Who is responsible for your flight?</h2>
        <div className="mt-[14px] grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {[
            { icon: "plane" as const, t: "JetNine · Charter broker", b: "Arranges and coordinates the charter as a Part 295 indirect air carrier. Ask which capacity the broker is acting in and who will operate the flight.", l: "Read broker disclosure" },
            { icon: "crew" as const, t: "Operating carrier", b: "The FAA Part 135 certificated carrier has operational control of the aircraft. Ask about crew, maintenance and operational decisions.", l: "Understand the roles" },
          ].map((r) => (
            <div key={r.t} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border border-line bg-white p-[18px]">
              <IconDisc name={r.icon} size={56} />
              <div>
                <div className="font-serif text-[20px]">{r.t}</div>
                <p className="mb-2 mt-1 text-[14px] leading-[1.5] text-steel">{r.b}</p>
                <WindowButton label={`${r.l} →`} className={smallLink} title="Who does what?">
                  <RolesBody />
                </WindowButton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right">
          <a href="https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295" target="_blank" rel="noopener noreferrer" className="text-link text-[13px]">
            DOT rules: 14 CFR Part 295 <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      {/* Changes band */}
      <section className="on-navy relative mt-[26px] overflow-hidden bg-navy">
        <div className="absolute inset-y-0 left-0 w-[38%] max-md:hidden">
          <Image src="/images/light/ground-service-golden-hour.webp" alt="" aria-hidden fill sizes="40vw" className="object-cover" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,35,46,.1)_0%,rgba(18,35,46,.75)_24%,#12232E_38%)] max-md:hidden" />
        <div className="container-jn relative flex flex-wrap items-center justify-end gap-7 py-[26px] max-md:justify-start">
          <div>
            <h2 className="font-serif text-[26px] leading-[1.15]">If the aircraft or operator changes, ask again.</h2>
            <p className="mt-1 text-[14px] text-bone-2">Confirm the replacement details and applicable terms before accepting a change.</p>
          </div>
          <WindowButton
            label="Replacement checklist →"
            className="btn h-10 whitespace-nowrap border-white bg-transparent !text-[13px] !font-bold text-white hover:bg-[rgba(255,255,255,.08)]"
            title="If your flight details change."
            variant="drawer"
          >
            <WindowNotes
              source="nbaa"
              items={[
                "Identify the replacement operating carrier.",
                "Confirm the proposed aircraft and supporting evidence.",
                "Request any revised price, terms and contact details.",
                "Ask about your options in writing; do not assume identical terms.",
              ]}
            />
          </WindowButton>
        </div>
      </section>

      <SourcesRow />
      <GoDeeper current="/safety" />

      <section id="faq" className="container-jn scroll-mt-[var(--header-h)] pb-[26px] pt-6">
        <h2 className="font-serif text-[32px] leading-[1.1]">Before you fly.</h2>
        <FaqList className="mt-3" joined items={FAQ} />
      </section>

      <SafetyClose />
    </>
  );
}
