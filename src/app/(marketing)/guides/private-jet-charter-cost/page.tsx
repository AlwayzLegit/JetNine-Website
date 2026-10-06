import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { RateTable } from "@/components/rate-table";
import { QuoteLauncher } from "@/components/quote-launcher";
import { CtaBand } from "@/components/cta-band";
import { SourcesStrip, type Source } from "@/components/light/sources-strip";
import { WindowButton } from "@/components/light/window";
import { getGuideChapter } from "@/lib/guides";
import { PRICE_STACK, PRICE_STACK_TOTAL, RATES } from "@/lib/rates";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatUSD } from "@/lib/quote-pricing";
import { SplitHero } from "@/components/guide-long/hero";
import { FaqJsonLd, FaqList } from "@/components/guide-long/faq";
import { SourcesBody } from "@/components/guide-long/sources-body";
import { Byline, ChapterJsonLd, ChapterKicker, ChapterNav } from "@/components/guide-long/chapter";
import { AutoGrid, Icon, type IconName } from "@/components/guide-long/ui";

// Cornerstone of the pricing guide. Audit evidence: one cost page is
// ~30% of the entire organic traffic at each of the two closest
// competitors — and neither prints a real dollar figure. Every number
// on this page comes from the shared rate card, the published itemized
// sample, or the quote engine.
export const metadata: Metadata = pageMetadata({
  title: "How Much Does a Private Jet Cost? (2026)",
  description:
    "Straight answer with real rates: $3,200–$11,200/hr by category, an itemized $47,260 coast-to-coast quote, per-passenger math, and how to pay 30–60% less.",
  path: "/guides/private-jet-charter-cost",
});

const chapter = getGuideChapter("private-jet-charter-cost")!;

// Built with the live engine's LA→Aspen range so the FAQ can never
// disagree with the worked example on the same page.
const buildFaq = (aspenRange: string) => [
  {
    q: "How much does it cost to charter a private jet?",
    a: `At market rates, $3,200–$11,200 per flight hour depending on aircraft category. A short light-jet hop like LA to Aspen runs about ${aspenRange} all-in; a coast-to-coast midsize round trip runs about $47,000 including fuel, crew, FET, and ground transfer. JetNine publishes the full rate card and locks the number at acceptance.`,
  },
  {
    q: "What's the cheapest way to fly private?",
    a: "An empty leg — a repositioning flight sold at 30–60% off, occasionally more. The trade is a locked date and route. Second cheapest: flexible dates on a light jet or turboprop, quoted on-demand with no membership.",
  },
  {
    q: "Are there hidden fees on top of the quote?",
    a: "Not on ours. A JetNine quote is the all-in number — flight time, fuel, crew, landing, repositioning, 7.5% FET, standard catering, sedan transfer — and it's locked at acceptance. Premium catering, de-icing, and international handling are itemized before you accept, never after.",
  },
  {
    q: "Do I need a membership or jet card to charter?",
    a: "No. On-demand charter is the default — pay per flight at market rates. The JetNine Card exists for frequent flyers who want rates locked from $2,950/hr for 24 months, but nothing on this page requires it.",
  },
  {
    q: "Is chartering cheaper per person for a group?",
    a: "It gets close to premium-cabin airline pricing faster than most people expect: the aircraft price is fixed, so six passengers on a $15,000 flight pay $2,500 a seat — with no security line, positioning to a closer airport, and the schedule you chose.",
  },
  {
    q: "What can change after an estimate?",
    a: "Dates, airports, passenger count, luggage and aircraft availability all move an estimate. Once you accept a quote for a specific aircraft, the price is locked under the agreement.",
  },
];

// The data module keeps the old all-caps line labels; render them in
// sentence case (keeping the FET acronym) so the numbers stay single-sourced.
function plainLabel(label: string) {
  return label.toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\bfet\b/i, "FET");
}

