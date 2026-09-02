import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { ProofStrip } from "@/components/proof-strip";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { RateTable } from "@/components/rate-table";
import { pageMetadata } from "@/lib/page-meta";
import { CITIES, getCity, type CharterCity } from "@/lib/cities";
import { ROUTES } from "@/lib/routes";
import { FLEET, formatNm } from "@/lib/fleet";
import { distanceNm, type Airport } from "@/lib/airports";
import {
  computeIndicative,
  formatHours,
  formatUSD,
  recommendCategory,
} from "@/lib/quote-pricing";
import { SITE } from "@/lib/constants";

// City pages — audit item 7, the last content build. The template is
// the audited best-of-breed composite: airports table with ICAO codes
// and drive framing, origin-based from-price table fed by the live
// engine, the published rate card, operational FAQs, and the internal
// chain city → route pages → category/model pages. Scoped to the deep
// top markets; the registry grows only after these index.
type RouteParams = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

type Lane = {
  to: Airport;
  nm: number;
  category: string;
  categorySlug: ReturnType<typeof recommendCategory>;
  hours: string;
  low: number;
  range: string;
  routeHref?: string;
};

// Each curated lane priced by the engine from the city's primary field,
// with the wizard's own category recommendation and a link to the
// dedicated route page when one exists (either direction — same lane).
function cityLanes(city: CharterCity): Lane[] {
  return city.lanes
    .map((to) => {
      const nm = distanceNm(city.primary, to);
      const categorySlug = recommendCategory(4, nm);
      const entry = FLEET.find((f) => f.slug === categorySlug);
      const ind = computeIndicative({
        category: categorySlug,
        legs: [{ id: "l", fromIata: city.primary.iata, toIata: to.iata, distanceNm: nm }],
      });
      if (!entry || !ind) return null;
      const route = ROUTES.find(
        (r) =>
          (r.from.city === city.name && r.to.city === to.city) ||
          (r.to.city === city.name && r.from.city === to.city),
      );
      const lane: Lane = {
        to,
        nm,
        category: entry.name,
        categorySlug,
        hours: formatHours(ind.hours),
        low: ind.low,
        range: ind.formatted,
        ...(route ? { routeHref: `/routes/${route.slug}` } : {}),
      };
      return lane;
    })
    .filter((l): l is Lane => l !== null);
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const lanes = cityLanes(city);
  const cheapest = lanes.reduce((a, b) => (b.low < a.low ? b : a), lanes[0]);
  return pageMetadata({
    title: `Private Jet Charter ${city.name} — Cost, Jets & Airports`,
    description: `Charter from ${city.name}: ${city.primary.name} (${city.primary.icao}) and the fields that matter, live from-prices${cheapest ? ` (${city.name} to ${cheapest.to.city} from ${formatUSD(cheapest.low)})` : ""}, and quotes in 30 minutes from vetted operators.`,
    path: `/private-jet-charter/${city.slug}`,
  });
}

