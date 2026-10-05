import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { RateTable } from "@/components/rate-table";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { WindowButton } from "@/components/light/window";
import { Estimator, type CalcCategory } from "@/components/cost-calculator/estimator";
import { FaqColumns, type CalcFaq } from "@/components/cost-calculator/faq-columns";
import { SampleQuoteButton } from "@/components/cost-calculator/sample-quote-button";
import { Icon, type IconName } from "@/components/cost-calculator/icons";
import { FaaWindow, NbaaWindow, TaxesWindow } from "@/components/cost-calculator/windows";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatHours } from "@/lib/quote-pricing";
import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import { SITE } from "@/lib/constants";

// Competitor context, from the four-broker audit: the "cost estimator"
// query cluster is real ("private jet charter cost estimator" 1,900/mo)
// and the incumbent #1 serves crawlers a client-side "Loading..." shell.
// This page is the opposite: the estimator shell, the rate table, and
// worked example trips are server-rendered, computed by the same engine
// the wizard uses, so no number here can disagree with a quote.
// Layout: Light - Cost calculator (claude design handoff).
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

// The site's cost FAQ (kept from the previous page) plus the three
// handoff questions that don't overlap it. All of them are visible on the
// page and all of them go into the FAQPage JSON-LD.
const COST_FAQ: CalcFaq[] = [
  {
    q: "Is this a quote or an estimate?",
    a: "An estimate is for planning. A written quote identifies the aircraft, total price, exclusions and booking terms.",
  },
  {
    q: "How accurate is the estimate?",
    a: "The calculator quotes an indicative range from live category rates and great-circle flight time. The exact number comes back from a senior dispatcher within 30 minutes during operating hours, priced against real aircraft — and once you accept it, it's locked. The price you accept is the price you pay.",
  },
  {
    q: "What's included in the price?",
    a: "Every JetNine quote is the all-in number: flight time, fuel, crew, landing fees, repositioning, and the 7.5% Federal Excise Tax. Standard catering and sedan ground transfer are included; premium catering, de-icing, and international handling are itemized separately before you accept.",
  },
  {
    q: "Why is the total more than an hourly rate?",
    a: "Positioning, crew, airport charges and taxes are added to occupied flight time. Compare the whole trip price, not the hourly figure.",
  },
  {
    q: "Why do hourly rates differ by aircraft category?",
    a: "Bigger aircraft burn more fuel, carry larger crews, and cost more to own and maintain. Light jets on our board run $3,200–3,600/hr at market rates; ultra-long-range aircraft run $10,400–11,200/hr. Card members lock rates from $2,950/hr (light) to $9,850/hr (ultra) for 24 months.",
  },
  {
    q: "Is a one-way flight cheaper than a round trip?",
    a: "Often, but not half the price — the aircraft usually has to fly home either way. If your dates are flexible, an empty leg on the same lane can cut 30–60% off; set a watchlist on our live board and we'll text when one matches.",
  },
  {
    q: "Can nearby airports or flexible dates change the price?",
    a: "Yes. Airport choice, time of day and date flexibility often change aircraft availability and positioning cost.",
  },
];

const TABS = [
  ["Estimate", "#estimate"],
  ["Cost factors", "#factors"],
  ["Inclusions", "#inclusions"],
  ["Aircraft", "#aircraft"],
  ["Rates", "#rates"],
  ["FAQs", "#faqs"],
  ["Sources", "#sources"],
] as const;

const FACTORS: [string, string, IconName][] = [
  ["Aircraft & cabin", "Match the aircraft to your group.", "plane"],
  ["Route & flight time", "Each leg affects the total.", "route"],
  ["Positioning", "Where the aircraft starts matters.", "pin"],
  ["Dates & demand", "Availability changes by trip date.", "calendar"],
  ["Crew & overnight stays", "Schedule and waiting time matter.", "people"],
  ["Airports & services", "Handling and requested extras vary.", "gear"],
];

const COVERS = [
  ["Aircraft, crew & positioning", "Included in the quoted total?"],
  ["Applicable taxes & airport fees", "Itemized for your itinerary?"],
  ["De-icing, upgrades & ground transport", "Included, excluded or charged if used?"],
];

const STAGES = [
  ["1", "Estimate:", "a planning range."],
  ["2", "Quote:", "specific aircraft, total and terms."],
  ["3", "Confirmation:", "accepted agreement and payment requirements."],
];

const RELATED = [
  ["Charter pricing guide", "/guides/private-jet-charter-cost"],
  ["How booking works", "/how-it-works"],
  ["Compare aircraft", "/aircraft"],
  ["Memberships & locked rates", "/memberships"],
  ["All FAQs", "/faq"],
] as const;

const SOURCE_BTN = "text-link cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold";

