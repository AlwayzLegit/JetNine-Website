import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { EdgeHero } from "@/components/company/edge-hero";
import { FaqList } from "@/components/company/faq-list";
import { NextStep, TripBrief } from "@/components/charter/sections";
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
// Markets with a photo in public/images/light/<slug>.webp.
const CITY_PHOTOS = new Set(["los-angeles", "new-york", "miami", "las-vegas", "san-francisco", "aspen"]);

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

  const photo = CITY_PHOTOS.has(city.slug) ? `/images/light/${city.slug}.webp` : "/images/light/boarding-golden-hour.webp";

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

      {/* ─── Hero ─── */}
      <EdgeHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Charter", href: "/private-jet-charter" }, { label: city.name }]}
        title={<span className="[text-wrap:balance]">Private jet charter, {city.name}.</span>}
        body={<p>{city.lead}</p>}
        imageSrc={photo}
        caption={CITY_PHOTOS.has(city.slug) ? "Illustrative imagery" : null}
      >
        {cheapest ? (
          <div className="mt-6 max-w-[460px] border border-line bg-white p-5">
            <p className="text-[12px] uppercase tracking-[0.14em] text-gold">
              Departing {city.primary.name} ({city.primary.iata}) · whole aircraft · all-in
            </p>
            <div className="mt-3 font-serif text-[40px] leading-none max-sm:text-[34px]">From {formatUSD(cheapest.low)}</div>
            <p className="mt-2 text-[14px] text-steel">
              {city.name} to {cheapest.to.city} · {cheapest.category.toLowerCase()} · about {cheapest.hours}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <RouteQuoteLink
                from={city.primary.iata}
                to={cheapest.to.iata}
                category={cheapest.categorySlug}
                pax={4}
                label="Get the exact number"
                className="btn h-[42px] border-gold bg-gold !text-[14px] !font-bold text-white hover:bg-[#6b4c2b] max-sm:w-full"
              />
              <a href="#brief" className="text-link text-[14px]">
                Prepare a trip brief
              </a>
            </div>
          </div>
        ) : null}
      </EdgeHero>

      <TripBrief city={city.name} />

      {/* ─── Airports ─── */}
      <section className="container-jn pt-14 max-md:pt-10">
        <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">The fields that matter</p>
        <h2 className="mt-[10px] font-serif text-[34px] leading-[1.1]">{city.name}&rsquo;s charter airports, chosen for the drive.</h2>
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {city.airports.map((a) => (
            <div key={a.airport.icao} className="flex flex-col border border-line-faint bg-white p-5">
              <span className="text-[12px] uppercase tracking-[0.14em] text-gold">{a.role}</span>
              <h3 className="mt-2 font-serif text-[22px] leading-[1.2]">{a.airport.name}</h3>
              <p className="mt-1 text-[14px] font-bold">
                {a.airport.iata}
                {a.airport.iata !== a.airport.icao ? ` · ${a.airport.icao}` : ""}
              </p>
              <p className="mt-3 border-t border-line pt-3 text-[14px] leading-[1.55] text-steel">{a.drive}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Lanes, engine-priced ─── */}
      <section className="container-jn pt-14 max-md:pt-10">
        <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">Where {city.name} flies</p>
        <h2 className="mt-[10px] font-serif text-[34px] leading-[1.1]">The lanes, priced live.</h2>
        <p className="mt-3 max-w-[66ch] text-steel">
          One-way, whole-aircraft indicative ranges from {city.primary.name}, in the category recommended for each distance — computed by
          the same engine behind every quote.
        </p>
        <div className="relative mt-6 overflow-x-auto border border-line bg-white" tabIndex={0} role="region" aria-label={`Lanes from ${city.name} — scrolls sideways`}>
          <table className="w-full min-w-[720px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left">
                <th className="px-4 py-[10px] font-bold">Destination</th>
                <th className="px-4 py-[10px] font-bold">Distance</th>
                <th className="px-4 py-[10px] font-bold">Category</th>
                <th className="px-4 py-[10px] font-bold">Flight time</th>
                <th className="px-4 py-[10px] font-bold">All-in from</th>
                <th className="px-4 py-[10px]">
                  <span className="sr-only">Quote</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((l) => (
                <tr key={l.to.icao} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3">
                    {l.routeHref ? (
                      <Link href={l.routeHref} className="font-serif text-[18px] hover:text-gold">
                        {l.to.city} <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <span className="font-serif text-[18px]">{l.to.city}</span>
                    )}
                    <span className="block text-[13px] text-steel">
                      {l.to.name} ({l.to.iata})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-steel">{formatNm(l.nm)}</td>
                  <td className="px-4 py-3 text-steel">{l.category}</td>
                  <td className="px-4 py-3 text-steel">{l.hours}</td>
                  <td className="px-4 py-3 font-bold">{formatUSD(l.low)}</td>
                  <td className="px-4 py-3 text-right">
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
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.6] text-steel">
          Indicative, whole aircraft, including 7.5% FET. Exact aircraft confirmed by dispatch within 30 minutes. The reverse direction
          prices identically.
        </p>
      </section>

      {/* ─── Rate card ─── */}
      <section className="container-jn pt-14 max-md:pt-10">
        <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">By the hour</p>
        <h2 className="mb-6 mt-[10px] font-serif text-[34px] leading-[1.1]">The rate card behind every {city.name} quote.</h2>
        <RateTable />
      </section>

      <NextStep />

      {/* ─── FAQ ─── */}
      <section className="container-jn pt-14 max-md:pt-10">
        <h2 className="font-serif text-[34px] leading-[1.1]">Asked about flying {city.name}.</h2>
        <FaqList className="mt-4" joined items={FAQ} />
      </section>

      {/* ─── Other markets — every city links every other city, so no
             market page depends on the hub alone for its inbound links. */}
      <section className="container-jn pt-14 max-md:pt-10">
        <h2 className="mb-4 font-serif text-[30px]">Also flying from</h2>
        <ul className="grid list-none gap-x-8 p-0 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
          {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
            <li key={c.slug} className="border-b border-line-faint">
              <Link href={`/private-jet-charter/${c.slug}`} className="flex min-h-[44px] items-center justify-between text-[15px] hover:text-gold">
                {c.name} <span aria-hidden="true" className="text-gold">→</span>
              </Link>
            </li>
          ))}
        </ul>
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
