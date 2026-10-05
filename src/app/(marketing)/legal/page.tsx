import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { WindowButton } from "@/components/light/window";
import { CopySectionLink, LegalContents, LegalTools } from "@/components/legal/legal-contents";

export const metadata: Metadata = pageMetadata({
  title: "Legal & disclosures",
  description:
    "Privacy policy, terms of service, and the Part 295 broker disclosure. Written plainly. Reviewed by counsel.",
  path: "/legal",
});

// Every id below is linked from elsewhere on the site (footer, quote
// flow, empty-legs watchlist, safety page) — keep them all.
const TOC = [
  {
    numeral: "I",
    title: "Privacy policy",
    items: [
      ["1.1", "What we collect", "#what-we-collect"],
      ["1.2", "How we use it", "#how-we-use"],
      ["1.3", "What we don't do", "#what-we-dont"],
      ["1.4", "Sharing & subprocessors", "#sharing"],
      ["1.5", "Retention", "#retention"],
      ["1.6", "Your rights", "#your-rights"],
      ["1.7", "SMS & text messaging", "#sms"],
    ],
  },
  {
    numeral: "II",
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
    numeral: "III",
    title: "Part 295 disclosure",
    items: [
      ["3.1", "Broker status", "#part-295"],
      ["3.2", "The operator", "#operator-detail"],
      ["3.3", "Your rights", "#part-295-rights"],
      ["3.4", "Definitions", "#definitions"],
    ],
  },
] as const;

const META_CARD = [
  ["Effective", "May 7, 2026"],
  ["Last edited", "April 12, 2026"],
  ["Governing law", "California, USA"],
  ["Questions", "legal@jetnine.com"],
  ["Broker status", "Part 295 · registered with US DOT"],
] as const;

const DEFINITIONS = [
  ["Direct air carrier", "An entity holding an FAA Part 135 air-carrier certificate that directly operates aircraft for compensation."],
  ["Indirect air carrier", "An entity that arranges air transportation but does not operate aircraft. Air charter brokers under Part 295 are indirect air carriers."],
  ["Operational control", "Authority over initiating, conducting, or terminating a flight. Held exclusively by the direct air carrier."],
  ["Part 295", "14 CFR Part 295 — U.S. DOT regulation governing air charter brokers."],
  ["Part 135", "14 CFR Part 135 — FAA regulation governing on-demand commuter and charter operations."],
  ["Trip sheet", "The written confirmation issued by JetNine before each flight stating operating carrier, tail number, crew, FBOs, and itemized pricing."],
] as const;

const LINK = "text-link-strong";

const ICON = {
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  book: "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h8M8 11h8",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
} as const;

const META_ICON: Record<string, string> = {
  Effective: ICON.calendar,
  "Last edited": ICON.calendar,
  "Governing law": ICON.scale,
  Questions: ICON.mail,
  "Broker status": ICON.doc,
};

const NEXT_STEPS = [
  { href: "/how-it-works", title: "How booking works", sub: "From request to confirmation", link: "Explore the process", d: ICON.doc },
  { href: "/safety", title: "Charter safety", sub: "Questions about your operator", link: "Read the safety guide", d: ICON.shield },
  { href: "/empty-legs", title: "Empty-leg flights", sub: "Review trip-specific conditions", link: "Explore empty legs", d: ICON.plane },
] as const;

