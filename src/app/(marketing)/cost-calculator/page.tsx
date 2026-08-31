import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { RATES } from "@/lib/rates";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatHours } from "@/lib/quote-pricing";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { SITE } from "@/lib/constants";

// Competitor context, from the four-broker audit: the "cost estimator"
// query cluster is real ("private jet charter cost estimator" 1,900/mo)
// and the incumbent #1 serves crawlers a client-side "Loading..." shell.
// This page is the opposite: everything below is server-rendered — the
// launcher form shell, the rate table, and worked example trips computed
// by the same engine the wizard uses, so no number here can disagree
// with a quote.
export const metadata: Metadata = pageMetadata({
  title: "Private Jet Cost Calculator — Instant Estimate",
  description:
    "Estimate your charter in seconds: live hourly rates by category ($2,950–$9,850/hr locked, market rates published too) and worked example trips. No callback required.",
  path: "/cost-calculator",
});

// Worked examples priced by the wizard's own indicative engine at build/
// request time. Routes reuse the mission step's preset lanes.
const SAMPLE_ROUTES: {
  from: string;
  to: string;
  pax: number;
  category: AircraftCategorySlug;
  note: string;
}[] = [
  { from: "VNY", to: "ASE", pax: 4, category: "light", note: "LA to Aspen · mountain slot" },
  { from: "LAX", to: "LAS", pax: 4, category: "light", note: "LA to Vegas · the quick hop" },
  { from: "JFK", to: "PBI", pax: 5, category: "midsize", note: "New York to Palm Beach" },
  { from: "VNY", to: "TEB", pax: 6, category: "supermid", note: "LA to New York · transcon nonstop" },
];

function sampleTrips() {
  const out: {
    route: string;
    note: string;
    category: string;
    categorySlug: AircraftCategorySlug;
    from: string;
    to: string;
    pax: number;
    hours: string;
    range: string;
  }[] = [];
  for (const r of SAMPLE_ROUTES) {
    const from = findAirport(r.from);
    const to = findAirport(r.to);
    if (!from || !to) continue;
    const ind = computeIndicative({
      category: r.category,
      legs: [{ id: "sample", fromIata: r.from, toIata: r.to, distanceNm: distanceNm(from, to) }],
    });
    if (!ind) continue;
    out.push({
      route: `${r.from} → ${r.to}`,
      note: r.note,
      category: r.category === "supermid" ? "Super-mid" : r.category[0].toUpperCase() + r.category.slice(1),
      categorySlug: r.category,
      from: r.from,
      to: r.to,
      pax: r.pax,
      hours: formatHours(ind.hours),
      range: ind.formatted,
    });
  }
  return out;
}

const COST_FAQ: { q: string; a: string }[] = [
  {
    q: "How accurate is the estimate?",
    a: "The calculator quotes an indicative range from live category rates and great-circle flight time. The exact number comes back from a senior dispatcher within 30 minutes during operating hours, priced against real airframes — and once you accept it, it's locked. The price you accept is the price you pay.",
  },
  {
    q: "What's included in the price?",
    a: "Every JetNine quote is the all-in number: flight time, fuel, crew, landing fees, repositioning, and the 7.5% Federal Excise Tax. Standard catering and sedan ground transfer are included; premium catering, de-icing, and international handling are itemized separately before you accept.",
  },
  {
    q: "Why do hourly rates differ by aircraft category?",
    a: "Bigger airframes burn more fuel, carry larger crews, and cost more to own and maintain. Light jets on our board run $3,200–3,600/hr at market rates; ultra-long-range aircraft run $10,400–11,200/hr. Card members lock rates from $2,950/hr (light) to $9,850/hr (ultra) for 24 months.",
  },
  {
    q: "Is a one-way flight cheaper than a round trip?",
    a: "Often, but not half the price — the aircraft usually has to fly home either way. If your dates are flexible, an empty leg on the same lane can cut 30–60% off; set a watchlist on our live board and we'll text when one matches.",
  },
];

