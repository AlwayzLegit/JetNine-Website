import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { GuideShell } from "@/components/guide/guide-shell";
import { getGuideChapter } from "@/lib/guides";
import { PRICE_STACK, PRICE_STACK_TOTAL } from "@/lib/rates";

export const metadata: Metadata = pageMetadata({
  title: "What Drives a Private Jet Charter Price",
  description:
    "The six line items behind every charter quote — aircraft time, fuel, repositioning, crew & catering, 7.5% FET, ground — and the levers you control.",
  path: "/guides/what-affects-charter-price",
});

const chapter = getGuideChapter("what-affects-charter-price")!;

// Each driver maps 1:1 to a line of the published itemized quote
// (PRICE_STACK), with what moves it and whether the traveler can.
const DRIVERS = [
  {
    stack: PRICE_STACK[0],
    h: "Aircraft time is the price.",
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
    p: "If the right aircraft isn't already near your departure airport, it ferries in — and that flying gets built into your price. It's $0 in the example because the aircraft was home-based on the departure coast. This line is why flexibility on dates or nearby airports saves real money, and why empty legs (someone else's repositioning) sell at 30–60% off.",
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
    p: "Sedan transfer from your curb to the private terminal is included on our quotes; an SUV upgrade is a line item, not a surprise. It's the smallest number on the invoice and the first impression of the trip — which is exactly why it shouldn't be an afterthought bolted on at the ramp.",
    lever: "Yours: sedan included, upgrades itemized up front.",
  },
];

// The data module keeps the old all-caps line labels; render them in
// sentence case (keeping the FET acronym) so the numbers stay single-sourced.
function plainLabel(label: string) {
  return label.toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\bfet\b/i, "FET");
}

export default function PriceDriversPage() {
  return (
    <GuideShell
      chapter={chapter}
      lead={`Every quote is six numbers. Here they are on a real ${PRICE_STACK_TOTAL} coast-to-coast round trip — what moves each one, and which levers are actually yours to pull.`}
    >
      <section className="section-jn">
        <div className="container-jn">
          <ol className="flex flex-col gap-4">
            {DRIVERS.map((d) => (
              <li
                key={d.stack.n}
                className="card card-pad grid grid-cols-1 gap-6 lg:grid-cols-[72px_240px_minmax(0,1fr)] max-md:p-5"
              >
                <span className="font-serif text-[40px] font-light leading-none text-clearance">
                  {d.stack.n}
                </span>
                <div>
                  <div className="label-jn">{plainLabel(d.stack.label)}</div>
                  <div className="mt-2 font-serif text-[32px] font-light leading-none tracking-tight text-bone">
                    {d.stack.val}
                  </div>
                  <div className="mt-2 text-[14px] text-steel">On the {PRICE_STACK_TOTAL} example</div>
                </div>
                <div>
                  <h2 className="title-card text-bone">{d.h}</h2>
                  <p className="mt-3 max-w-[64ch] text-[17px] leading-[1.6] text-bone-2">{d.p}</p>
                  <p className="mt-4 text-[15px] leading-[1.6] text-bone">
                    <span className="font-semibold text-steel">Lever: </span>
                    {d.lever}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            The full worked example lives in{" "}
            <Link href="/guides/private-jet-charter-cost" className="text-link-strong">
              what charter costs
            </Link>{" "}
            and on{" "}
            <Link href="/how-it-works" className="text-link-strong">
              how it works
            </Link>
            . To see the six numbers on your own route,{" "}
            <Link href="/cost-calculator" className="text-link-strong">
              the calculator
            </Link>{" "}
            takes about ninety seconds.
          </p>
        </div>
      </section>
    </GuideShell>
  );
}