// jn-light-chrome.js SOURCES.cost
const SOURCES: Source[] = [
  { name: "NBAA", body: "Questions to ask about total pricing and contract terms.", linkLabel: "Open charter checklist", href: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/" },
  { name: "FAA", body: "Check the operating carrier before booking.", linkLabel: "Open consumer guidance", href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft" },
  { name: "IRS", body: "Review applicable U.S. air transportation taxes.", linkLabel: "Open tax guidance", href: "https://www.irs.gov/" },
  { name: "NATA", body: "Understand positioning and minimum daily usage.", linkLabel: "Open consumer guide", href: "https://www.nata.aero/" },
];
const SOURCES_NOTE = "These organizations do not endorse JetNine.";

const PARTS: [string, IconName][] = [
  ["Flight charges", "send"],
  ["Positioning", "pin"],
  ["Trip expenses", "fuel"],
  ["Taxes", "page"],
];

const FACTORS: [string, string, IconName][] = [
  ["Aircraft choice", "Cabin, luggage and mission requirements.", "send"],
  ["Route & flight time", "Distance, routing and possible fuel stops.", "route"],
  ["Aircraft positioning", "Where the available aircraft starts its trip.", "pin"],
  ["Dates & availability", "Your departure window and market demand.", "cal"],
  ["Airports & handling", "Airport choice and ground services.", "tower"],
  ["Time away", "Crew nights and minimum-use requirements.", "clock"],
];

const RAIL = [
  ["Trip pricing", "#pricing"],
  ["Cost factors", "#factors"],
  ["Example breakdown", "#example"],
  ["Per passenger", "#per-seat"],
  ["Better value", "#value"],
  ["FAQs", "#faqs"],
];

const sourcesLink = (label: string) => (
  <WindowButton
    label={<>{label} <span aria-hidden="true">↗</span></>}
    className="border-0 bg-transparent p-0 text-[14px] font-semibold text-bone underline decoration-line underline-offset-4 hover:text-gold"
    title="Sources & useful guidance"
    sub="Understand what supports your quote."
    variant="drawer"
  >
    <SourcesBody sources={SOURCES} note={SOURCES_NOTE} />
  </WindowButton>
);

export default function CharterCostPage() {
  // Worked example computed by the live engine so it can never
  // contradict a real quote for the same trip.
  const vny = findAirport("VNY");
  const ase = findAirport("ASE");
  const aspen =
    vny && ase
      ? computeIndicative({
          category: "light",
          legs: [{ id: "s", fromIata: "VNY", toIata: "ASE", distanceNm: distanceNm(vny, ase) }],
        })
      : null;
  const perSeat = aspen ? formatUSD(Math.round((aspen.low + aspen.high) / 2 / 4 / 50) * 50) : null;

  const FAQ = buildFaq(aspen ? aspen.formatted : "$9,500 – $13,000");

  return (
    <>
      <ChapterJsonLd chapter={chapter} />
      <FaqJsonLd items={FAQ} />

      <SplitHero
        crumb="Private jet charter cost"
        kicker={<ChapterKicker chapter={chapter} />}
        title={chapter.title}
        titleMax="16ch"
        subtitleSerif={false}
        subtitle="Understand the complete trip price, the factors that change it, and what to ask before you book."
        description={
          <>
            The industry&rsquo;s least-answered question, answered with our actual numbers: the hourly rate card, a real
            itemized quote, what moves the price, and the honest ways to pay less.
            <span className="mt-3 block">
              <Byline className="m-0" />
            </span>
          </>
        }
        image="/images/light/page-02-hero.webp"
        imagePosition="center 60%"
        caption="A clearer picture of your complete itinerary."
        actions={
          <>
            <Link href="/quote/mission" className="btn btn-primary h-[46px]">
              Request a quote <span aria-hidden="true">↗</span>
            </Link>
            <a href="#example" className="whitespace-nowrap border-b border-line pb-[3px] text-[15px] font-semibold text-bone">
              Explore the cost breakdown <span aria-hidden="true">↓</span>
            </a>
          </>
        }
      />

      <nav aria-label="In this guide" className="border-b border-line bg-ink">
        <div className="container-jn flex flex-wrap items-center text-[13px]">
          <span className="py-3 pr-6 text-[12px] font-semibold uppercase tracking-[.16em] text-gold">In this guide</span>
          {RAIL.map(([l, h], i) => (
            <a
              key={h}
              href={h}
              className={`flex-1 whitespace-nowrap border-l border-line-faint px-2 py-3 text-center ${i === 0 ? "font-semibold text-gold" : "text-bone hover:text-gold"}`}
            >
              {l}
            </a>
          ))}
        </div>
      </nav>

      <section id="pricing" className="container-jn grid items-start gap-10 pb-[26px] pt-[30px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
        <div>
          <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">01 / Understand the total</p>
          <h2 className="m-0 font-serif text-[clamp(30px,7vw,36px)] font-normal leading-[1.08] tracking-[-.01em]">An hourly rate is only the starting point.</h2>
          <p className="mt-[10px] text-[16px] text-steel">The total depends on how the aircraft serves your whole itinerary.</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 rounded-[3px] border border-line bg-white px-5 py-[26px] text-center max-sm:flex-wrap max-sm:justify-center">
            {PARTS.map(([l, d], i) => (
              <span key={l} className="contents">
                <span className="flex min-w-0 flex-[1_1_0] flex-col items-center gap-[10px] max-sm:flex-[1_1_40%]">
                  <Icon name={d} size={34} />
                  <span className="font-serif text-[19px]">{l}</span>
                </span>
                {i < PARTS.length - 1 ? (
                  <span aria-hidden="true" className="text-[22px] text-gold max-sm:hidden">
                    +
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-steel">Some quotes bundle these costs. A JetNine quote includes all four — confirm what any quote includes.</p>
        </div>
      </section>

      <section className="container-jn pb-9">
        <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">The short answer</p>
        <h2 className="m-0 max-w-[26ch] font-serif text-[clamp(28px,6vw,34px)] font-normal leading-[1.1]">
          {RATES[0].market.replace("/hr", "")} to {RATES[RATES.length - 1].market.replace("/hr", "")} per flight hour.
        </h2>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
          That&rsquo;s the market range across the aircraft categories, and it&rsquo;s the honest unit to think in: your
          trip&rsquo;s price is the hourly rate for the category you need, times the hours the mission takes, plus tax — all of
          which is in the quote before you accept it. Most charter sites won&rsquo;t print these numbers. Here&rsquo;s our card:
        </p>
        <div className="mt-6">
          <RateTable />
        </div>
      </section>

      <section id="factors" className="border-y border-line bg-white">
        <div className="container-jn py-9">
          <h2 className="m-0 font-serif text-[clamp(30px,7vw,36px)] font-normal leading-[1.12] tracking-[-.01em]">What shapes your charter price?</h2>
          <div className="mt-[22px] grid border-t border-line" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
            {FACTORS.map(([t, b, d]) => (
              <div key={t} className="mr-6 grid grid-cols-[44px_minmax(0,1fr)] gap-[14px] border-b border-line py-[22px] pr-6 max-sm:mr-0 max-sm:pr-0">
                <Icon name={d} size={38} />
                <div>
                  <h3 className="m-0 font-serif text-[20px] font-normal leading-[1.2]">{t}</h3>
                  <p className="mt-1 text-[14px] text-steel">{b}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[14px] text-steel">
            Line-by-line detail is in{" "}
            <Link href="/guides/what-affects-charter-price" className="text-link-strong">
              what moves the price
            </Link>{" "}
            and{" "}
            <Link href="/guides/private-jet-charter-fees" className="text-link-strong">
              charter fees and additional charges
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="example" className="bg-ink">
        <div className="container-jn grid items-start gap-12 py-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          <div>
            <span className="inline-block whitespace-nowrap rounded-full bg-surface-2 px-3 py-[5px] text-[12px] font-semibold uppercase tracking-[.14em] text-gold">
              A real itemized quote
            </span>
            <h2 className="m-0 mt-3 font-serif text-[clamp(30px,7vw,36px)] font-normal leading-[1.1] tracking-[-.01em]">
              What {PRICE_STACK_TOTAL} actually buys.
            </h2>
            <p className="mt-[10px] text-[16px] text-steel">
              A midsize round trip, Los Angeles (Van Nuys) to New York and back — about ten hours of flight time. This is the
              same breakdown a JetNine quote itemizes before you accept.
            </p>
            <div className="on-navy mt-[22px] rounded-[2px] bg-navy px-[22px] py-[18px] text-white">
              <div className="text-[13px] text-navy-on-2">All-in total</div>
              <div className="mt-[2px] font-serif leading-[1.05]" style={{ fontSize: "clamp(34px, 9vw, 46px)" }}>
                {PRICE_STACK_TOTAL}
              </div>
              <div className="mt-[6px] text-[12px] text-navy-on-2">Locked at acceptance — this is the invoice number</div>
            </div>
          </div>
          <div>
            <div className="overflow-hidden rounded-[3px] border border-line bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-line bg-surface-2 px-[18px] py-3 text-[14px] font-semibold">
                <span>Line item</span>
                <span>Amount</span>
              </div>
              {PRICE_STACK.map((r) => (
                <div key={r.n} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line px-[18px] py-[13px] text-[15px]">
                  <span>
                    {plainLabel(r.label)} <span className="block text-[13px] text-steel sm:inline">· {r.desc}</span>
                  </span>
                  <span>{r.val}</span>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] px-[18px] py-[14px] text-[15px] font-semibold">
                <span>All-in total</span>
                <span>{PRICE_STACK_TOTAL}</span>
              </div>
            </div>
            <div className="mt-[10px] flex flex-wrap items-center justify-between gap-4">
              <p className="m-0 max-w-[52ch] text-[12px] text-steel">
                Repositioning is $0 here because the aircraft was already based on the departure coast. The 7.5% Federal
                Excise Tax applies to every domestic charter; a quote without it isn&rsquo;t cheaper, it&rsquo;s incomplete.
              </p>
              <WindowButton
                label={<>View breakdown <span aria-hidden="true">↗</span></>}
                className="whitespace-nowrap border-0 bg-transparent p-0 text-[14px] font-semibold text-bone underline decoration-line underline-offset-4"
                title="How this trip total is calculated"
                sub="The published sample quote: Los Angeles (VNY) ⇄ New York, midsize."
              >
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[460px] border-collapse text-[14px]">
                    <thead>
                      <tr className="bg-surface-2">
                        {["Line item", "What it covers", "Amount"].map((t, i) => (
                          <th key={t} className={`border-b border-line px-3 py-[10px] font-semibold ${i === 2 ? "text-right" : "text-left"}`}>
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PRICE_STACK.map((r) => (
                        <tr key={r.n}>
                          <td className="border-b border-line px-3 py-[11px]">{plainLabel(r.label)}</td>
                          <td className="border-b border-line px-3 py-[11px] text-steel">{r.desc}</td>
                          <td className="border-b border-line px-3 py-[11px] text-right">{r.val}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-navy font-semibold text-white">
                        <td colSpan={2} className="p-3">
                          All-in total
                        </td>
                        <td className="p-3 text-right">{PRICE_STACK_TOTAL}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-4 rounded-[3px] border border-line px-4 py-[14px] text-[14px]">
                  <b>Itemized separately, before you accept</b>
                  <br />
                  <span className="text-steel">Premium catering, de-icing and international handling.</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <Link href="/guides/what-affects-charter-price" className="text-link text-[14px] font-semibold">
                    What moves each line
                  </Link>
                  <Link href="/quote/mission" className="btn btn-primary btn-sm">
                    Request a quote <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </WindowButton>
            </div>
          </div>
        </div>
      </section>

      <section id="per-seat" className="border-t border-line bg-ink">
        <div className="container-jn grid items-start gap-10 py-10 lg:grid-cols-2">
          <div>
            <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">Per passenger</p>
            <h2 className="m-0 max-w-[20ch] font-serif text-[clamp(30px,7vw,36px)] font-normal leading-[1.1]">You&rsquo;re buying the aircraft, not a seat.</h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-[1.6] text-bone-2">
              The quote is for the whole cabin — so the per-person math turns on how many seats you fill. Los Angeles to Aspen
              on a light jet prices at {aspen ? aspen.formatted : "an indicative range from our live engine"} all-in.
              {perSeat ? <> With four aboard, that&rsquo;s roughly {perSeat} a seat</> : <> Split across four passengers, the per-seat number lands</>} — into a
              mountain airport the airlines serve badly, on your schedule, with the car on the ramp when you land.
            </p>
          </div>
          <div className="rounded-[3px] border border-line bg-white p-6 max-md:p-5">
            <p className="text-[13px] font-semibold text-steel">Worked live · Los Angeles (VNY) → Aspen (ASE) · light jet</p>
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <div className="font-serif text-[30px] leading-none tracking-tight max-md:text-[24px]">{aspen ? aspen.formatted : "—"}</div>
                <div className="mt-2 text-[14px] text-bone-2">Whole aircraft, all-in</div>
              </div>
              <div>
                <div className="font-serif text-[30px] leading-none tracking-tight text-gold max-md:text-[24px]">{perSeat ? `≈ ${perSeat}` : "—"}</div>
                <div className="mt-2 text-[14px] text-bone-2">Per seat · 4 passengers</div>
              </div>
            </div>
            <p className="mt-5 border-t border-line pt-4 text-[13px] leading-[1.6] text-bone-2">
              Computed by the same engine as the quote wizard, refreshed with the rate card. Your exact number depends on date
              and aircraft availability.
            </p>
          </div>
        </div>
      </section>

      <section id="value" className="border-y border-line bg-white">
        <div className="container-jn py-10">
          <div className="grid items-start gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
            <div>
              <h2 className="m-0 max-w-[18ch] font-serif text-[clamp(30px,7vw,36px)] font-normal leading-[1.1] tracking-[-.01em]">
                Better value starts with the right questions.
              </h2>
              <ul className="m-0 mt-[18px] flex list-none flex-col gap-[10px] p-0">
                {["Compare suitable aircraft by total trip price.", "Ask about nearby airports and flexible departure windows.", "Compare same-day and later-return options."].map((q) => (
                  <li key={q} className="flex items-center gap-3 text-[16px]">
                    <Icon name="check" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-[14px] rounded-[3px] border border-line bg-ink p-[22px]">
              <Icon name="page" size={30} />
              <div>
                <h3 className="m-0 font-serif text-[21px] font-normal leading-[1.2]">Know who operates your flight.</h3>
                <p className="mb-3 mt-[6px] text-[14px] text-steel">Verify the operating carrier and request clear inclusions, exclusions and terms.</p>
                <div className="flex flex-wrap gap-4">
                  {sourcesLink("FAA charter guidance")}
                  <span aria-hidden="true" className="text-line">
                    |
                  </span>
                  {sourcesLink("NBAA quote checklist")}
                </div>
              </div>
            </div>
          </div>

          <p className="mb-[10px] mt-12 text-[12px] font-semibold uppercase tracking-[.16em] text-gold">How to pay less</p>
          <h3 className="m-0 font-serif text-[28px] font-normal leading-[1.15]">Three honest discounts. No coupon codes.</h3>
          <AutoGrid min={240} gap="gap-3" className="mt-5">
            {[
              {
                n: "01",
                h: "Fly an empty leg.",
                p: "Repositioning flights sell at 30–60% off, occasionally deeper — same aircraft, same crew, locked date and route. Our live board lists them and the SMS watchlist texts you when your lane shows up.",
                href: "/empty-legs",
                cta: "See the live board",
              },
              {
                n: "02",
                h: "Be flexible on routing.",
                p: "Repositioning is the biggest avoidable line item. Shifting a departure day toward where aircraft already are — or accepting the region's secondary airport — regularly beats any negotiation.",
                href: "/guides/what-affects-charter-price",
                cta: "The price drivers",
              },
              {
                n: "03",
                h: "Lock rates if you fly often.",
                p: `The JetNine Card fixes hourly rates from ${RATES[0].locked.toLowerCase()} for 24 months with no peak surcharges — worth the math at roughly 25+ flight hours a year. Below that, stay on-demand; we'll tell you the same.`,
                href: "/memberships",
                cta: "Compare programs",
              },
            ].map((c) => (
              <div key={c.n} className="flex flex-col border border-line bg-ink p-5">
                <span className="font-serif text-[40px] leading-none text-gold">{c.n}</span>
                <h4 className="mt-4 font-serif text-[21px] font-normal leading-[1.2]">{c.h}</h4>
                <p className="mt-2 flex-1 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
                <Link href={c.href} className="mt-3 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-bone hover:text-gold">
                  {c.cta} <span className="arrow ml-1">→</span>
                </Link>
              </div>
            ))}
          </AutoGrid>
        </div>
      </section>

      <section id="faqs" className="container-jn pb-2 pt-9">
        <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.12] tracking-[-.01em]">Common questions, clear answers.</h2>
        <FaqList items={FAQ} name="cost-faq" variant="rule" className="mt-[14px]" />
      </section>

      <ChapterNav chapter={chapter} />

      <QuoteLauncher
        context={`guide-${chapter.slug}`}
        heading="Numbers read. Now price yours."
        body="Route, date, and passenger count — the same engine behind every figure in this guide, live on your trip."
      />

      <CtaBand
        title="Your itinerary. A clearer estimate."
        body="Share your route, dates, passenger count and luggage requirements."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={null}
      />
      <SourcesStrip sources={SOURCES} note="Guidance is jurisdiction-specific. These organizations do not endorse JetNine." drawerSub="Understand what supports your quote." />
    </>
  );
}