export default async function CityPage({ params }: RouteParams) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const lanes = cityLanes(city);
  const cheapest = lanes.reduce((a, b) => (b.low < a.low ? b : a), lanes[0]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const FAQ = [
    {
      q: `How much does a private jet cost from ${city.name}?`,
      a: `Live examples from ${city.primary.name}: ${lanes
        .slice(0, 3)
        .map((l) => `${city.name} to ${l.to.city} from ${formatUSD(l.low)} (${l.category.toLowerCase()})`)
        .join("; ")}. All figures are for the whole aircraft, all-in — fuel, crew, landing, 7.5% FET — and locked at acceptance. Hourly rates by category are published on the rate card below.`,
    },
    {
      q: `Which airport do ${city.name} charters use?`,
      a: `${city.airports
        .map((a) => `${a.airport.name} (${a.airport.icao}) — ${a.role.toLowerCase()}, ${a.drive}`)
        .join(". ")}. Tell dispatch the actual address on each end; the field picks itself.`,
    },
    ...city.opsFaq,
    {
      q: `How fast can a ${city.name} charter be arranged?`,
      a: `The quote comes back within 30 minutes during operating hours — three to five real airframes with all-in pricing. Same-day departures are routine when an airframe is in position; the dispatch line answers in under twenty seconds, around the clock, at ${SITE.dispatchPhone}.`,
    },
  ];

  const airportJsonLd = city.airports.map((a) => ({
    "@context": "https://schema.org",
    "@type": "Airport",
    name: a.airport.name,
    iataCode: a.airport.iata.length === 3 ? a.airport.iata : undefined,
    icaoCode: a.airport.icao,
    address: { "@type": "PostalAddress", addressLocality: a.airport.city },
    geo: { "@type": "GeoCoordinates", latitude: a.airport.lat, longitude: a.airport.lon },
  }));

  const serviceJsonLd =
    lanes.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Private jet charter",
          name: `Private jet charter, ${city.name}`,
          provider: { "@id": `${siteUrl}/#organization` },
          areaServed: {
            "@type": "City",
            name: city.name,
            address: { "@type": "PostalAddress", addressRegion: city.state },
          },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: cheapest.low,
            highPrice: Math.max(...lanes.map((l) => l.low)),
            offerCount: lanes.length,
            offers: lanes.map((l) => ({
              "@type": "Offer",
              name: `${city.name} to ${l.to.city}, ${l.category.toLowerCase()} category, one way`,
              priceCurrency: "USD",
              price: l.low,
            })),
          },
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Charter by city", item: `${siteUrl}/private-jet-charter` },
      { "@type": "ListItem", position: 3, name: city.name, item: `${siteUrl}/private-jet-charter/${city.slug}` },
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

  return (
    <>
      {[...airportJsonLd, serviceJsonLd, breadcrumbJsonLd, faqJsonLd].filter(Boolean).map((json, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Build-time stringified site data — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
        />
      ))}

      {/* ─── Header ─── */}
      <header className="border-b border-ink-3 bg-ink pt-[180px] pb-16 max-md:pt-[130px] max-md:pb-12">
        <div className="container-jn grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              <Link href="/private-jet-charter" className="transition-colors hover:text-bone">
                Charter by city
              </Link>
              <span aria-hidden>·</span>
              <span>{city.state}</span>
            </Reveal>
            <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
              Private jet charter, {city.name}.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
              {city.lead}
            </Reveal>
          </div>
          {cheapest ? (
            <Reveal stagger={2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — Departing {city.primary.icao} · whole aircraft · all-in
              </p>
              <div className="mt-5 font-serif text-[40px] font-light leading-none tracking-tight text-bone">
                From {formatUSD(cheapest.low)}
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                {city.name} to {cheapest.to.city} · {cheapest.category.toLowerCase()} · ~{cheapest.hours}
              </p>
              <div className="mt-6 border-t border-ink-3 pt-5">
                <RouteQuoteLink
                  from={city.primary.iata}
                  to={cheapest.to.iata}
                  category={cheapest.categorySlug}
                  pax={4}
                  label="Get the exact number"
                  className="btn btn-primary"
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </header>

      <ProofStrip />

      {/* ─── Airports ─── */}
      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— The fields that matter</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            {city.name}&rsquo;s charter airports, chosen for the drive.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {city.airports.map((a, i) => (
              <Reveal key={a.airport.icao} stagger={(i % 3) as 0 | 1 | 2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-[26px] font-light leading-none tracking-tight text-bone">
                    {a.airport.icao}
                  </span>
                  <span className="rounded-[2px] border border-ink-4 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-clearance">
                    {a.role}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                  {a.airport.name}
                </div>
                <p className="mt-4 border-t border-ink-3 pt-4 text-[14px] leading-[1.6] text-bone-2">
                  {a.drive}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Lanes, engine-priced ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— Where {city.name} flies</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
            The lanes, priced live.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[66ch] text-[17px] leading-[1.55] text-bone-2">
            One-way, whole-aircraft indicative ranges from {city.primary.name}, in the category the
            wizard itself recommends per distance — computed by the same engine behind every quote.
          </Reveal>
          <Reveal className="mt-12 overflow-x-auto rounded-[4px] border border-ink-3 bg-ink">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-3">
                  {["Destination", "Distance", "Category", "Block", "All-in from", ""].map((h, i) => (
                    <th key={i} className="px-6 py-4 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-bone-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lanes.map((l) => (
                  <tr key={l.to.icao} className="border-b border-ink-3 last:border-b-0">
                    <td className="px-6 py-5">
                      {l.routeHref ? (
                        <Link href={l.routeHref} className="font-serif text-[17px] tracking-tight text-bone transition-colors hover:text-clearance">
                          {l.to.city} <span className="font-mono text-[10px] text-clearance">→</span>
                        </Link>
                      ) : (
                        <span className="font-serif text-[17px] tracking-tight text-bone">{l.to.city}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 font-mono text-[12px] text-bone-2">{formatNm(l.nm)}</td>
                    <td className="px-6 py-5 text-[13px] text-bone-2">{l.category}</td>
                    <td className="px-6 py-5 font-mono text-[12px] text-bone-2">{l.hours}</td>
                    <td className="px-6 py-5 font-mono text-[13px] text-bone">{formatUSD(l.low)}</td>
                    <td className="px-6 py-5">
                      <RouteQuoteLink
                        from={city.primary.iata}
                        to={l.to.iata}
                        category={l.categorySlug}
                        pax={4}
                        label="Quote"
                        className="btn btn-secondary btn-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-5 max-w-[70ch] font-mono text-[11px] uppercase tracking-[0.1em] leading-[1.8] text-steel">
            — Indicative, whole aircraft, incl. 7.5% FET · exact airframes confirmed by dispatch
            within 30 minutes · reverse direction prices identically
          </p>
        </div>
      </section>

      {/* ─── Rate card ─── */}
      <section className="border-t border-ink-3 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— By the hour</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
            The rate card behind every {city.name} quote.
          </Reveal>
          <div className="mt-12">
            <RateTable />
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about flying {city.name}</p>
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

      {/* ─── Other markets — every city links every other city, so no
             market page depends on the hub alone for its inbound links. */}
      <section className="border-t border-ink-3 py-20 max-md:py-14">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-8">— Also flying from</p>
          </Reveal>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/private-jet-charter/${c.slug}`}
                  className="text-[14px] text-bone-2 transition-colors hover:text-clearance"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuoteLauncher
        context={`city-${city.slug}`}
        defaultFrom={city.primary.iata}
        heading={`Price a ${city.name} departure.`}
        body={`${city.primary.name} is already filled in — add the destination, date, and passenger count and the wizard prices it as you type.`}
      />

      <ClosingCTA
        heading={`${city.name}, on the standard.`}
        body={`Every airframe we quote out of ${city.primary.icao} flies for an ARG/US- or Wyvern-audited operator that passed our vetting. Dispatch knows what's in position today: ${SITE.dispatchPhone}.`}
      />
    </>
  );
}
