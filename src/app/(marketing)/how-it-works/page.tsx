import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PRICE_STACK, PRICE_STACK_TOTAL } from "@/lib/rates";
import { SITE } from "@/lib/constants";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { GuideGate } from "@/components/guide-gate";
import { FaqAccordion } from "@/components/memberships/faq-accordion";
import { StepExplorer } from "@/components/how-it-works/step-explorer";
import { STEPS } from "@/components/how-it-works/steps";
import { plainDesc, plainLabel } from "@/components/how-it-works/price-copy";

export const metadata: Metadata = pageMetadata({
  title: "How Private Jet Charter Works",
  description:
    "A senior dispatcher, not a chatbot. One number to call. Specific aircraft & pricing back within thirty minutes.",
  path: "/how-it-works",
});

const HERO_STATS = [
  { value: "Under 30 min", label: "Quote turnaround, business hours" },
  { value: "14 years", label: "Average dispatcher experience" },
  { value: "2 hours", label: "Wheels-up notice from confirmed quote" },
  { value: "20,000 aircraft", label: "Worldwide, 5,000 operators" },
];

const VS_ROWS: { row: string; app: string; jn: string }[] = [
  { row: "Quote source", app: "Stale fleet database, refreshed weekly", jn: "Live operator calls, every quote" },
  { row: "Quote latency", app: "Instant, but indicative only", jn: "Under 30 min, with real aircraft" },
  { row: "Pricing", app: "Hourly + add-ons, surprise fees", jn: "All-in, locked at acceptance" },
  { row: "Who you talk to", app: "Tier-1 support, rotating", jn: "Same dispatcher, every flight" },
  { row: "In-flight changes", app: "Submit ticket, wait", jn: "Direct cell, no queue" },
  { row: "After-hours", app: "Voicemail, email auto-reply", jn: "Live, 24/7/365" },
];

const PROMISES = [
  {
    num: "Promise 01",
    title: "Quote in thirty minutes, or it's free.",
    body: "If we don't return three to five specific aircraft within thirty minutes of business-hours request, your first hour of flight time is on us — applied automatically to the accepted booking.",
  },
  {
    num: "Promise 02",
    title: "Locked pricing, no surprises.",
    body: "The all-in number you accept is the number on the invoice. If anything changes — fuel, route, weather diversion — that's our cost to absorb, not yours. Period.",
  },
  {
    num: "Promise 03",
    title: "Your dispatcher, on-call.",
    body: "Direct cell number, day and night, for the life of the trip. The same person who quoted you handles every change, every escalation, every weather call. No tickets, no queues, no rotating staff.",
  },
];

const FAQ = [
  {
    q: "How is JetNine different from a fractional like NetJets?",
    a: "Fractionals sell shares of an aircraft — a per-year deposit, hourly rate, plus monthly management fee. Good if you fly 25+ hours a year on the same one or two routes. JetNine charges per flight, no annual commitment, with access to twenty thousand aircraft instead of a single fleet of two hundred. We're a better fit for variable schedules and varied missions; fractional is a better fit for fixed, frequent flyers.",
  },
  {
    q: "What's a Part 295 broker, and is JetNine one?",
    a: "Yes. JetNine is an indirect air carrier under Part 295 of the US DOT regulations. We arrange charter on behalf of clients with FAA Part 135 certified operators — we don't operate aircraft ourselves. The Part 295 disclosure is in every charter agreement, plain English. It clarifies who is the operator of record (the certificated operator, not us) and where liability sits. Standard, transparent, audited.",
  },
  {
    q: "How do you vet operators?",
    a: "Floor: ARG/US Gold or higher, current FAA Part 135 certificate, $300M minimum hull insurance, two ATP-rated pilots, no event-of-significance in the last 24 months. We add Wyvern Wingman or IS-BAO Stage 2 as a strong preference for international and ultra-long-range missions. The full vetting protocol lives on the safety page; the short version is — we don't put you on an aircraft we wouldn't put our own families on.",
  },
  {
    q: "What if the weather goes sideways?",
    a: "Your dispatcher monitors weather from twelve hours out. If a divert or delay is likely, you'll get a call, not a notification — usually with an alternate plan already drafted. Common moves: shift wheels-up by an hour, divert to an alternate airport, swap aircraft if the original can't depart. All re-routing cost is ours. The locked price holds.",
  },
  {
    q: "Can I cancel after I've booked?",
    a: "Up to 72 hours before departure: full refund minus a $1,500 admin fee. Inside 72 hours: 50% refund. Inside 24 hours: forfeited, with one exception — documented medical or family emergency, in which case we credit 100% to a future flight within 12 months. We are not in the business of pocketing your money on a bad day.",
  },
  {
    q: "What happens if my flight is delayed by the operator?",
    a: "Mechanical or crew issue on the operator's side: we substitute another aircraft at our cost, no questions, usually within two hours at major metros. If a substitution isn't possible inside your window, your flight is refunded in full plus a $5,000 inconvenience credit. Has happened twice in the last 18 months. Both times, the client flew within the window on a different aircraft.",
  },
  {
    q: "How does the all-in pricing actually work?",
    a: "When you accept a quote, the price freezes. If fuel jumps 15% between acceptance and departure, that's our problem. If a Part 135 operator changes a fee, our problem. If we have to reposition an aircraft an extra leg because of a weather divert, our problem. The number on the agreement is the number on the invoice. The only adjustments are extras the client adds after acceptance — additional ground transport, extra catering, added pets — itemized and approved in advance.",
  },
  {
    q: "Do you offer empty-leg flights?",
    a: "Yes. Repositioning legs surface on a live board at 30–60% off the equivalent charter price. They're date- & route-locked — you take the flight as scheduled, not as designed. If your dates and lanes are flexible, ask your dispatcher to monitor empty legs that match your patterns; we'll text when one shows up.",
  },
];

