import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Legal & disclosures",
  description:
    "Privacy policy, terms of service, and the Part 295 broker disclosure. Written plainly. Reviewed by counsel.",
};

const TOC = [
  {
    group: "I",
    title: "Privacy",
    items: [
      ["1.1", "What we collect", "#what-we-collect"],
      ["1.2", "How we use it", "#how-we-use"],
      ["1.3", "What we don't do", "#what-we-dont"],
      ["1.4", "Sharing & subprocessors", "#sharing"],
      ["1.5", "Retention", "#retention"],
      ["1.6", "Your rights", "#your-rights"],
    ],
  },
  {
    group: "II",
    title: "Terms of service",
    items: [
      ["2.1", "The agreement", "#agreement"],
      ["2.2", "Quotes & bookings", "#quotes-bookings"],
      ["2.3", "Payment", "#payment"],
      ["2.4", "Cancellation & changes", "#cancellation"],
      ["2.5", "Operator relationship", "#operator-relationship"],
      ["2.6", "Limitation of liability", "#liability"],
      ["2.7", "Disputes", "#disputes"],
    ],
  },
  {
    group: "III",
    title: "Part 295 disclosure",
    items: [
      ["3.1", "Broker status", "#part-295"],
      ["3.2", "The operator", "#operator-detail"],
      ["3.3", "Your rights", "#part-295-rights"],
      ["3.4", "Definitions", "#definitions"],
    ],
  },
];

const META_CARD = [
  ["EFFECTIVE", "07 MAY 2026"],
  ["LAST EDITED", "12 APR 2026"],
  ["GOVERNING LAW", "California, USA"],
  ["DISPATCH LEGAL", "legal@jetnine.com"],
  ["PART 295", "Registered · DOT"],
] as const;

const DEFINITIONS = [
  ["DIRECT AIR CARRIER", "An entity holding an FAA Part 135 air-carrier certificate that directly operates aircraft for compensation."],
  ["INDIRECT AIR CARRIER", "An entity that arranges air transportation but does not operate aircraft. Air charter brokers under Part 295 are indirect air carriers."],
  ["OPERATIONAL CONTROL", "Authority over initiating, conducting, or terminating a flight. Held exclusively by the direct air carrier."],
  ["PART 295", "14 CFR Part 295 — U.S. DOT regulation governing air charter brokers."],
  ["PART 135", "14 CFR Part 135 — FAA regulation governing on-demand commuter and charter operations."],
  ["TRIP SHEET", "The written confirmation issued by JetNine before each flight stating operating carrier, tail number, crew, FBOs, and itemized pricing."],
] as const;

