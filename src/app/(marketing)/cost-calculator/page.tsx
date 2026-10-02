import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { RateTable } from "@/components/rate-table";
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
  { from: "VNY", to: "TEB", pax: 6, category: "supermid", note: "LA to New York · coast-to-coast nonstop" },
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
    lane: string;
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
      lane: `${from.name} (${from.iata}) → ${to.name} (${to.iata})`,
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
    a: "Bigger aircraft burn more fuel, carry larger crews, and cost more to own and maintain. Light jets on our board run $3,200–3,600/hr at market rates; ultra-long-range aircraft run $10,400–11,200/hr. Card members lock rates from $2,950/hr (light) to $9,850/hr (ultra) for 24 months.",
  },
  {
    q: "Is a one-way flight cheaper than a round trip?",
    a: "Often, but not half the price — the aircraft usually has to fly home either way. If your dates are flexible, an empty leg on the same lane can cut 30–60% off; set a watchlist on our live board and we'll text when one matches.",
  },
];

export default function CostCalculatorPage() {
  const trips = sampleTrips();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <PageHero
        eyebrow="Cost calculator · live rates"
        title="What a private jet actually costs."
        lead="Most charter sites make you request a quote to see any number. Ours are published: hourly rates by category below, worked example trips priced by the same engine that powers our quote wizard, and an estimate for your route in about ninety seconds — no callback required."
      />

      <ProofStrip />

      {/* ─── Estimator entry ─── */}
      <QuoteLauncher
        context="cost-calculator"
        heading="Estimate your route."
        body="Origin, destination, date, and passenger count. The wizard prices as you type and a senior dispatcher confirms exact aircraft within 30 minutes during operating hours."
      />

      {/* ─── Rate table ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Hourly rates</p>
          <h2 className="title-section max-w-[24ch]">The rate card, published.</h2>
          <p className="mt-5 max-w-[64ch] text-[17px] leading-[1.55] text-bone-2">
            Market rates are what on-demand missions run on our board today. Locked rates are
            what JetNine Card members pay, fixed for 24 months. Either way, the quote you accept
            is all-in — fuel, FET, repositioning, crew, standard catering, ground.
          </p>
          <div className="mt-8">
            <RateTable />
          </div>
        </div>
      </section>

      {/* ─── Worked examples ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Worked examples</p>
          <h2 className="title-section max-w-[24ch]">Four real lanes, priced by the engine.</h2>
          <p className="mt-5 max-w-[64ch] text-[17px] leading-[1.55] text-bone-2">
            Indicative ranges for the whole aircraft — not per seat — computed from the same
            category rates and flight-time model the quote wizard uses. Tap through and the
            wizard opens with the route already loaded.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {trips.map((t) => (
              <div key={t.route} className="card card-pad flex flex-col gap-5 max-md:p-5">
                <div>
                  <div className="title-card-sm text-bone">{t.note}</div>
                  <div className="mt-1.5 text-[14px] text-steel">{t.lane}</div>
                </div>
                <dl className="dl-jn border-y border-line py-4">
                  <dt>Category</dt>
                  <dd>{t.category}</dd>
                  <dt>Flight time</dt>
                  <dd>{t.hours}</dd>
                  <dt>Passengers</dt>
                  <dd>{t.pax}</dd>
                </dl>
                <div className="flex flex-1 flex-col justify-end gap-4">
                  <div>
                    <div className="text-[14px] text-steel">Indicative, all-in</div>
                    <div className="mt-1 font-serif text-[26px] font-light leading-tight tracking-tight text-bone">
                      {t.range}
                    </div>
                  </div>
                  <RouteQuoteLink from={t.from} to={t.to} category={t.categorySlug} pax={t.pax} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Estimate vs exact ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Estimate vs. exact quote</p>
          <h2 className="title-section max-w-[26ch]">
            The calculator gets you close. Dispatch gets you exact.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                k: "This page · instant",
                h: "The indicative range.",
                p: "Category hourly rate × great-circle flight time, padded for taxi and climb-out. Good to roughly ±15% — enough to know whether the trip is a light-jet or a heavy-jet budget before you talk to anyone.",
              },
              {
                k: "Dispatch · under 30 min",
                h: "The number that's locked.",
                p: "A senior dispatcher prices three to five vetted aircraft against your actual date, airports, and load — then the figure you accept is the figure on the invoice. If fuel spikes or a fee changes between acceptance and wheels-up, that's our problem, not yours.",
              },
            ].map((c) => (
              <div key={c.k} className="card card-pad max-md:p-5">
                <span className="label-jn">{c.k}</span>
                <h3 className="title-card mt-3 text-bone">{c.h}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-bone-2">{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Cost questions</p>
          <h2 className="title-section max-w-[24ch]">Asked before every first booking.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {COST_FAQ.map((f) => (
              <div key={f.q} className="card card-pad max-md:p-5">
                <h3 className="title-card-sm text-bone">{f.q}</h3>
                <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.6] text-bone-2">{f.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            The full story behind these numbers is in{" "}
            <Link href="/guides" className="text-link-strong">
              the charter pricing guide
            </Link>{" "}
            — more detail on programs and locked rates on{" "}
            <Link href="/memberships" className="text-link-strong">
              memberships
            </Link>
            , or the full list on the{" "}
            <Link href="/faq" className="text-link-strong">
              FAQ
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand
        title="Ninety seconds to a number."
        body={`Run the estimate, or skip straight to a human — the dispatch line picks up in under twenty seconds, every hour of every day. ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