export default function CostCalculatorPage() {
  const trips = sampleTrips();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // WebApplication: this page is a working estimator, not an article.
  // AggregateOffer carries the numeric rate card (audit: three of four
  // competitors ship malformed or missing Offer schema; valid numeric
  // values are an easy structured-data edge).
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "JetNine Private Jet Cost Calculator",
    url: `${siteUrl}/cost-calculator`,
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: RATES[0].lockedUsd,
      highPrice: RATES[RATES.length - 1].marketHighUsd,
      offerCount: RATES.length,
      offers: RATES.map((r) => ({
        "@type": "Offer",
        name: `${r.category} jet charter`,
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: r.marketLowUsd,
          priceCurrency: "USD",
          unitText: "hour",
        },
      })),
    },
    provider: { "@id": `${siteUrl}/#organization` },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: COST_FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Cost calculator", item: `${siteUrl}/cost-calculator` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site data — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ─── Header ─── */}
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-20 max-md:pt-[140px] max-md:pb-14">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Cost calculator · live rates
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[16ch]">
            What a private jet actually costs.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            Most charter sites make you request a quote to see any number. Ours are published:
            hourly rates by category below, worked example trips priced by the same engine that
            powers our quote wizard, and an estimate for your route in about ninety seconds — no
            callback required.
          </Reveal>
        </div>
      </header>

      {/* ─── Estimator entry ─── */}
      <QuoteLauncher
        context="cost-calculator"
        heading="Estimate your route."
        body="Origin, destination, date, and passenger count. The wizard prices as you type and a senior dispatcher confirms exact airframes within 30 minutes during operating hours."
      />

      {/* ─── Rate table ─── */}
      <section className="border-t border-ink-3 bg-ink py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Hourly rates</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              The rate card, published.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
              Market rates are what on-demand missions run on our board today. Locked rates are
              what JetNine Card members pay, fixed for 24 months. Either way, the quote you accept
              is all-in — fuel, FET, repositioning, crew, standard catering, ground.
            </Reveal>
          </div>
          <Reveal className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-3">
                  {["Category", "Typical mission", "Sample lane", "Market hourly", "Card locked"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-bone-2"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATES.map((r) => (
                  <tr key={r.category} className="border-b border-ink-3 last:border-b-0">
                    <td className="px-6 py-5 font-serif text-[18px] font-normal tracking-tight text-bone">
                      {r.category}
                    </td>
                    <td className="px-6 py-5 text-[13px] text-bone-2">{r.mission}</td>
                    <td className="px-6 py-5 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                      {r.sample}
                    </td>
                    <td className="px-6 py-5 font-mono text-[13px] tracking-[0.02em] text-bone">
                      {r.market}
                    </td>
                    <td className="px-6 py-5 font-mono text-[13px] tracking-[0.02em] text-clearance">
                      {r.locked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-5 max-w-[70ch] font-mono text-[11px] uppercase tracking-[0.1em] leading-[1.8] text-steel">
            — Included: flight time, fuel, crew, landing, repositioning, 7.5% FET, standard
            catering, sedan transfer · Itemized separately: premium catering, de-icing,
            international handling · Rates reviewed quarterly
          </p>
        </div>
      </section>

      {/* ─── Worked examples ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Worked examples</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Four real lanes, priced by the engine.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
              Indicative ranges for the whole aircraft — not per seat — computed from the same
              category rates and flight-time model the quote wizard uses. Tap through and the
              wizard opens with the route already loaded.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {trips.map((t, i) => (
              <Reveal
                key={t.route}
                stagger={(i % 3) as 0 | 1 | 2}
                className="flex flex-col gap-5 rounded-[4px] border border-ink-3 bg-ink p-7"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                    {t.note}
                  </div>
                  <div className="mt-2 font-serif text-[26px] font-light leading-none tracking-tight text-bone">
                    {t.route}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-y border-ink-3 py-5 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Category</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{t.category}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Est. time</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{t.hours}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                      — Indicative, all-in
                    </div>
                    <div className="mt-1 font-serif text-[24px] font-light leading-tight tracking-tight text-bone">
                      {t.range}
                    </div>
                  </div>
                  <RouteQuoteLink from={t.from} to={t.to} category={t.categorySlug} pax={t.pax} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Estimate vs exact ─── */}
      <section className="border-t border-ink-3 bg-ink py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Estimate vs. exact quote</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
              The calculator gets you close. Dispatch gets you exact.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                k: "THIS PAGE · INSTANT",
                h: "The indicative range.",
                p: "Category hourly rate × great-circle flight time, padded for taxi and climb-out. Good to roughly ±15% — enough to know whether the trip is a light-jet or a heavy-jet budget before you talk to anyone.",
              },
              {
                k: "DISPATCH · UNDER 30 MIN",
                h: "The number that's locked.",
                p: "A senior dispatcher prices three to five vetted airframes against your actual date, airports, and load — then the figure you accept is the figure on the invoice. If fuel spikes or a fee changes between acceptance and wheels-up, that's our problem, not yours.",
              },
            ].map((c) => (
              <Reveal key={c.k} className="rounded-[4px] border border-ink-3 bg-ink-2 p-10">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                  — {c.k}
                </span>
                <h3 className="mt-5 font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {c.h}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Cost questions</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Asked before every first booking.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {COST_FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-12 text-[15px] leading-[1.6] text-bone-2">
            More detail on programs and locked rates on{" "}
            <Link href="/memberships" className="text-clearance">
              memberships
            </Link>
            , or the full list on the{" "}
            <Link href="/faq" className="text-clearance">
              FAQ
            </Link>
            .
          </p>
        </div>
      </section>

      <ClosingCTA
        heading="Ninety seconds to a number."
        body={`Run the estimate, or skip straight to a human — the dispatch line picks up in under twenty seconds, every hour of every day. ${SITE.dispatchPhone}.`}
      />
    </>
  );
}