export default function LegalPage() {
  return (
    <>
      {/* Hero — split + meta card */}
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
        <div className="container-jn grid gap-16 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              Legal &amp; disclosures
            </Reveal>
            <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
              The fine print, large enough to read.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-8 max-w-[56ch] text-[18px] leading-[1.55] text-bone-2">
              Three documents that govern the JetNine relationship: how we handle your data, what
              you and we agree to when you book, and the broker disclosure required by US DOT Part
              295. Written plainly. Reviewed by counsel. Updated whenever they change — never
              quietly.
            </Reveal>
          </div>
          <Reveal stagger={2} className="self-end rounded-[4px] border border-ink-3 bg-ink-2 p-8">
            <p className="caption mb-5">— Document state</p>
            <ul className="divide-y divide-ink-3">
              {META_CARD.map(([lbl, val]) => (
                <li key={lbl} className="grid grid-cols-[140px_1fr] items-baseline gap-4 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    {lbl}
                  </span>
                  <span className="font-mono text-[12px] tracking-[0.04em] text-bone">{val}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      {/* Disclosure strip */}
      <section className="border-b border-clearance bg-[rgba(232,226,210,0.04)] py-8">
        <div className="container-jn flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
            — Required disclosure
          </span>
          <p className="max-w-[72ch] font-serif text-[18px] font-normal leading-[1.45] tracking-tight text-bone">
            JetNine is an indirect air carrier — a Part 295 broker. Every flight is operated by an
            independent FAA Part 135 certified carrier.{" "}
            <em className="not-italic text-clearance">We are not the operator of your aircraft.</em>
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-24 max-md:py-16">
        <div className="container-jn grid gap-12 lg:grid-cols-[260px_1fr]">
          {/* Sticky TOC */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="caption mb-5">— Contents</p>
            <nav className="flex flex-col gap-8">
              {TOC.map((doc) => (
                <div key={doc.group}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                      {doc.group}
                    </span>
                    <span className="font-serif text-[16px] font-normal text-bone">{doc.title}</span>
                  </div>
                  <ol className="flex flex-col gap-1.5 border-l border-ink-3 pl-4">
                    {doc.items.map(([n, label, href]) => (
                      <li key={n}>
                        <a
                          href={href}
                          className="block py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-bone-2 transition-colors hover:text-clearance"
                        >
                          <span className="mr-2 text-clearance">{n}</span>
                          {label}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </nav>
          </aside>

          {/* Documents */}
          <div className="flex flex-col gap-20">
            {/* ─── I. Privacy ─── */}
            <article>
              <header className="mb-10">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                  Document I
                </span>
                <h2 className="mt-3 font-serif text-[40px] font-normal leading-tight tracking-tight text-bone max-w-[20ch]">
                  Privacy policy.
                </h2>
                <p className="mt-5 max-w-[72ch] text-[17px] leading-[1.65] text-bone-2">
                  Privacy is structural at JetNine. The inquiry desk and the dispatch desk are the
                  only people inside the company who see your trip details — and operators only ever
                  see a route, not a name.
                </p>
              </header>

              <Section id="what-we-collect" n="1.1" title="What we collect">
                <p>
                  We collect the minimum needed to quote and run flights. That breaks down into
                  three buckets:
                </p>
                <BulletList
                  items={[
                    [
                      "Identity & contact.",
                      "Name, email, phone, and (for international flights) passport details and date of birth as required by APIS & CBP.",
                    ],
                    [
                      "Trip details.",
                      "Route, dates, passenger count, baggage, preferences (Wi-Fi, catering, pets, ground transport), and any notes you provide.",
                    ],
                    [
                      "Payment.",
                      "Bank routing for wires, or a tokenized card reference held by our PCI-compliant payment processor. We do not store full card numbers on our servers.",
                    ],
                  ]}
                />
                <p>
                  We use minimal analytics — first-party only, no ad networks, no behavioral
                  tracking. Cookies are limited to session and preference state.
                </p>
              </Section>

              <Section id="how-we-use" n="1.2" title="How we use it">
                <ol className="ml-1 flex flex-col gap-3 text-[15px] leading-[1.7] text-bone-2">
                  {[
                    "To produce a quote and source aircraft for your trip.",
                    "To execute the trip — coordinate with the operator, FBO, and ground.",
                    "To bill, account, and meet our tax and audit obligations.",
                    "To remember your preferences if you ask us to (account holders only).",
                    "To send you trip-specific status updates (never marketing without consent).",
                  ].map((it, i) => (
                    <li key={it} className="grid grid-cols-[28px_1fr] items-baseline gap-3">
                      <span className="font-mono text-[11px] tracking-[0.04em] text-clearance">
                        {String(i + 1).padStart(2, "0")}.
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="what-we-dont" n="1.3" title="What we don't do">
                <div className="rounded-[4px] border-l-2 border-[#D4622A] bg-ink-2 p-7">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#D4622A]">
                    — The list
                  </span>
                  <ul className="mt-4 flex flex-col gap-2.5 text-[15px] leading-[1.7] text-bone">
                    {[
                      "We do not sell your data.",
                      "We do not share it with marketing networks.",
                      "We do not use it to train external models.",
                      "We do not retarget you.",
                      "We do not pass your name to operators competing for your trip.",
                      "We do not run a referral or affiliate program that exposes your identity.",
                    ].map((it) => (
                      <li key={it} className="grid grid-cols-[auto_1fr] items-baseline gap-3">
                        <span className="text-[#D4622A]">—</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section id="sharing" n="1.4" title="Sharing & subprocessors">
                <p>The only third parties that touch your data, and the reason:</p>
                <BulletList
                  items={[
                    [
                      "The operating carrier —",
                      "route, date, pax count, baggage, special requests. Not your name or contact unless you authorize.",
                    ],
                    [
                      "FBO & ground —",
                      "arrival window, vehicle preference, your name on the manifest at the FBO desk.",
                    ],
                    [
                      "Payment processor —",
                      "Stripe, for card transactions. PCI-DSS Level 1.",
                    ],
                    [
                      "Customs & immigration —",
                      "passport & APIS data submitted to CBP and equivalents on international flights, as required by law.",
                    ],
                    [
                      "Cloud infrastructure —",
                      "AWS US-West-2 for primary storage; encrypted at rest and in transit.",
                    ],
                  ]}
                />
                <p>
                  Full subprocessor list is available on request to{" "}
                  <a href="mailto:legal@jetnine.com" className="text-clearance underline-offset-2 hover:underline">
                    legal@jetnine.com
                  </a>
                  .
                </p>
              </Section>

              <Section id="retention" n="1.5" title="Retention">
                <p>
                  Trip records: <strong className="font-medium text-bone">seven years</strong> after
                  the flight, to satisfy IRS &amp; FAA recordkeeping. Quote requests that
                  don&rsquo;t book: <strong className="font-medium text-bone">180 days</strong>,
                  then deleted unless you&rsquo;ve opted into ongoing service. Account preferences:
                  kept while your account is active, deleted within 30 days of account closure.
                </p>
              </Section>

              <Section id="your-rights" n="1.6" title="Your rights">
                <p>You can ask us, at any time and at no charge, to:</p>
                <BulletList
                  items={[
                    ["Show you everything we have on file (within 30 days).", ""],
                    ["Correct anything that's wrong.", ""],
                    ["Delete data not subject to a regulatory hold (trips inside the seven-year window stay; everything else can go).", ""],
                    ["Export a copy in machine-readable form.", ""],
                  ]}
                />
                <p>
                  Email{" "}
                  <a href="mailto:legal@jetnine.com" className="text-clearance underline-offset-2 hover:underline">
                    legal@jetnine.com
                  </a>
                  . California residents (CCPA), EU residents (GDPR), and Virginia residents (CDPA)
                  have additional statutory rights mirrored in this policy.
                </p>
              </Section>
            </article>

            {/* ─── II. Terms ─── */}
            <article>
              <header className="mb-10 border-t border-ink-3 pt-16">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                  Document II
                </span>
                <h2 className="mt-3 font-serif text-[40px] font-normal leading-tight tracking-tight text-bone max-w-[20ch]">
                  Terms of service.
                </h2>
                <p className="mt-5 max-w-[72ch] text-[17px] leading-[1.65] text-bone-2">
                  When you book a flight through JetNine, you and we agree to the terms below. Plain
                  English where we can, defined terms where the law requires precision.
                </p>
              </header>

              <Section id="agreement" n="2.1" title="The agreement">
                <p>
                  <strong className="font-medium text-bone">JetNine</strong> means JetNine LLC, a
                  California limited liability company.{" "}
                  <strong className="font-medium text-bone">You</strong> means the individual or
                  entity that requests, books, or pays for a flight.{" "}
                  <strong className="font-medium text-bone">Operator</strong> means the FAA Part 135
                  certified air carrier that operates the aircraft.{" "}
                  <strong className="font-medium text-bone">Flight</strong> means the on-demand
                  charter flight booked through JetNine.
                </p>
                <p>
                  By submitting a booking request, you accept these Terms. If you book on behalf of
                  a company, you represent that you have authority to bind that company.
                </p>
              </Section>

              <Section id="quotes-bookings" n="2.2" title="Quotes & bookings">
                <p>
                  Quotes are valid for the time period stated on the quote (typically 24–72 hours,
                  shorter inside 48 hours of departure). A quote is an offer; a booking exists only
                  when both you and JetNine sign the trip sheet.
                </p>
                <p>
                  The trip sheet supersedes the quote and lists: the operating carrier, registered
                  tail number, crew composition, fuel and surcharge breakdown, FBO of departure and
                  arrival, and any agreed special arrangements.
                </p>
              </Section>

              <Section id="payment" n="2.3" title="Payment">
                <p>
                  Full payment is due before wheels-up. Domestic: cleared funds by{" "}
                  <strong className="font-medium text-bone">24 hours</strong> before scheduled
                  departure. International:{" "}
                  <strong className="font-medium text-bone">48 hours</strong>. Wire is the default;
                  ACH and card are accepted within stated limits.
                </p>
                <p>
                  Reserve and Card members: trip cost is debited against your deposit balance on
                  confirmation; operator and pass-through expenses are reconciled within 48 hours of
                  trip completion.
                </p>
              </Section>

              <Section id="cancellation" n="2.4" title="Cancellation & changes">
                <p>Cancellation by you, applied to total trip cost:</p>
                <BulletList
                  items={[
                    ["> 72 hours before departure:", "full refund minus a $250 admin fee."],
                    ["72–24 hours:", "25% retained."],
                    ["24–6 hours:", "50% retained."],
                    ["< 6 hours:", "100% retained."],
                  ]}
                />
                <p>
                  Cancellation by JetNine or the operator (mechanical, crew, weather): full refund,
                  plus best efforts to re-source aircraft at no incremental cost. Empty legs and
                  discounted one-off flights have stricter terms stated on the trip sheet.
                </p>
              </Section>

              <Section id="operator-relationship" n="2.5" title="Operator relationship">
                <div className="rounded-[4px] border-l-2 border-clearance bg-ink-2 p-7">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                    — Part 295 notice
                  </span>
                  <p className="mt-3 text-[15px] leading-[1.7] text-bone">
                    JetNine is an indirect air carrier (broker). The Operator is the direct air
                    carrier and exercises operational control of the flight. JetNine does not own,
                    operate, or maintain the aircraft, and does not employ flight or cabin crew.
                  </p>
                </div>
                <p>
                  Vetting: every Operator on the JetNine network meets ARG/US Gold Plus or Wyvern
                  Wingman standard at minimum, carries a $300M combined single-limit liability
                  minimum, and passes a JetNine review of safety record and pilot experience.
                </p>
              </Section>

              <Section id="liability" n="2.6" title="Limitation of liability">
                <p>
                  To the maximum extent permitted by law, JetNine&rsquo;s aggregate liability
                  arising from any single trip is limited to the amount paid by you for that trip.
                  JetNine is not liable for the Operator&rsquo;s acts or omissions, including
                  operational decisions made by the Pilot in Command.
                </p>
                <p>
                  Nothing in these Terms limits liability that cannot be excluded by law — including
                  death or personal injury caused by negligence, fraud, or fraudulent
                  misrepresentation.
                </p>
              </Section>

              <Section id="disputes" n="2.7" title="Disputes">
                <p>
                  Governing law: California, without regard to conflict-of-laws principles. Venue:
                  state and federal courts located in Los Angeles County, California. Both parties
                  waive jury trial.
                </p>
                <p>
                  Before filing, both parties agree to a 30-day good-faith negotiation period and,
                  if requested by either party, mediation through JAMS in Los Angeles.
                </p>
              </Section>
            </article>

            {/* ─── III. Part 295 ─── */}
            <article>
              <header className="mb-10 border-t border-ink-3 pt-16">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                  Document III
                </span>
                <h2 className="mt-3 font-serif text-[40px] font-normal leading-tight tracking-tight text-bone max-w-[22ch]">
                  Part 295 broker disclosure.
                </h2>
                <p className="mt-5 max-w-[72ch] text-[17px] leading-[1.65] text-bone-2">
                  Required by 14 CFR Part 295 and reproduced here in plain English. The short
                  version: JetNine arranges your flight; an independent FAA Part 135 carrier flies
                  it.
                </p>
              </header>

              <Section id="part-295" n="3.1" title="Broker status">
                <p>
                  JetNine LLC operates as an{" "}
                  <strong className="font-medium text-bone">indirect air carrier</strong> —
                  specifically, an air charter broker registered with the U.S. Department of
                  Transportation under 14 CFR Part 295.
                </p>
                <p>
                  An indirect air carrier holds out, sells, or arranges air transportation but does
                  not directly operate aircraft. JetNine sources, contracts, and sells charter air
                  transportation provided by independent FAA-certificated direct air carriers.
                </p>
              </Section>

              <Section id="operator-detail" n="3.2" title="The operator">
                <p>
                  Every JetNine flight is operated by an independent direct air carrier holding an
                  FAA Part 135 air-carrier certificate. The carrier — not JetNine — exercises
                  operational control, including:
                </p>
                <BulletList
                  items={[
                    ["Crew composition, qualifications, and duty time", ""],
                    ["Aircraft airworthiness and maintenance", ""],
                    ["Routing, dispatch, and fuel planning", ""],
                    ["The go/no-go decision for weather, mechanical, or any safety-of-flight reason", ""],
                    ["All required reporting to the FAA, NTSB, and TSA", ""],
                  ]}
                />
                <p>
                  The operating carrier and tail number for your flight are stated on your trip
                  sheet before you sign. You may verify any operator&rsquo;s Part 135 certificate
                  status on the FAA&rsquo;s certificate-holder lookup at{" "}
                  <a
                    href="https://www.faa.gov/licenses_certificates"
                    className="text-clearance underline-offset-2 hover:underline"
                  >
                    faa.gov/licenses_certificates
                  </a>
                  .
                </p>
              </Section>

              <Section id="part-295-rights" n="3.3" title="Your rights as the customer">
                <p>Under Part 295 you are entitled to:</p>
                <BulletList
                  items={[
                    ["Written disclosure of the broker relationship before booking.", "(This document, plus the trip sheet.)"],
                    ["The identity of the operating carrier in writing before you pay.", ""],
                    ["A clear breakdown of the price, including the broker fee.", ""],
                    ["Access to the operator's FAA Part 135 certificate number.", ""],
                    ["Refund of advance payments if the flight is not provided as agreed and JetNine is unable to substitute equivalent transportation.", ""],
                  ]}
                />
                <p>
                  Complaints concerning Part 295 broker conduct may be filed with the U.S. DOT
                  Office of Aviation Consumer Protection:{" "}
                  <strong className="font-medium text-bone">1-202-366-2220</strong>,{" "}
                  <a
                    href="https://www.transportation.gov/airconsumer"
                    className="text-clearance underline-offset-2 hover:underline"
                  >
                    transportation.gov/airconsumer
                  </a>
                  .
                </p>
              </Section>

              <Section id="definitions" n="3.4" title="Definitions">
                <p>Terms used in this document:</p>
                <dl className="mt-4 divide-y divide-ink-3 border-y border-ink-3">
                  {DEFINITIONS.map(([term, def]) => (
                    <div
                      key={term}
                      className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[200px_1fr]"
                    >
                      <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-clearance">
                        {term}
                      </dt>
                      <dd className="text-[15px] leading-[1.65] text-bone-2">{def}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </article>

            {/* Minimal closer */}
            <div className="border-t border-ink-3 pt-12 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-2">
                Questions about these documents?{" "}
                <a href="mailto:legal@jetnine.com" className="text-clearance">
                  legal@jetnine.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-5 flex items-baseline gap-4 border-b border-ink-3 pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-clearance">
          {n}
        </span>
        <h3 className="font-serif text-[24px] font-normal leading-tight tracking-tight text-bone">
          {title}
        </h3>
      </div>
      <div className="flex max-w-[72ch] flex-col gap-4 text-[15px] leading-[1.75] text-bone-2 [&>p+ol]:mt-2 [&>p+ul]:mt-2">
        {children}
      </div>
      <div className="mt-12" />
    </section>
  );
}

function BulletList({ items }: { items: [string, string][] }) {
  return (
    <ul className="ml-1 flex flex-col gap-3 text-[15px] leading-[1.7] text-bone-2">
      {items.map(([head, body]) => (
        <li key={head + body} className="grid grid-cols-[auto_1fr] items-baseline gap-3">
          <span className="text-clearance">—</span>
          <span>
            {head ? <strong className="font-medium text-bone">{head}</strong> : null}{" "}
            {body}
          </span>
        </li>
      ))}
    </ul>
  );
}
