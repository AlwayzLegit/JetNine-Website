import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { ClosingCTA } from "@/components/closing-cta";
import { ProofStrip } from "@/components/proof-strip";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { pageMetadata } from "@/lib/page-meta";
import { MODELS, getModel, siblingModels } from "@/lib/models";
import { getFleetEntry, formatNm } from "@/lib/fleet";
import { RATES } from "@/lib/rates";
import { findAirport, distanceNm } from "@/lib/airports";
import { computeIndicative, formatHours } from "@/lib/quote-pricing";
import { SITE } from "@/lib/constants";

// Model pages — audit item 6. Tail-and-model queries are KD 3–15 and
// winnable at this domain's authority; the template ships what every
// audited competitor forgot at least one of: the hourly rate up front,
// valid numeric Product+Offer schema, and FAQPage markup.
type RouteParams = { params: Promise<{ category: string; model: string }> };

export function generateStaticParams() {
  return MODELS.map((m) => ({ category: m.category, model: m.slug }));
}

// Rate-card row for a model's category — exact name match against the
// published card. Turboprop has no card row (the card starts at Light),
// so turboprop model pages simply omit the rate box and Offer schema.
function rateRowFor(category: string) {
  const entry = getFleetEntry(category);
  if (!entry) return undefined;
  return RATES.find((r) => r.category === entry.name);
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { category, model } = await params;
  const m = getModel(category, model);
  if (!m) return {};
  const rate = rateRowFor(m.category);
  return pageMetadata({
    title: `${m.shortName} Charter — Rates, Range & Specs`,
    description: `Charter the ${m.name}: ${m.sample.pax} passengers, ${formatNm(m.sample.rangeNm)} range, ${m.sample.speedKt} kt cruise${rate ? `, from ${rate.market} at market rates` : ""}. Vetted operators, all-in quotes in 30 minutes.`,
    path: `/aircraft/${m.category}/${m.slug}`,
    image: m.sample.imageUrl,
    imageAlt: `${m.name} exterior`,
  });
}

