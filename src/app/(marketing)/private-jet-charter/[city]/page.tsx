import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { ProofStrip } from "@/components/proof-strip";
import { DeskNotes } from "@/components/desk-notes";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { RateTable } from "@/components/rate-table";
import { pageMetadata } from "@/lib/page-meta";
import { CITIES, getCity, type CharterCity } from "@/lib/cities";
import { ROUTES } from "@/lib/routes";
import { FLEET } from "@/lib/fleet";
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

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

const nmFormat = new Intl.NumberFormat("en-US");
const formatNm = (n: number) => `${nmFormat.format(n)} nm`;

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
      a: `The quote comes back within 30 minutes during operating hours — three to five real aircraft with all-in pricing. Same-day departures are routine when an aircraft is in position; the dispatch line answers in under twenty seconds, around the clock, at ${SITE.dispatchPhone}.`,
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
      <header className="bg-ink pt-[96px] pb-4 max-md:pt-14">
        <div className="container-jn grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow">
              <Link href="/private-jet-charter" className="tap-pad transition-colors hover:text-bone">
                Charter by city
              </Link>
              <span aria-hidden> · </span>
              {city.state}
            </p>
            <h1 className="title-page max-w-[16ch] !text-[clamp(40px,5.5vw,64px)]">
              Private jet charter, {city.name}.
            </h1>
            <p className="lead mt-5 max-w-[58ch]">{city.lead}</p>
          </div>
          {cheapest ? (
            <div className="card card-pad max-md:p-5">
              <p className="label-jn">
                Departing {city.primary.name} ({city.primary.iata}) · whole aircraft · all-in
              </p>
              <div className="mt-4 font-serif text-[44px] font-light leading-none tracking-tight text-bone max-md:text-[36px]">
                From {formatUSD(cheapest.low)}
              </div>
              <p className="mt-3 text-[15px] text-bone-2">
                {city.name} to {cheapest.to.city} · {cheapest.category.toLowerCase()} · about {cheapest.hours}
              </p>
              <div className="mt-6 border-t border-line pt-5">
                <RouteQuoteLink
                  from={city.primary.iata}
                  to={cheapest.to.iata}
                  category={cheapest.categorySlug}
                  pax={4}
                  label="Get the exact number"
                  className="btn btn-primary btn-lg max-md:w-full"
                />
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="section-jn">
        <ProofStrip />
      </div>

      {/* ─── Airports ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">The fields that matter</p>
          <h2 className="title-section max-w-[26ch]">
            {city.name}&rsquo;s charter airports, chosen for the drive.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {city.airports.map((a) => (
              <div key={a.airport.icao} className="card card-pad flex flex-col max-md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="title-card-sm text-bone">{a.airport.name}</h3>
                  <span className="pill pill-outline shrink-0">{a.role}</span>
                </div>
                <dl className="dl-jn mt-4">
                  <dt>Airport code</dt>
                  <dd>
                    {a.airport.iata}
                    {a.airport.iata !== a.airport.icao ? ` · ${a.airport.icao}` : ""}
                  </dd>
                </dl>
                <p className="mt-4 border-t border-line pt-4 text-[15px] leading-[1.6] text-bone-2">
                  {a.drive}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Lanes, engine-priced ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Where {city.name} flies</p>
          <h2 className="title-section max-w-[24ch]">The lanes, priced live.</h2>
          <p className="mt-5 max-w-[66ch] text-[17px] leading-[1.55] text-bone-2">
            One-way, whole-aircraft indicative ranges from {city.primary.name}, in the category the
            wizard itself recommends per distance — computed by the same engine behind every quote.
          </p>
          <div className="card relative mt-8 overflow-x-auto">
            <table className="table-jn min-w-[760px]">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Distance</th>
                  <th>Category</th>
                  <th>Flight time</th>
                  <th>All-in from</th>
                  <th>
                    <span className="sr-only">Quote</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((l) => (
                  <tr key={l.to.icao}>
                    <td>
                      {l.routeHref ? (
                        <Link
                          href={l.routeHref}
                          className="font-serif text-[20px] tracking-tight text-bone transition-colors hover:text-clearance"
                        >
                          {l.to.city} <span aria-hidden>→</span>
                        </Link>
                      ) : (
                        <span className="font-serif text-[20px] tracking-tight text-bone">{l.to.city}</span>
                      )}
                      <span className="mt-1 block text-[14px] text-steel">
                        {l.to.name} ({l.to.iata})
                      </span>
                    </td>
                    <td className="text-bone-2">{formatNm(l.nm)}</td>
                    <td className="text-bone-2">{l.category}</td>
                    <td className="text-bone-2">{l.hours}</td>
                    <td className="font-medium text-bone">{formatUSD(l.low)}</td>
                    <td className="text-right">
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
          </div>
          <p className="mt-4 max-w-[72ch] text-[14px] leading-[1.6] text-steel">
            Indicative, whole aircraft, including 7.5% FET. Exact aircraft confirmed by dispatch
            within 30 minutes. The reverse direction prices identically.
          </p>
        </div>
      </section>

      {/* ─── Rate card ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">By the hour</p>
          <h2 className="title-section max-w-[24ch]">The rate card behind every {city.name} quote.</h2>
          <div className="mt-8">
            <RateTable />
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Asked about flying {city.name}.</h2>
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

      {/* ─── Other markets — every city links every other city, so no
             market page depends on the hub alone for its inbound links. */}
      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section mb-8">Also flying from</h2>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/private-jet-charter/${c.slug}`}
                  className="inline-flex min-h-[44px] items-center text-[15px] text-bone-2 transition-colors hover:text-bone"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <DeskNotes terms={[city.name, "cities", "airports"]} heading={`From the desk · ${city.name}`} />

      <QuoteLauncher
        context={`city-${city.slug}`}
        defaultFrom={city.primary.iata}
        heading={`Price a ${city.name} departure.`}
        body={`${city.primary.name} is already filled in — add the destination, date, and passenger count and the wizard prices it as you type.`}
      />

      <CtaBand
        title={`${city.name}, on the standard.`}
        body={`Every aircraft we quote out of ${city.primary.name} flies for an ARG/US- or Wyvern-audited operator that passed our vetting. Dispatch knows what's in position today: ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