export default function CostCalculatorPage() {
  const trips = sampleTrips();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const categories: CalcCategory[] = FLEET.map((f) => ({
    slug: f.slug,
    name: f.name,
    pax: f.pax,
    rangeNm: f.rangeNm,
    href: f.href,
    imageUrl: f.imageUrl,
  }));

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* ─── Hero: paper scrim over the photo ─── */}
      <section className="relative overflow-hidden border-b border-line">
        <Image
          src="/images/light/page-19-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "62% 55%" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(247,245,240,.98) 0%, rgba(247,245,240,.94) 40%, rgba(247,245,240,.35) 64%, rgba(247,245,240,.1) 100%)",
          }}
        />
        <div className="container-jn relative pb-[26px] pt-[14px] max-md:bg-[rgba(247,245,240,.7)]">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cost calculator" }]} />
          <h1 className="mt-4 max-w-[11ch] font-serif text-[clamp(34px,9vw,50px)] font-normal leading-[1.02] tracking-[-.01em]">
            Private Jet Charter Cost Calculator
          </h1>
          <p className="mt-[10px] font-serif text-[24px] leading-[1.2]">Plan the trip. Understand the price.</p>
          <p className="mt-[10px] max-w-[44ch] text-[14px] leading-[1.55]">
            Explore a planning estimate from published category rates, see what affects the total, then request an
            aircraft-specific quote — no callback required.
          </p>
          <p className="mt-3 text-right text-[12px] text-steel">Illustrative aircraft imagery</p>
        </div>
      </section>

      <Estimator categories={categories} />

      {/* ─── On this page ─── */}
      <nav aria-label="On this page" className="mt-[18px] border-y border-line bg-[#FBFAF7]">
        <div className="container-jn flex flex-wrap justify-center gap-x-7 text-[13px]">
          {TABS.map(([label, href], i) => (
            <a
              key={href}
              href={href}
              className={`border-b-2 py-3 ${i === 0 ? "border-gold font-bold" : "border-transparent hover:border-line"}`}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ─── Cost factors ─── */}
      <section id="factors" className="container-jn scroll-mt-[84px] pt-6">
        <h2 className="font-serif text-[30px] leading-[1.1]">What changes your trip price?</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {FACTORS.map(([title, body, icon]) => (
            <div key={title} className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 border border-line bg-[#FBFAF7] px-4 py-[14px]">
              <Icon name={icon} size={30} />
              <span>
                <b className="block text-[14px]">{title}</b>
                <span className="text-[13px] text-steel">{body}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right">
          <Link href="/guides/private-jet-charter-cost" className="text-link whitespace-nowrap text-[13px] font-bold">
            Read the complete charter pricing guide →
          </Link>
        </div>
      </section>

      {/* ─── Inclusions ─── */}
      <section
        id="inclusions"
        className="container-jn grid scroll-mt-[84px] items-start gap-6 pt-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]"
      >
        <div className="border border-line bg-[#FBFAF7] px-5 py-[18px]">
          <h2 className="font-serif text-[26px] leading-[1.1]">Know what the number covers.</h2>
          <div className="mt-3 border border-line bg-white text-[13px]">
            <div className="grid gap-x-3 gap-y-1 bg-surface-2 px-[14px] py-2 text-[12px] font-bold [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <span>Cost item</span>
              <span>What to confirm</span>
            </div>
            {COVERS.map(([item, confirm]) => (
              <div key={item} className="grid gap-x-3 gap-y-1 border-t border-line px-[14px] py-[9px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <span>{item}</span>
                <span className="text-steel">{confirm}</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <WindowButton label="Use the NBAA quote checklist ↗" className={SOURCE_BTN} title="Compare the whole proposal" sub="Use this checklist to review a charter proposal. It covers key items to confirm before you book.">
              <NbaaWindow />
            </WindowButton>
          </div>
        </div>
        <div className="border border-line bg-[#FBFAF7] px-5 py-[18px]">
          <h2 className="font-serif text-[22px] leading-[1.1]">Estimate → Quote → Confirmation</h2>
          <ol className="mt-[10px] flex flex-col gap-[10px]">
            {STAGES.map(([n, t, b]) => (
              <li key={n} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-[13px]">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">{n}</span>
                <span>
                  <b>{t}</b> {b}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Aircraft ─── */}
      <section
        id="aircraft"
        className="container-jn grid scroll-mt-[84px] items-center gap-7 pt-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]"
      >
        <div>
          <div className="relative aspect-[16/8] overflow-hidden bg-surface-2">
            <Image src="/images/light/cabin-golden-hour.webp" alt="" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
          </div>
          <p className="mt-1 text-[12px] text-steel">Illustrative cabin imagery</p>
        </div>
        <div>
          <h2 className="font-serif text-[28px] leading-[1.1]">Choose the cabin your trip needs.</h2>
          <div className="mt-3 grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            {FLEET.map((f) => (
              <Link
                key={f.slug}
                href={f.href}
                className="flex h-10 items-center justify-center gap-[6px] rounded-[2px] border border-bone bg-white text-[13px] font-bold hover:border-gold"
              >
                {f.name} →
              </Link>
            ))}
          </div>
          <div className="mt-3 text-center">
            <Link href="/aircraft" className="text-link whitespace-nowrap text-[13px] font-bold">
              Compare all aircraft →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Rate card + worked examples (kept from the previous page) ─── */}
      <section id="rates" className="container-jn scroll-mt-[84px] pt-8">
        <h2 className="font-serif text-[28px] leading-[1.1]">The rate card, published.</h2>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-[1.55] text-steel">
          Market rates are what on-demand missions run on our board today. Locked rates are what JetNine Card members
          pay, fixed for 24 months. Either way, the quote you accept is all-in — fuel, FET, repositioning, crew,
          standard catering, ground.
        </p>
        <div className="mt-4">
          <RateTable />
        </div>

        <h3 className="mt-8 font-serif text-[24px] leading-[1.1]">Four real lanes, priced by the engine.</h3>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-[1.55] text-steel">
          Indicative ranges for the whole aircraft — not per seat — computed from the same category rates and
          flight-time model the quote wizard uses. Tap through and the wizard opens with the route already loaded.
        </p>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {trips.map((t) => (
            <div key={t.route} className="flex flex-col border border-line bg-white px-4 py-[14px]">
              <p className="eyebrow !mb-0">{t.category}</p>
              <h4 className="mt-1 font-serif text-[20px] leading-[1.15]">{t.note}</h4>
              <p className="mt-1 text-[13px] text-steel">{t.lane}</p>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px]">
                <dt className="text-steel">Flight time</dt>
                <dd>{t.hours}</dd>
                <dt className="text-steel">Passengers</dt>
                <dd>{t.pax}</dd>
              </dl>
              <div className="mt-3 text-[12px] text-steel">Indicative, whole aircraft</div>
              <div className="font-serif text-[24px] leading-tight">{t.range}</div>
              <div className="mt-auto pt-3">
                <SampleQuoteButton from={t.from} to={t.to} pax={t.pax} category={t.categorySlug}>
                  Get exact quote →
                </SampleQuoteButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Sources ─── */}
      <section id="sources" className="container-jn scroll-mt-[84px] pt-6">
        <h2 className="font-serif text-[28px] leading-[1.1]">Helpful guidance, beside the decision.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          <SourceCard icon="book" title="NBAA · Compare proposals" body="Check total price, extra charges and cancellation terms.">
            <WindowButton label="Charter checklist ↗" className={SOURCE_BTN} title="Compare the whole proposal" sub="Use this checklist to review a charter proposal. It covers key items to confirm before you book.">
              <NbaaWindow />
            </WindowButton>
          </SourceCard>
          <SourceCard icon="doc" title="IRS · Understand air travel taxes" body="Tax treatment depends on the itinerary and applicable rules.">
            <WindowButton
              label="Publication 510 ↗"
              className={SOURCE_BTN}
              variant="drawer"
              title="Taxes and airport charges"
              sub="These fees vary by route, airport and country. Confirm which items apply to your trip and how they appear in your written quote."
            >
              <TaxesWindow />
            </WindowButton>
          </SourceCard>
          <SourceCard icon="shield" title="FAA · Verify the operator" body="Ask for the carrier certificate and aircraft charter authorization.">
            <WindowButton
              label="Charter guidance ↗"
              className={SOURCE_BTN}
              title="Know who operates your flight"
              sub="Confirm that your flight will be operated by a properly authorized carrier. Use this independent guidance when reviewing a proposal."
            >
              <FaaWindow />
            </WindowButton>
          </SourceCard>
        </div>
        <p className="mt-[6px] text-right text-[12px] text-steel">Independent resources. No endorsement implied.</p>
      </section>

      {/* ─── FAQs ─── */}
      <section id="faqs" className="container-jn scroll-mt-[84px] pt-[22px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">Before you calculate.</h2>
        <FaqColumns items={COST_FAQ} />
        <div className="mt-[14px] flex flex-wrap items-center gap-x-4 gap-y-[10px]">
          <h3 className="font-serif text-[22px]">Related guides.</h3>
          {RELATED.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-[38px] items-center gap-2 whitespace-nowrap border border-line bg-[#FBFAF7] px-[14px] text-[13px] font-bold hover:border-gold"
            >
              {label} →
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-steel">{SITE.legal.part295}</p>
      </section>

      <CtaBand
        title="Turn a planning range into a clear proposal."
        body={`Run the estimate, or skip straight to a human on the dispatch line: ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a written quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
        imageSrc="/images/light/mountain-landscape.webp"
        imagePosition="center 60%"
        className="!mt-[26px]"
      />
    </>
  );
}

function SourceCard({ icon, title, body, children }: { icon: IconName; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-[#FBFAF7] px-4 py-[14px]">
      <Icon name={icon} size={28} />
      <div>
        <b className="block text-[14px]">{title}</b>
        <span className="mb-2 mt-[2px] block text-[12px] text-steel">{body}</span>
        {children}
      </div>
    </div>
  );
}
