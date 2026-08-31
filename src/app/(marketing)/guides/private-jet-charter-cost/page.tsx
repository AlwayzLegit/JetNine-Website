import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
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
    "Straight answer with real rates: $3,200–$11,200/hr at market by category, a fully itemized $47,260 transcon quote, per-passenger math, and how to pay 30–60% less.",
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
      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— The short answer</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            {RATES[0].market.replace("/hr", "")} to {RATES[RATES.length - 1].market.replace("/hr", "")} per flight hour.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            That&rsquo;s the market range across the six aircraft categories, and it&rsquo;s the honest unit to
            think in: your trip&rsquo;s price is the hourly rate for the category you need, times the
            hours the mission takes, plus tax — all of which is in the quote before you accept it.
            Most charter sites won&rsquo;t print these numbers. Here&rsquo;s our card:
          </Reveal>
          <div className="mt-12">
            <RateTable />
          </div>
        </div>
      </section>

      {/* Itemized example */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— A real itemized quote</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            What {PRICE_STACK_TOTAL} actually buys.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
            A midsize round trip, Los Angeles (Van Nuys) to New York (Teterboro area) and back —
            about ten hours of block time. This is the same breakdown a JetNine quote itemizes
            before you accept:
          </Reveal>
          <Reveal className="mt-12 overflow-x-auto rounded-[4px] border border-ink-3 bg-ink">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <tbody>
                {PRICE_STACK.map((row) => (
                  <tr key={row.n} className="border-b border-ink-3">
                    <td className="px-6 py-4 font-mono text-[11px] text-clearance">{row.n}</td>
                    <td className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-bone">
                      {row.label}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-bone-2">{row.desc}</td>
                    <td className="px-6 py-4 text-right font-mono text-[13px] text-bone">{row.val}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-6 py-5" />
                  <td className="px-6 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-clearance">
                    All-in total
                  </td>
                  <td className="px-6 py-5 text-[13px] text-bone-2">
                    Locked at acceptance — this is the invoice number
                  </td>
                  <td className="px-6 py-5 text-right font-serif text-[24px] font-light tracking-tight text-bone">
                    {PRICE_STACK_TOTAL}
                  </td>
                </tr>
              </tbody>
            </table>
          </Reveal>
          <p className="mt-6 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            Two things worth noticing. Repositioning is $0 here because the airframe was already
            based on the departure coast — when it isn&rsquo;t, that line is real money, which is why
            flexible routing saves more than any coupon. And the 7.5% Federal Excise Tax applies to
            every domestic charter, whoever you book with; a quote that doesn&rsquo;t show it isn&rsquo;t
            cheaper, it&rsquo;s incomplete. Line-by-line detail is in{" "}
            <Link href="/guides/what-affects-charter-price" className="text-clearance">
              what moves the price
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Per passenger */}
      <section className="border-t border-ink-3 py-24 max-md:py-16">
        <div className="container-jn grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Reveal>
              <p className="caption mb-6">— Per passenger</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[20ch]">
              You&rsquo;re buying the aircraft, not a seat.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[56ch] text-[17px] leading-[1.6] text-bone-2">
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
            </Reveal>
          </div>
          <Reveal stagger={2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — Worked live · KVNY → KASE · light jet
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="font-serif text-[30px] font-light leading-none tracking-tight text-bone">
                  {aspen ? aspen.formatted : "—"}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                  Whole aircraft, all-in
                </div>
              </div>
              <div>
                <div className="font-serif text-[30px] font-light leading-none tracking-tight text-clearance">
                  {perSeat ? `≈ ${perSeat}` : "—"}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                  Per seat · 4 passengers
                </div>
              </div>
            </div>
            <p className="mt-6 border-t border-ink-3 pt-5 text-[13px] leading-[1.6] text-bone-2">
              Computed by the same engine as the quote wizard, refreshed with the rate card. Your
              exact number depends on date and airframe availability.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How to pay less */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— How to pay less</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
            Three honest discounts. No coupon codes.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                h: "Fly an empty leg.",
                p: "Repositioning flights sell at 30–60% off, occasionally deeper — same airframe, same crew, locked date and route. Our live board lists them and the SMS watchlist texts you when your lane shows up.",
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
            ].map((c, i) => (
              <Reveal key={c.n} stagger={(i % 3) as 0 | 1 | 2} className="flex flex-col rounded-[4px] border border-ink-3 bg-ink p-10">
                <span className="font-mono text-[42px] font-light leading-none text-clearance">{c.n}</span>
                <h3 className="mt-6 font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {c.h}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
                <Link href={c.href} className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                  {c.cta} <span className="arrow">→</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-ink-3 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Cost questions, answered straight</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
