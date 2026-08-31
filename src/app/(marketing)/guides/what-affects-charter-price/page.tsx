import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { GuideShell } from "@/components/guide/guide-shell";
import { getGuideChapter } from "@/lib/guides";
import { PRICE_STACK, PRICE_STACK_TOTAL } from "@/lib/rates";

export const metadata: Metadata = pageMetadata({
  title: "What Drives a Private Jet Charter Price",
  description:
    "The six line items behind every charter quote — airframe time, fuel, repositioning, crew & catering, 7.5% FET, ground — mapped to a real $47,260 example, with the levers you control.",
  path: "/guides/what-affects-charter-price",
});

const chapter = getGuideChapter("what-affects-charter-price")!;

// Each driver maps 1:1 to a line of the published itemized quote
// (PRICE_STACK), with what moves it and whether the traveler can.
const DRIVERS = [
  {
    stack: PRICE_STACK[0],
    h: "Airframe time is the price.",
    p: "Category hourly rate × block time — engine start to shutdown, both directions. It dwarfs everything else on the invoice, which is why the two decisions that matter are category (don't buy a heavy jet for a light-jet mission) and routing (fewer flown hours beats every other saving combined).",
    lever: "Yours: right-size the category; the wizard recommends one per route.",
  },
  {
    stack: PRICE_STACK[1],
    h: "Fuel rides the market.",
    p: "Indexed to the weekly Jet-A spot price, and the reason two identical trips a month apart can differ by a few percent. On a JetNine quote it's priced in and locked at acceptance — if the spot moves after you accept, that's our cost to absorb, not a surcharge.",
    lever: "Nobody's — but locking at acceptance makes it our risk, not yours.",
  },
  {
    stack: PRICE_STACK[2],
    h: "Repositioning is the avoidable one.",
    p: "If the right airframe isn't already near your departure airport, it ferries in — and that flying gets built into your price. It's $0 in the example because the aircraft was home-based on the departure coast. This line is why flexibility on dates or nearby airports saves real money, and why empty legs (someone else's repositioning) sell at 30–60% off.",
    lever: "Yours, largely: flex the date, consider the secondary airport, watch the legs board.",
  },
  {
    stack: PRICE_STACK[3],
    h: "Crew and catering are mostly fixed.",
    p: "Two ATP-rated pilots on every flight is a safety floor, not an option, so crew cost doesn't flex. Catering does: standard cold service rides included; premium tiers and specific requests are itemized before you accept, never discovered after.",
    lever: "Partly yours: catering tier and ground choices are itemized options.",
  },
  {
    stack: PRICE_STACK[4],
    h: "FET is the law, not a fee.",
    p: "The 7.5% Federal Excise Tax applies to every domestic charter, whoever brokers it. A competitor's quote without it isn't cheaper — it's a number that will grow later. We print it on every quote so the total you compare is the total you pay.",
    lever: "Nobody's. Distrust any quote that hides it.",
  },
  {
    stack: PRICE_STACK[5],
    h: "Ground is the rounding error done right.",
    p: "Sedan transfer curb-to-FBO is included on our quotes; an SUV upgrade is a line item, not a surprise. It's the smallest number on the invoice and the first impression of the trip — which is exactly why it shouldn't be an afterthought bolted on at the ramp.",
    lever: "Yours: sedan included, upgrades itemized up front.",
  },
];

export default function PriceDriversPage() {
  return (
    <GuideShell
      chapter={chapter}
      lead={`Every quote is six numbers. Here they are on a real ${PRICE_STACK_TOTAL} transcon round trip — what moves each one, and which levers are actually yours to pull.`}
    >
      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {DRIVERS.map((d, i) => (
              <Reveal
                key={d.stack.n}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[auto_240px_1fr]"
              >
                <span className="font-mono text-[36px] font-light leading-none text-clearance">
                  {d.stack.n}
                </span>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
                    {d.stack.label}
                  </div>
                  <div className="mt-3 font-serif text-[30px] font-light leading-none tracking-tight text-bone">
                    {d.stack.val}
                  </div>
                  <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-steel">
                    On the {PRICE_STACK_TOTAL} example
                  </div>
                </div>
                <div>
                  <h2 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                    {d.h}
                  </h2>
                  <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.65] text-bone-2">{d.p}</p>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] leading-[1.8] text-clearance">
                    — Lever: {d.lever}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="mt-10 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            The full worked example lives in{" "}
            <Link href="/guides/private-jet-charter-cost" className="text-clearance">
              what charter costs
            </Link>{" "}
            and on{" "}
            <Link href="/how-it-works" className="text-clearance">
              how it works
            </Link>
            . To see the six numbers on your own route,{" "}
            <Link href="/cost-calculator" className="text-clearance">
              the calculator
            </Link>{" "}
            takes about ninety seconds.
          </p>
        </div>
      </section>
    </GuideShell>
  );
}