// HowTo Schema.org JSON-LD. Google may surface this as a rich result —
// stepped how-to card under the search listing — and it gives the page
// a strong intent signal for queries like 'how to book a private jet'.
// Built straight from the STEPS array so the structured data tracks
// whatever the visible content shows.
const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to charter a private flight with JetNine",
  description:
    "From quote request to wheels-up in five steps. Senior dispatcher, real aircraft, all-in pricing, under thirty minutes to first quote.",
  totalTime: "PT30M",
  step: STEPS.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.title,
    text: s.body,
  })),
};

export default function HowItWorksPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from STEPS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <PageHero
        eyebrow="How it works"
        title="A senior dispatcher, not a chatbot. One number to call."
        lead="No app to download. No queue. No ten-minute hold music. Tell us the route — by phone, by form, by email — and a senior dispatcher picks up. Specific aircraft & pricing back within thirty minutes."
        imageSrc="/images/hero/how-it-works.webp"
        imagePosition="70% center"
      />

      {/* Stat strip */}
      <section className="border-y border-line-faint bg-ink-2" aria-label="Key numbers">
        <div className="container-jn grid grid-cols-2 gap-4 py-7 md:grid-cols-4">
          {HERO_STATS.map((s) => (
            <div key={s.label}>
              <div className="font-serif text-[30px] font-light leading-[1.05] max-md:text-[26px]">{s.value}</div>
              <div className="mt-[6px] text-[14px] text-steel">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The process */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">The process</p>
        <h2 className="title-section max-w-[22ch]">Five steps. Most clients fly within a week.</h2>
        <p className="mt-4 max-w-[62ch] text-[18px] text-bone-2">
          From first call to wheels-up. Same five steps every time, regardless of category,
          distance, or hour.
        </p>
        <StepExplorer />
      </section>

      {/* Pricing */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Pricing</p>
        <h2 className="title-section max-w-[22ch]">All-in. Locked at acceptance.</h2>
        <p className="mt-4 max-w-[62ch] text-[18px] text-bone-2">
          Every quote is the all-in number. Fuel, FET, repositioning, crew, catering, ground
          transport — already inside. Below: an example midsize round-trip, broken down line by line.
        </p>
        <div className="mt-8 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="card px-7 py-2 max-md:px-5">
            <p className="border-b border-line pb-3 pt-4 text-[14px] text-steel">
              Example · Los Angeles ⇄ New York · midsize · about 10 hours in the air
            </p>
            <ul>
              {PRICE_STACK.map((p) => (
                <li
                  key={p.n}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-b border-line-faint py-4"
                >
                  <div>
                    <div className="text-[16px] font-medium">{plainLabel(p)}</div>
                    <div className="mt-[2px] text-[14px] text-steel">{plainDesc(p)}</div>
                  </div>
                  <span className="text-[17px]">{p.val}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 pb-4 pt-5">
              <span className="font-serif text-[26px]">All-in</span>
              <span className="font-serif text-[40px] font-light leading-none">{PRICE_STACK_TOTAL}</span>
            </div>
          </div>
          <div className="card p-7 max-md:p-5">
            <h3 className="text-[19px] font-medium leading-[1.3]">
              No memberships, no hourly minimums, no annual fees.
            </h3>
            <p className="mt-[10px] text-bone-2">
              Pay per flight. The price you accept is the price you pay — even if jet-fuel spikes
              between acceptance and departure, your number is locked.
            </p>
            <Link href="/quote/mission" className="btn btn-primary btn-lg mt-5">
              Price my trip <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Comparison</p>
        <h2 className="title-section max-w-[24ch]">Why a phone call beats an app.</h2>
        <div className="card mt-8 overflow-hidden">
          {/* tabIndex + role: keyboard users must be able to scroll this on phones. */}
          <div
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabIndex={0}
            role="region"
            aria-label="Charter model comparison"
          >
            <table className="table-jn min-w-[640px] [&_td]:px-6 [&_th]:px-6">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">What we compared</span>
                  </th>
                  <th scope="col">App / marketplace</th>
                  <th scope="col" className="text-clearance">
                    JetNine
                  </th>
                </tr>
              </thead>
              <tbody>
                {VS_ROWS.map((r) => (
                  <tr key={r.row}>
                    <th scope="row" className="border-b border-line-faint py-4 text-[15px] font-normal text-bone-2">
                      {r.row}
                    </th>
                    <td className="text-steel">{r.app}</td>
                    <td>{r.jn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Our promises */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Our promises</p>
        <h2 className="title-section max-w-[22ch]">Three things we commit to in writing.</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROMISES.map((p) => (
            <article key={p.num} className="card p-7 max-md:p-5">
              <p className="text-[13px] font-semibold text-gold">{p.num}</p>
              <h3 className="title-card-sm mt-3">{p.title}</h3>
              <p className="mt-[10px] text-bone-2">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">FAQ</p>
        <h2 className="title-section max-w-[24ch]">The questions most clients ask first.</h2>
        <FaqAccordion items={FAQ} className="mt-8 max-w-[820px]" />
      </section>

      <div className="section-jn max-md:pt-20">
        <GuideGate context="how-it-works" />
      </div>

      <CtaBand
        title="One number. One conversation. One number on the invoice."
        body="Tell us the route. We'll get you in the air."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