export default async function ModelPage({ params }: RouteParams) {
  const { category, model } = await params;
  const m = getModel(category, model);
  const entry = getFleetEntry(category);
  if (!m || !entry) notFound();

  const rate = rateRowFor(m.category);
  const siblings = siblingModels(m);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // Popular routes priced by the live engine with this model's category —
  // the same figures a wizard run would show, never hand-typed.
  const routes = m.routes
    .map((r) => {
      const from = findAirport(r.from);
      const to = findAirport(r.to);
      if (!from || !to) return null;
      const nm = distanceNm(from, to);
      if (nm > m.sample.rangeNm) return null;
      const ind = computeIndicative({
        category: m.category,
        legs: [{ id: "s", fromIata: r.from, toIata: r.to, distanceNm: nm }],
      });
      if (!ind) return null;
      return { ...r, nm, hours: formatHours(ind.hours), range: ind.formatted };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const FAQ = [
    {
      q: `How much does it cost to charter a ${m.shortName}?`,
      a: `${m.shortName} missions price in the ${entry.name.toLowerCase()} category: ${rate ? `${rate.market} at market rates, or ${rate.locked.toLowerCase()} locked for JetNine Card holders` : "see the published rate card"} — times the block hours your route takes, all-in. ${routes[0] ? `${routes[0].label} runs about ${routes[0].range} for the whole aircraft.` : ""} The exact number comes back from dispatch within 30 minutes.`,
    },
    {
      q: `How many passengers does a ${m.shortName} seat?`,
      a: `Typical charter configuration seats ${m.sample.pax}. Cabin runs ${m.cabin.lengthFt} long, ${m.cabin.widthFt} wide, and ${m.cabin.heightFt} of height, with roughly ${m.baggageCuFt} cu ft of baggage. Configurations vary by tail — dispatch confirms the exact layout with your quote.`,
    },
    {
      q: `How far can a ${m.shortName} fly?`,
      a: `About ${formatNm(m.sample.rangeNm)} with reserves at ${m.sample.speedKt} kt cruise — real-world range depends on load, winds, and routing. ${m.knownFor}`,
    },
    {
      q: `Is the ${m.shortName} the right choice for my trip?`,
      a: `${m.lead} If your mission runs past its range or seats, the ${entry.teaser.right.title.toLowerCase()} step-up usually answers; the quote wizard recommends a category per route automatically, and a dispatcher will tell you straight if a cheaper airframe does your trip just as well.`,
    },
  ];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${m.name} charter`,
    description: m.lead,
    brand: { "@type": "Brand", name: m.manufacturer },
    category: `${entry.name} private jet charter`,
    ...(m.sample.imageUrl ? { image: `${siteUrl}${m.sample.imageUrl}` } : {}),
    offers: rate
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: rate.lockedUsd,
          highPrice: rate.marketHighUsd,
          offerCount: 2,
          offers: [
            {
              "@type": "Offer",
              name: `${m.shortName} charter — market rate`,
              priceCurrency: "USD",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: rate.marketLowUsd,
                priceCurrency: "USD",
                unitText: "hour",
              },
            },
            {
              "@type": "Offer",
              name: `${m.shortName} charter — JetNine Card locked rate`,
              priceCurrency: "USD",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: rate.lockedUsd,
                priceCurrency: "USD",
                unitText: "hour",
              },
            },
          ],
        }
      : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Aircraft", item: `${siteUrl}/aircraft` },
      { "@type": "ListItem", position: 3, name: entry.name, item: `${siteUrl}${entry.href}` },
      { "@type": "ListItem", position: 4, name: m.shortName, item: `${siteUrl}/aircraft/${m.category}/${m.slug}` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const specs: [string, string][] = [
    ["Passengers", `${m.sample.pax} typical`],
    ["Range", `${formatNm(m.sample.rangeNm)} · with reserves`],
    ["Cruise", `${m.sample.speedKt} kt`],
    ["Ceiling", `${m.ceilingFt.toLocaleString()} ft`],
    ["Cabin height", m.cabin.heightFt],
    ["Cabin width", m.cabin.widthFt],
    ["Cabin length", m.cabin.lengthFt],
    ["Baggage", `~${m.baggageCuFt} cu ft`],
    ["Wi-Fi", m.sample.wifi === "KA" ? "Ka-band" : m.sample.wifi === "YES" ? "Yes" : "No"],
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site data — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ─── Header: name + the rate, front and center ─── */}
      <header className="border-b border-ink-3 bg-ink pt-[180px] pb-16 max-md:pt-[130px] max-md:pb-12">
        <div className="container-jn grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              <Link href="/aircraft" className="transition-colors hover:text-bone">Aircraft</Link>
              <span aria-hidden>·</span>
              <Link href={entry.href} className="transition-colors hover:text-bone">{entry.name}</Link>
            </Reveal>
            <Reveal as="h1" stagger={1} className="display-xl max-w-[16ch]">
              {m.shortName} charter.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
              {m.lead}
            </Reveal>
          </div>
          {rate ? (
            <Reveal stagger={2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — {entry.name} category · hourly
              </p>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <span className="font-serif text-[40px] font-light leading-none tracking-tight text-bone">
                  {rate.market}
                </span>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                Market · all-in, locked at acceptance
              </p>
              <div className="mt-5 border-t border-ink-3 pt-5">
                <span className="font-serif text-[24px] font-light leading-none tracking-tight text-clearance">
                  {rate.locked}
                </span>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                  JetNine Card · locked 24 months
                </p>
              </div>
            </Reveal>
          ) : null}
        </div>
      </header>

      <ProofStrip />

      {/* ─── Photo + spec table ─── */}
      <section className="py-24 max-md:py-16">
        <div className="container-jn grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          <Reveal className="overflow-hidden rounded-[4px] border border-ink-3">
            <Placeholder
              caption={m.sample.phCap}
              aspect="16/10"
              imageUrl={m.sample.imageUrl}
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </Reveal>
          <Reveal stagger={1} className="rounded-[4px] border border-ink-3 bg-ink-2">
            <div className="border-b border-ink-3 px-7 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                — Specifications · typical config
              </p>
            </div>
            <dl>
              {specs.map(([label, val]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-6 border-b border-ink-3 px-7 py-3.5 last:border-b-0"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">{label}</dt>
                  <dd className="m-0 font-mono text-[13px] tracking-[0.02em] text-bone">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="px-7 py-4 text-[12px] leading-[1.6] text-steel">
              Figures are typical published configuration; exact layout and performance vary by
              tail and are confirmed with your quote.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── Popular routes, engine-priced ─── */}
      {routes.length > 0 ? (
        <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
          <div className="container-jn">
            <Reveal>
              <p className="caption mb-6">— Popular {m.shortName} routes</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              What it flies, and for what.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[17px] leading-[1.55] text-bone-2">
              Indicative all-in ranges for the whole aircraft, computed by the same engine behind
              our quote wizard. Tap through and the wizard opens with the route and category loaded.
            </Reveal>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {routes.map((r, i) => (
                <Reveal key={`${r.from}-${r.to}`} stagger={(i % 3) as 0 | 1 | 2} className="flex flex-col gap-5 rounded-[4px] border border-ink-3 bg-ink p-7">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">{r.label}</div>
                    <div className="mt-2 font-serif text-[26px] font-light leading-none tracking-tight text-bone">
                      {r.from} → {r.to}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-y border-ink-3 py-5 text-[11px]">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono uppercase tracking-[0.12em] text-steel">— Distance</span>
                      <span className="font-mono tracking-[0.04em] text-bone">{formatNm(r.nm)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono uppercase tracking-[0.12em] text-steel">— Est. time</span>
                      <span className="font-mono tracking-[0.04em] text-bone">{r.hours}</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-end gap-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">— Indicative, all-in</div>
                      <div className="mt-1 font-serif text-[22px] font-light leading-tight tracking-tight text-bone">
                        {r.range}
                      </div>
                    </div>
                    <RouteQuoteLink from={r.from} to={r.to} category={m.category} pax={Math.min(m.sample.pax, 8)} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about the {m.shortName}</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">{f.q}</h3>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Alternatives ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— Compare</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
            The alternatives worth pricing.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {siblings.map((s, i) => (
              <Reveal key={s.slug} stagger={(i % 3) as 0 | 1 | 2}>
                <Link
                  href={`/aircraft/${s.category}/${s.slug}`}
                  className="group flex h-full flex-col rounded-[4px] border border-ink-3 bg-ink p-8 transition-colors hover:border-[rgba(232,226,210,0.3)]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    Same category · {entry.name}
                  </span>
                  <h3 className="mt-4 font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                    {s.shortName}
                  </h3>
                  <p className="mt-3 flex-1 text-[14px] leading-[1.6] text-bone-2">{s.knownFor}</p>
                  <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    Specs &amp; rates <span className="arrow">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
            <Reveal stagger={2}>
              <Link
                href={entry.teaser.right.href}
                className="group flex h-full flex-col rounded-[4px] border border-ink-3 bg-ink p-8 transition-colors hover:border-[rgba(232,226,210,0.3)]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  {entry.teaser.right.label}
                </span>
                <h3 className="mt-4 font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                  {entry.teaser.right.title}
                </h3>
                <p className="mt-3 flex-1 text-[14px] leading-[1.6] text-bone-2">{entry.teaser.right.body}</p>
                <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                  {entry.teaser.right.cta} <span className="arrow">→</span>
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <QuoteLauncher
        context={`model-${m.slug}`}
        category={m.category}
        heading={`Price a ${m.shortName} mission.`}
        body="Route, date, and passengers — the wizard opens with the category pre-selected and prices as you type. Dispatch confirms specific tails within 30 minutes."
      />

      <ClosingCTA
        heading={`${m.shortName}, sourced and vetted.`}
        body={`Every ${m.shortName} we quote flies for an ARG/US- or Wyvern-audited operator that passed our on-site vetting. Ask dispatch which tails are in position: ${SITE.dispatchPhone}.`}
      />
    </>
  );
}
