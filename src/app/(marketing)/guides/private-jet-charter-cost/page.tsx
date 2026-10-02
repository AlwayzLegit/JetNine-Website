import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { GuideShell } from "@/components/guide/guide-shell";
import { RateTable } from "@/components/rate-table";
import { getGuideChapter } from "@/lib/guides";
import { PRICE_STACK, PRICE_STACK_TOTAL, RATES } from "@/lib/rates";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatUSD } from "@/lib/quote-pricing";

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
];

// The data module keeps the old all-caps line labels; render them in
// sentence case (keeping the FET acronym) so the numbers stay single-sourced.
function plainLabel(label: string) {
  return label.toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\bfet\b/i, "FET");
}

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
    <GuideShell
      chapter={chapter}
      lead="The industry's least-answered question, answered with our actual numbers: the hourly rate card, a real itemized quote, what moves the price, and the honest ways to pay less."
    >
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* The short answer */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">The short answer</p>
          <h2 className="title-section max-w-[26ch]">
            {RATES[0].market.replace("/hr", "")} to {RATES[RATES.length - 1].market.replace("/hr", "")} per flight hour.
          </h2>
          <p className="mt-5 max-w-[68ch] text-[17px] leading-[1.6] text-bone-2">
            That&rsquo;s the market range across the six aircraft categories, and it&rsquo;s the honest unit to
            think in: your trip&rsquo;s price is the hourly rate for the category you need, times the
            hours the mission takes, plus tax — all of which is in the quote before you accept it.
            Most charter sites won&rsquo;t print these numbers. Here&rsquo;s our card:
          </p>
          <div className="mt-8">
            <RateTable />
          </div>
        </div>
      </section>

      {/* Itemized example */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">A real itemized quote</p>
          <h2 className="title-section max-w-[26ch]">What {PRICE_STACK_TOTAL} actually buys.</h2>
          <p className="mt-5 max-w-[68ch] text-[17px] leading-[1.6] text-bone-2">
            A midsize round trip, Los Angeles (Van Nuys) to New York (Teterboro area) and back —
            about ten hours of flight time. This is the same breakdown a JetNine quote itemizes
            before you accept:
          </p>
          <div className="card relative mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Price breakdown — scrolls sideways">
            <table className="table-jn min-w-[600px]">
              <tbody>
                {PRICE_STACK.map((row) => (
                  <tr key={row.n}>
                    <td className="w-12 text-steel">{row.n}</td>
                    <td className="font-medium text-bone">{plainLabel(row.label)}</td>
                    <td className="text-bone-2">{row.desc}</td>
                    <td className="text-right text-bone">{row.val}</td>
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td />
                  <td className="font-medium text-clearance">All-in total</td>
                  <td className="text-bone-2">Locked at acceptance — this is the invoice number</td>
                  <td className="text-right font-serif text-[26px] font-light tracking-tight text-bone">
                    {PRICE_STACK_TOTAL}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            Two things worth noticing. Repositioning is $0 here because the aircraft was already
            based on the departure coast — when it isn&rsquo;t, that line is real money, which is why
            flexible routing saves more than any coupon. And the 7.5% Federal Excise Tax applies to
            every domestic charter, whoever you book with; a quote that doesn&rsquo;t show it isn&rsquo;t
            cheaper, it&rsquo;s incomplete. Line-by-line detail is in{" "}
            <Link href="/guides/what-affects-charter-price" className="text-link-strong">
              what moves the price
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Per passenger */}
      <section className="section-jn">
        <div className="container-jn grid items-start gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Per passenger</p>
            <h2 className="title-section max-w-[20ch]">You&rsquo;re buying the aircraft, not a seat.</h2>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.6] text-bone-2">
              The quote is for the whole cabin — so the per-person math turns on how many seats you
              fill. Los Angeles to Aspen on a light jet prices at{" "}
              {aspen ? aspen.formatted : "an indicative range from our live engine"} all-in.
              {perSeat ? (
                <> With four aboard, that&rsquo;s roughly {perSeat} a seat</>
              ) : (
                <> Split across four passengers, the per-seat number lands</>
              )}{" "}
              — into a mountain airport the airlines serve badly, on your schedule, with the car on
              the ramp when you land.
            </p>
          </div>
          <div className="card card-pad max-md:p-5">
            <p className="label-jn">Worked live · Los Angeles (VNY) → Aspen (ASE) · light jet</p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="font-serif text-[32px] font-light leading-none tracking-tight text-bone max-md:text-[26px]">
                  {aspen ? aspen.formatted : "—"}
                </div>
                <div className="mt-2 text-[14px] text-bone-2">Whole aircraft, all-in</div>
              </div>
              <div>
                <div className="font-serif text-[32px] font-light leading-none tracking-tight text-clearance max-md:text-[26px]">
                  {perSeat ? `≈ ${perSeat}` : "—"}
                </div>
                <div className="mt-2 text-[14px] text-bone-2">Per seat · 4 passengers</div>
              </div>
            </div>
            <p className="mt-6 border-t border-line pt-5 text-[14px] leading-[1.6] text-bone-2">
              Computed by the same engine as the quote wizard, refreshed with the rate card. Your
              exact number depends on date and aircraft availability.
            </p>
          </div>
        </div>
      </section>

      {/* How to pay less */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">How to pay less</p>
          <h2 className="title-section max-w-[24ch]">Three honest discounts. No coupon codes.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <div key={c.n} className="card card-pad flex flex-col max-md:p-5">
                <span className="font-serif text-[48px] font-light leading-none text-clearance">{c.n}</span>
                <h3 className="title-card-sm mt-5 text-bone">{c.h}</h3>
                <p className="mt-3 flex-1 text-[16px] leading-[1.6] text-bone-2">{c.p}</p>
                <Link href={c.href} className="mt-3 inline-flex min-h-[44px] items-center text-[15px] font-medium text-bone">
                  {c.cta} <span className="arrow">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Cost questions, answered straight.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="card card-pad max-md:p-5">
                <h3 className="title-card-sm text-bone">{f.q}</h3>
                <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.6] text-bone-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