const OFFICIAL = [
  { href: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295", title: "eCFR · Air charter brokers", link: "Read 14 CFR Part 295" },
  { href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft", title: "FAA · Charter guidance", link: "Check charter legitimacy" },
] as const;

const ROLES = [
  { name: "JetNine", role: "Charter broker", items: ["Arranges the charter", "Coordinates booking information"], d: ICON.doc },
  { name: "Operating carrier", role: "Flight operator", items: ["Operates the aircraft", "Makes operational decisions"], d: ICON.plane },
] as const;

export default function LegalPage() {
  return (
    <div className="container-jn pt-[18px]">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Legal" }]} />

      {/* Title, meta row, broker strip */}
      <p className="eyebrow !mb-[6px] mt-[14px] !text-bone">Legal &amp; disclosures</p>
      <h1 className="m-0 font-serif text-[clamp(34px,9vw,54px)] font-normal leading-[1.04] tracking-[-0.01em]">
        Legal &amp; Charter Terms
      </h1>
      <p className="mt-[6px] font-serif text-[22px] leading-[1.3]">The fine print, large enough to read.</p>
      <p className="mt-3 max-w-[72ch] text-[16px] leading-[1.55] text-steel">
        Three documents that govern the JetNine relationship: how we handle your data, what
        you and we agree to when you book, and the broker disclosure required by US DOT Part
        295. Written plainly. Reviewed by counsel. Updated whenever they change — never
        quietly.
      </p>
      <dl className="mt-[14px] flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[14px]">
        {META_CARD.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-[18px]">
            <div className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" aria-hidden="true" className="h-4 w-4 flex-none">
                <path d={META_ICON[label]} />
              </svg>
              <dt className="text-steel">{label}:</dt>
              <dd className="m-0 text-bone">
                {label === "Questions" ? (
                  <a href={`mailto:${value}`} className="text-bone hover:text-gold">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
            {i < META_CARD.length - 1 ? (
              <span aria-hidden="true" className="text-line max-sm:hidden">
                |
              </span>
            ) : null}
          </div>
        ))}
      </dl>

      {/* Required disclosure */}
      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[#F0EBE2] px-4 py-[10px] text-[14px]">
        <div className="flex min-w-0 flex-1 basis-[280px] items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" aria-hidden="true" className="mt-[2px] h-[18px] w-[18px] flex-none">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
          </svg>
          <p className="min-w-0 leading-[1.5]">
            <span className="mr-2 text-[12px] font-bold uppercase tracking-[0.18em] text-gold">Required disclosure</span>
            JetNine is an indirect air carrier — a Part 295 broker. Every flight is operated by an
            independent FAA Part 135 certified carrier.{" "}
            <em className="font-semibold not-italic">We are not the operator of your aircraft.</em>
          </p>
        </div>
        <WindowButton
          label={
            <>
              Understand the roles <span aria-hidden="true">→</span>
            </>
          }
          className="border-0 bg-transparent p-0 text-[13px] text-bone underline underline-offset-[3px] hover:text-gold print:hidden"
          title="Who does what?"
        >
          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {ROLES.map((r) => (
              <div key={r.name} className="border border-line bg-white p-4">
                <div className="flex items-center gap-3">
                  <IconDisc d={r.d} size={44} />
                  <div>
                    <div className="font-serif text-[19px]">{r.name}</div>
                    <div className="text-[13px] text-steel">{r.role}</div>
                  </div>
                </div>
                <ul className="mt-3 flex flex-col gap-[6px]">
                  {r.items.map((x) => (
                    <li key={x} className="flex gap-[10px] text-[14px]">
                      <span aria-hidden="true" className="text-gold">•</span>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[14px] text-steel">
            The operating carrier and tail number for your flight are stated on your trip sheet
            before you sign.{" "}
            <a href="#part-295" className="text-link">
              Read the Part 295 disclosure
            </a>
          </p>
        </WindowButton>
      </div>

      {/* Contents rail + documents */}
      <div className="mt-[18px] grid grid-cols-1 items-start gap-7 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-[14px] lg:sticky lg:top-[calc(var(--header-h)+20px)] print:hidden">
          <nav aria-label="Contents">
            <LegalContents docs={TOC} />
          </nav>
          <div className="on-navy bg-navy p-5 max-lg:hidden">
            <h2 className="font-serif text-[24px] font-normal leading-[1.15]">
              A question
              <br />
              about a clause?
            </h2>
            <p className="mt-[6px] text-[14px] text-navy-on-2">Contact the legal team.</p>
            <a
              href="mailto:legal@jetnine.com"
              className="mt-[14px] flex h-10 w-full items-center justify-center gap-2 rounded-control border border-white text-[14px] font-bold text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              legal@jetnine.com <span aria-hidden="true">→</span>
            </a>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-14">
          {/* ─── I. Privacy ─── */}
          <article>
            <ArticleHeader kicker="Document I" title="Privacy policy." tools>
              Privacy is structural at JetNine. The inquiry desk and the dispatch desk are the only
              people inside the company who see your trip details — and operators only ever see a
              route, not a name.
            </ArticleHeader>
            <div className="flex flex-col gap-9">
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
                <ol className="flex flex-col gap-2">
                  {[
                    "To produce a quote and source aircraft for your trip.",
                    "To execute the trip — coordinate with the operator, FBO, and ground.",
                    "To bill, account, and meet our tax and audit obligations.",
                    "To remember your preferences if you ask us to (account holders only).",
                    "To send you trip-specific status updates (never marketing without consent).",
                  ].map((it, i) => (
                    <li key={it} className="grid grid-cols-[32px_1fr] gap-2.5">
                      <span className="font-medium text-bone">{String(i + 1).padStart(2, "0")}.</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="what-we-dont" n="1.3" title="What we don't do">
                <BulletList
                  items={[
                    ["We do not sell your data.", ""],
                    ["We do not share it with marketing networks.", ""],
                    ["We do not use it to train external models.", ""],
                    ["We do not retarget you.", ""],
                    ["We do not pass your name to operators competing for your trip.", ""],
                    ["We do not run a referral or affiliate program that exposes your identity.", ""],
                  ]}
                />
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
                    ["Payment processor —", "Stripe, for card transactions. PCI-DSS Level 1."],
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
                  <a href="mailto:legal@jetnine.com" className={LINK}>
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
                  <a href="mailto:legal@jetnine.com" className={LINK}>
                    legal@jetnine.com
                  </a>
                  . California residents (CCPA), EU residents (GDPR), and Virginia residents (CDPA)
                  have additional statutory rights mirrored in this policy.
                </p>
              </Section>

              <Section id="sms" n="1.7" title="SMS & text messaging">
                <p>
                  If you opt in to empty-leg alerts on{" "}
                  <a href="/empty-legs" className={LINK}>
                    jetnine.com/empty-legs
                  </a>
                  , we send two kinds of text message: a one-time confirmation when you set up a
                  watchlist, and an alert when a repositioning flight matches your saved route and
                  dates. Nothing is sent until you confirm via the link in the first message.
                </p>
                <BulletList
                  items={[
                    [
                      "Frequency —",
                      "one message per matching flight. Frequency varies with how often your route matches; there are no marketing blasts.",
                    ],
                    ["Rates —", "message and data rates may apply, per your carrier's plan."],
                    [
                      "Opting out —",
                      "reply STOP at any time to end all alerts; reply START to resume. Reply HELP for help, or call +1 (424) 487-2707.",
                    ],
                    [
                      "Your number stays here —",
                      "mobile numbers and SMS opt-in data are never shared with or sold to third parties or affiliates for marketing or promotional purposes. They are used solely to deliver the alerts you asked for.",
                    ],
                    ["Delivery —", "carriers are not liable for delayed or undelivered messages."],
                  ]}
                />
              </Section>
            </div>
          </article>

          {/* ─── II. Terms ─── */}
          <article>
            <ArticleHeader kicker="Document II" title="Terms of service.">
              When you book a flight through JetNine, you and we agree to the terms below. Plain
              English where we can, defined terms where the law requires precision.
            </ArticleHeader>
            <div className="flex flex-col gap-9">
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
                <div className="border border-line bg-[#FBF8F2] px-6 py-5">
                  <p className="eyebrow !mb-0">Part 295 notice</p>
                  <p className="mt-2 text-bone">
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
            </div>
          </article>

          {/* ─── III. Part 295 ─── */}
          <article>
            <ArticleHeader kicker="Document III" title="Part 295 broker disclosure.">
              Required by 14 CFR Part 295 and reproduced here in plain English. The short version:
              JetNine arranges your flight; an independent FAA Part 135 carrier flies it.
            </ArticleHeader>
            <div className="flex flex-col gap-9">
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
                  <a href="https://www.faa.gov/licenses_certificates" className={LINK}>
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
                  <a href="https://www.transportation.gov/airconsumer" className={LINK}>
                    transportation.gov/airconsumer
                  </a>
                  .
                </p>
              </Section>

              <Section id="definitions" n="3.4" title="Definitions">
                <p>Terms used in this document:</p>
                <dl className="flex flex-col gap-2">
                  {DEFINITIONS.map(([term, def]) => (
                    <div
                      key={term}
                      className="relative pl-6 before:absolute before:left-0 before:top-0 before:text-gold before:content-['—']"
                    >
                      <dt className="inline font-medium text-bone">{term} —</dt>{" "}
                      <dd className="inline">{def}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </div>
          </article>

          {/* Minimal closer */}
          <p className="border-t border-line pt-6 text-center text-[15px] text-bone-2">
            Questions about these documents?{" "}
            <a href="mailto:legal@jetnine.com" className={LINK}>
              legal@jetnine.com
            </a>
          </p>
        </div>
      </div>

      <section className="mt-[30px] print:hidden">
        <h2 className="font-serif text-[32px] font-normal leading-[1.1]">Useful next steps.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {NEXT_STEPS.map((n) => (
            <Link key={n.href} href={n.href} className="group grid grid-cols-[52px_minmax(0,1fr)] gap-[14px] border border-line bg-white p-4">
              <IconDisc d={n.d} size={52} />
              <span>
                <span className="block font-serif text-[19px]">{n.title}</span>
                <span className="block text-[13px] text-steel">{n.sub}</span>
                <span className="mt-2 inline-block text-[13px] text-bone underline underline-offset-[3px] group-hover:text-gold">
                  {n.link} <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-[22px] pb-14 print:hidden">
        <h2 className="font-serif text-[32px] font-normal leading-[1.1]">Official sources.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {OFFICIAL.map((o) => (
            <a key={o.href} href={o.href} target="_blank" rel="noopener noreferrer" className="group grid grid-cols-[48px_minmax(0,1fr)] items-center gap-[14px] border border-line bg-white px-4 py-[14px]">
              <IconDisc d={ICON.doc} size={48} />
              <span>
                <span className="block font-serif text-[18px]">{o.title}</span>
                <span className="text-[13px] text-bone underline underline-offset-[3px] group-hover:text-gold">
                  {o.link} <span aria-hidden="true">↗</span>
                </span>
              </span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-steel">Independent references; no endorsement implied.</p>
      </section>
    </div>
  );
}

function IconDisc({ d, size }: { d: string; size: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-[#F3EDE3]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[22px] w-[22px]">
        <path d={d} />
      </svg>
    </span>
  );
}

function ArticleHeader({
  kicker,
  title,
  tools = false,
  children,
}: {
  kicker: string;
  title: string;
  /** Show the Print / Copy link actions on the kicker row. */
  tools?: boolean;
  children: React.ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-bone">{kicker}</p>
        {tools ? <LegalTools /> : null}
      </div>
      <h2 className="mt-[10px] font-serif text-[clamp(32px,5vw,40px)] font-normal leading-[1.08]">{title}</h2>
      <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] items-center gap-4 border border-line bg-[#FBF8F2] px-[18px] py-4 max-sm:px-[14px]">
        <IconDisc d={ICON.book} size={44} />
        <p className="min-w-0 text-[15px] leading-[1.55]">{children}</p>
      </div>
    </header>
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
    <section id={id} className="scroll-mt-[calc(var(--header-h)+24px)]">
      <div className="flex items-baseline gap-[14px] border-b border-line pb-[10px]">
        <span className="font-serif text-[20px] text-gold">{n}</span>
        <h3 className="font-serif text-[28px] font-normal leading-[1.1] max-sm:text-[24px]">{title}</h3>
        <CopySectionLink id={id} label={title} />
      </div>
      <div className="mt-[14px] flex max-w-[72ch] flex-col gap-3 text-[16px] leading-[1.6] text-bone-2">
        {children}
      </div>
    </section>
  );
}

function BulletList({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([head, body]) => (
        <li key={head + body} className="grid grid-cols-[auto_1fr] gap-2.5">
          <span aria-hidden="true" className="text-gold">—</span>
          <span>
            {head ? <strong className="font-semibold text-bone">{head}</strong> : null}
            {head && body ? " " : null}
            {body}
          </span>
        </li>
      ))}
    </ul>
  );
}
