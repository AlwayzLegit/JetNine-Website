import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "How it works",
  description:
    "A senior dispatcher, not a chatbot. One number to call. Specific airframes & pricing back within thirty minutes.",
  path: "/how-it-works",
});

const HERO_STATS = [
  { label: "Quote turnaround", value: "<30 MIN", sub: "Median, business hours" },
  { label: "Dispatcher tenure", value: "14 YR", sub: "Average on the desk" },
  { label: "Wheels-up notice", value: "2 HR", sub: "From confirmed quote" },
  { label: "Network reach", value: "20K A/C", sub: "Worldwide, 5,000 ops" },
];

const STEPS = [
  {
    num: "01",
    label: "You",
    title: "You tell us the route.",
    body: "Phone, form, or email — whichever's faster. We need the city pair, the dates, the headcount. Everything else is optional & can be sorted later.",
    metaLabel: "What we ask",
    items: [
      "Departure & arrival cities (airport optional — we'll pick the best FBO)",
      "Outbound date & flexible-hours window",
      "Passenger count & pet count",
      "Anything else? — special requests captured up front",
    ],
  },
  {
    num: "02",
    label: "Dispatch",
    title: "Dispatch picks up — within five minutes.",
    body: "A senior dispatcher (not a queue, not a chatbot, not a junior on their first month) reviews the brief and starts sourcing. Real human, every time.",
    metaLabel: "Who you get",
    items: [
      "14 years of average dispatch experience",
      "Direct line to your dispatcher for the life of the trip",
      "Same person handles the quote, the contract, and any in-flight changes",
      "24 / 7 / 365 — including holidays, weather days, and 3 a.m. callouts",
    ],
  },
  {
    num: "03",
    label: "Quote",
    title: "Three to five specific airframes return — under thirty minutes.",
    body: "Not a category bracket. Real tail numbers, real years, real photos, real availability windows, real all-in pricing. Every option vetted to our safety floor before it lands in your inbox.",
    metaLabel: "What you see",
    items: [
      "Tail number, operator, year of manufacture, refurb date",
      "Cabin photos and floorplan",
      "All-in price (fuel, taxes, FET 7.5%, repositioning, crew, catering, ground)",
      "Availability window & soft-hold expiry",
      "Operator's ARG/US, Wyvern, IS-BAO standing",
    ],
  },
  {
    num: "04",
    label: "Accept",
    title: "You pick. We hold the airframe.",
    body: "No commitment until you accept. Soft hold — up to four hours — while you decide, share with the team, get a sign-off. After that, contract goes out and the airframe locks.",
    metaLabel: "The decision window",
    items: [
      "Free 4-hour soft hold on your preferred airframe",
      "Extend by request — most operators allow 24h with a deposit",
      "One-page charter agreement (Part 295 disclosure included)",
      "Wire, ACH, or major card — your choice",
    ],
  },
  {
    num: "05",
    label: "Fly",
    title: "Confirmation, trip sheet, take-off.",
    body: "Final trip sheet hits your inbox 24 hours before departure. FBO instructions, ground transport details, crew names, weather brief. Everyone arrives ten minutes before scheduled wheels-up.",
    metaLabel: "Day of",
    items: [
      "Show up at the FBO ten minutes before scheduled departure",
      "No security line, no boarding pass — your name is on the manifest",
      "Crew greets you on the ramp, bags loaded directly",
      "Wheels up within the agreed window — average ground time, eight minutes",
    ],
  },
];

const VS_ROWS: { row: string; app: string; jn: string }[] = [
  { row: "Quote source", app: "Stale fleet database, refreshed weekly", jn: "Live operator calls, every quote" },
  { row: "Quote latency", app: "Instant, but indicative only", jn: "< 30 min, with real airframes" },
  { row: "Pricing", app: "Hourly + add-ons, surprise fees", jn: "All-in, locked at acceptance" },
  { row: "Who you talk to", app: "Tier-1 support, rotating", jn: "Same dispatcher, every flight" },
  { row: "In-flight changes", app: "Submit ticket, wait", jn: "Direct cell, no queue" },
  { row: "After-hours", app: "Voicemail, email auto-reply", jn: "Live, 24/7/365" },
];

const PRICE_STACK = [
  { n: "01", label: "AIRFRAME", desc: "Midsize · ~10h block-time · KVNY ⇄ KJFK round-trip", val: "$36,400" },
  { n: "02", label: "FUEL SURCHARGE", desc: "Variable component · indexed to weekly Jet-A spot", val: "$5,800" },
  { n: "03", label: "REPOSITIONING", desc: "Ferry leg if applicable · zero on this mission", val: "$0" },
  { n: "04", label: "CREW & CATERING", desc: "Two-pilot crew · standard cold catering · standard bar", val: "$1,400" },
  { n: "05", label: "FET (7.5%)", desc: "Federal Excise Tax on domestic charter", val: "$3,300" },
  { n: "06", label: "GROUND TRANSPORT", desc: "Black sedan · both legs · curb-to-FBO", val: "$360" },
];

const PROMISES = [
  {
    num: "PROMISE 01",
    title: "Quote in thirty minutes, or it's free.",
    body: "If we don't return three to five specific airframes within thirty minutes of business-hours request, your first hour of flight time is on us — applied automatically to the accepted booking.",
  },
  {
    num: "PROMISE 02",
    title: "Locked pricing, no surprises.",
    body: "The all-in number you accept is the number on the invoice. If anything changes — fuel, route, weather diversion — that's our cost to absorb, not yours. Period.",
  },
  {
    num: "PROMISE 03",
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
    a: "Floor: ARG/US Gold or higher, current FAA Part 135 certificate, $300M minimum hull insurance, two ATP-rated pilots, no event-of-significance in the last 24 months. We add Wyvern Wingman or IS-BAO Stage 2 as a strong preference for international and ultra-long-range missions. The full vetting protocol lives on the safety page; the short version is — we don't put you on an airframe we wouldn't put our own families on.",
  },
  {
    q: "What if the weather goes sideways?",
    a: "Your dispatcher monitors weather from twelve hours out. If a divert or delay is likely, you'll get a call, not a notification — usually with an alternate plan already drafted. Common moves: shift wheels-up by an hour, divert to an alternate FBO, swap aircraft if the original can't depart. All re-routing cost is ours. The locked price holds.",
  },
  {
    q: "Can I cancel after I've booked?",
    a: "Up to 72 hours before departure: full refund minus a $1,500 admin fee. Inside 72 hours: 50% refund. Inside 24 hours: forfeited, with one exception — documented medical or family emergency, in which case we credit 100% to a future flight within 12 months. We are not in the business of pocketing your money on a bad day.",
  },
  {
    q: "What happens if my flight is delayed by the operator?",
    a: "Mechanical or crew issue on the operator's side: we substitute another airframe at our cost, no questions, usually within two hours at major metros. If a substitution isn't possible inside your window, your flight is refunded in full plus a $5,000 inconvenience credit. Has happened twice in the last 18 months. Both times, the client flew within the window on a different airframe.",
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
    "From quote request to wheels-up in five steps. Senior dispatcher, real airframes, all-in pricing, under thirty minutes to first quote.",
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
      <PageHeader
        kicker="How it works · operations"
        title="A senior dispatcher, not a chatbot. One number to call."
        lead="No app to download. No queue. No ten-minute hold music. Tell us the route — by phone, by form, by email — and a senior dispatcher with twenty years on the desk picks up. Specific airframes & pricing back within thirty minutes. The simplest model in the industry, on purpose."
      />

      {/* Hero stat strip */}
      <section className="border-b border-ink-3 bg-ink-2 py-8">
        <div className="container-jn flex flex-wrap items-center justify-between gap-6">
          {HERO_STATS.map((s, i) => (
            <div
              key={s.label}
              className={[
                "flex min-w-[180px] flex-1 flex-col gap-1 px-6",
                i !== HERO_STATS.length - 1 ? "border-r border-ink-3" : "",
              ].join(" ")}
            >
              <span className="font-serif text-[28px] font-light leading-none tracking-tight text-bone">
                {s.value}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                {s.label}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                {s.sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Process ─── */}
      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-20 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— The process</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                Five steps. Most clients fly within a week.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                From first call to wheels-up. Same five steps every time, regardless of category,
                distance, or hour.
              </Reveal>
            </div>
          </div>

          <ol className="flex flex-col gap-4">
            {STEPS.map((s, i) => (
              <Reveal
                key={s.num}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className="grid grid-cols-1 gap-8 rounded-[4px] border border-ink-3 bg-ink-2 p-10 lg:grid-cols-[auto_1.2fr_1.4fr] lg:items-start"
              >
                <div className="flex items-baseline gap-4 lg:flex-col lg:items-start lg:gap-1">
                  <span className="font-serif text-[64px] font-light leading-none text-clearance">
                    {s.num}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                    — {s.label}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone">
                    {s.title}
                  </h3>
                  <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.65] text-bone-2">
                    {s.body}
                  </p>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — {s.metaLabel}
                  </span>
                  <ul className="mt-3 flex flex-col gap-2">
                    {s.items.map((it) => (
                      <li
                        key={it}
                        className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[13px] leading-[1.5] text-bone"
                      >
                        <span className="text-clearance">—</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Dispatch vs apps ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Comparison</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Why a phone call beats an app.
            </Reveal>
          </div>
          <Reveal as="p" className="mb-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            The trade in private aviation has gotten cute. Apps that quote in seconds because they
            don&rsquo;t actually know what&rsquo;s available. Marketplaces that bid you against four
            other clients. Membership tiers with hidden hourly minimums. We don&rsquo;t do any of it.
          </Reveal>
          <Reveal stagger={1} as="p" className="mb-12 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            The senior dispatcher model is older, slower in the wrong ways, faster in the right
            ones. It&rsquo;s how charter has worked at the high end since the 1970s. It still works.
          </Reveal>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr>
                  {["", "App / marketplace", "JetNine"].map((h, i) => (
                    <th
                      key={h || i}
                      className={[
                        "border-b border-ink-3 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.16em]",
                        i === 2 ? "text-clearance" : "text-bone-2",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VS_ROWS.map((r) => (
                  <tr key={r.row} className="border-b border-ink-3">
                    <td className="px-6 py-5 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                      {r.row}
                    </td>
                    <td className="px-6 py-5 text-[14px] leading-[1.55] text-bone-2">{r.app}</td>
                    <td className="px-6 py-5 text-[14px] leading-[1.55] text-bone">{r.jn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Pricing example ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Pricing</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                All-in. Locked at acceptance.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                Every quote is the all-in number. Fuel, FET, repositioning, crew, catering, ground
                transport — already inside. You won&rsquo;t see surprise lines on the final invoice.
                Below: an example midsize round-trip, broken down line by line.
              </Reveal>
            </div>
          </div>

          <Reveal stagger={1} className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 sm:p-14">
            <ul className="divide-y divide-ink-3">
              {PRICE_STACK.map((p) => (
                <li
                  key={p.n}
                  className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 py-5"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-clearance">
                    {p.n}
                  </span>
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
                      {p.label}
                    </div>
                    <div className="mt-1 text-[13px] leading-[1.5] text-bone-2">{p.desc}</div>
                  </div>
                  <span className="font-mono text-[14px] tracking-[0.04em] text-bone">{p.val}</span>
                </li>
              ))}
              <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 border-t-2 border-clearance py-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-clearance">
                  Σ
                </span>
                <span className="font-serif text-[26px] font-normal leading-tight text-bone">
                  All-in
                </span>
                <span
                  className="font-serif text-[36px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  $47,260
                </span>
              </li>
            </ul>
            <p className="mt-8 max-w-[68ch] rounded-[2px] border border-ink-3 bg-ink p-6 text-[14px] leading-[1.6] text-bone-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                — Note
              </span>
              <br />
              <strong className="font-medium text-bone">
                No memberships, no hourly minimums, no annual fees.
              </strong>{" "}
              Pay per flight. The price you accept is the price you pay — even if jet-fuel spikes
              between acceptance and departure, your number is locked.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── The promises ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Our promises</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
              Three things we commit to in writing.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROMISES.map((p, i) => (
              <Reveal
                key={p.num}
                stagger={(i as 0 | 1 | 2)}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-10"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                  — {p.num}
                </span>
                <h3 className="mt-6 font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {p.title}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.6] text-bone-2">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— FAQ</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              The questions most clients ask first.
            </Reveal>
          </div>
          <div className="mx-auto max-w-[78ch] divide-y divide-ink-3 border-y border-ink-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <h3 className="font-serif text-[20px] font-normal leading-[1.3] tracking-tight text-bone transition-colors group-hover:text-clearance">
                    <span className="mr-3 font-mono text-[11px] tracking-[0.14em] text-clearance">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {f.q}
                  </h3>
                  <span className="font-mono text-[14px] text-clearance transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-[72ch] pl-9 text-[15px] leading-[1.7] text-bone-2">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="One number. One conversation. One number on the invoice."
        body="Tell us the route. We'll get you in the air."
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
