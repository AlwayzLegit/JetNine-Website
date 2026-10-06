import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { DeskNotes } from "@/components/desk-notes";
import { pageMetadata } from "@/lib/page-meta";
import { ROUTES, getRoute, relatedRoutes } from "@/lib/routes";
import { CITIES } from "@/lib/cities";
import { formatUSD } from "@/lib/quote-pricing";
import { SITE } from "@/lib/constants";
import { RoutesHero } from "@/components/routes/routes-hero";
import { RouteCardView } from "@/components/routes/routes-explorer";
import { RoutePlanForm, RouteQuoteButton } from "@/components/routes/quote-actions";
import { categoryOptions, formatNm, routeCard, routeImage } from "@/components/routes/route-data";
import { AirportBand, BeforeYouRequest, RouteFaq, RouteGuideBand, RouteSources } from "@/components/routes/sections";
import { SOURCE_URLS } from "@/components/routes/icons";

// Route pages — audit item 5, scoped to ~20 confirmed low-KD lanes.
// The template is the best-of-breed composite from the four-broker
// audit: from-price hero, at-a-glance spec box, aircraft-by-category
// cards, dollar-figure FAQs, related routes — with the numbers the
// incumbents leave out, computed by the quote engine so no route page
// can contradict the wizard.
type RouteParams = { params: Promise<{ slug: string }> };

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return ROUTES.map((r) => ({ slug: r.slug }));
}

// Reviewed route summaries use local planning details instead of fixed
// teaser fares, precise flight-time promises, or response-time guarantees.
const ROUTE_METADATA: Partial<Record<string, { title: string; description: string }>> = {
  "los-angeles-to-new-york": {
    "title": "Los Angeles to New York Private Jet Charter",
    "description": "Plan a coast-to-coast charter from Van Nuys to Teterboro. Compare aircraft, estimated costs and flight times, including considerations for the westbound return."
  },
  "los-angeles-to-las-vegas": {
    "title": "Los Angeles to Las Vegas Private Jet Charter",
    "description": "Explore private jet charter from Van Nuys to Las Vegas. Compare aircraft, estimated flight times and costs, with planning notes for busy event weekends."
  },
  "new-york-to-miami": {
    "title": "New York to Miami Private Jet Charter",
    "description": "Compare private jet options from Teterboro to Miami’s Opa-Locka airport. Review estimated costs, flight times and seasonal planning for your Florida trip."
  },
  "new-york-to-london": {
    "title": "New York to London Private Jet Charter",
    "description": "Explore transatlantic charter from Teterboro to London Luton. Compare aircraft range, estimated costs and flight times for your outbound and return journey."
  },
  "los-angeles-to-london": {
    "title": "Los Angeles to London Private Jet Charter",
    "description": "Plan a Los Angeles to London charter with long-range aircraft options. Review LAX and Heathrow, estimated costs, flight times and international arrival planning."
  },
  "miami-to-bahamas": {
    "title": "Miami to Nassau Private Jet Charter — Bahamas",
    "description": "Explore private charter from Miami to Nassau in the Bahamas. Compare aircraft, estimated costs and flight times, and review passport and customs considerations."
  },
  "los-angeles-to-cabo": {
    "title": "Los Angeles to Los Cabos Private Jet Charter",
    "description": "Plan private jet travel from LAX to Los Cabos. Compare aircraft, baggage needs and estimated charter costs, with guidance on international handling."
  },
  "new-york-to-palm-beach": {
    "title": "New York to Palm Beach Private Jet Charter",
    "description": "Explore charter from Teterboro to Palm Beach International. Compare aircraft, estimated costs and flight times, with notes on holiday airport demand."
  }
};

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const route = getRoute(slug);
  if (!route) return {};
  const { nm, options } = categoryOptions(route);
  const cheapest = options[0];
  return pageMetadata({
    title: ROUTE_METADATA[route.slug]?.title ?? `Private Jet ${route.from.city} to ${route.to.city} — Cost & Time`,
    description: ROUTE_METADATA[route.slug]?.description ?? `Charter ${route.from.city} to ${route.to.city}: ${formatNm(nm)}, about ${options[0] ? options[options.length - 1].hours : "—"} in the air${cheapest ? `, from ${formatUSD(cheapest.ind.low)} one way for the whole aircraft` : ""}. Live pricing, vetted operators, quotes in 30 minutes.`,
    path: `/routes/${route.slug}`,
  });
}

export default async function RoutePage({ params }: RouteParams) {
  const { slug } = await params;
  const route = getRoute(slug);
  if (!route) notFound();

  const { nm, options } = categoryOptions(route);
  const cheapest = options[0];
  const fastest = options.reduce((a, b) => (b.ind.hours < a.ind.hours ? b : a), options[0]);
  const related = relatedRoutes(route);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const FAQ = [
    {
      q: `How much is a private jet from ${route.from.city} to ${route.to.city}?`,
      a: `From ${cheapest ? formatUSD(cheapest.ind.low) : "the published rate card"} one way for the whole aircraft (${cheapest?.name.toLowerCase()} category), up to ${options.length > 1 ? formatUSD(options[options.length - 1].ind.high) : ""} for the largest cabin that flies the lane. Every figure is all-in — fuel, crew, landing, 7.5% FET — and locked at acceptance.`,
    },
    {
      q: `How long is the flight?`,
      a: `The leg is ${formatNm(nm)} as the crow flies. Block time runs about ${fastest?.hours} in the fastest suitable category (${fastest?.name.toLowerCase()}), a little longer in a turboprop or light jet — the quote lists the estimate per aircraft.`,
    },
    {
      q: `Which airports does the flight use?`,
      a: `${route.from.name} (${route.from.icao}) on the ${route.from.city} end and ${route.to.name} (${route.to.icao}) into ${route.to.city} — chosen for ramp access and drive time, not airline convenience. If a different field suits your day better, dispatch will quote it; the price difference is usually minutes, not thousands.`,
    },
    {
      q: `Are there empty legs on this route?`,
      a: `Busy lanes generate repositioning flights, and this is one. Empty legs on the pair list at 30–60% off with locked dates — set a watchlist with the route and your date window and we'll text the moment one matches. One SMS per match, no spam.`,
    },
  ];

  const airportJsonLd = (a: typeof route.from) => ({
    "@context": "https://schema.org",
    "@type": "Airport",
    name: a.name,
    iataCode: a.iata.length === 3 ? a.iata : undefined,
    icaoCode: a.icao,
    address: { "@type": "PostalAddress", addressLocality: a.city },
    geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lon },
  });

  const offerJsonLd =
    options.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Private jet charter",
          name: `Private jet charter, ${route.from.city} to ${route.to.city}`,
          provider: { "@id": `${siteUrl}/#organization` },
          areaServed: [route.from.city, route.to.city],
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: cheapest.ind.low,
            highPrice: options[options.length - 1].ind.high,
            offerCount: options.length,
            offers: options.map((o) => ({
              "@type": "Offer",
              name: `${o.name} category, one way`,
              priceCurrency: "USD",
              price: o.ind.low,
            })),
          },
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Routes", item: `${siteUrl}/routes` },
      {
        "@type": "ListItem",
        position: 3,
        name: `${route.from.city} to ${route.to.city}`,
        item: `${siteUrl}/routes/${route.slug}`,
      },
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


  const cityGuides = CITIES.filter((c) => c.name === route.from.city || c.name === route.to.city);
  const laneCodes = [route.from.iata, route.to.iata];
  const terminalLinks = [
    ...(laneCodes.includes("VNY") ? [{ label: "Van Nuys private terminal directory", href: SOURCE_URLS.vny }] : []),
    ...(laneCodes.includes("TEB") ? [{ label: "Teterboro official airport information", href: SOURCE_URLS.teb }] : []),
  ];

  const facts: [string, string][] = [
    [`${route.from.name} (${route.from.iata})`, `Departing ${route.from.city}`],
    [`${route.to.name} (${route.to.iata})`, `Arriving ${route.to.city}`],
    [formatNm(nm), "Distance, as the crow flies"],
    [`About ${fastest?.hours ?? "—"}`, `Flight time · ${fastest?.name.toLowerCase() ?? ""}`],
    ["Under 30 min", "Quote turnaround · same-day flyable"],
  ];

  return (
    <>
      {[airportJsonLd(route.from), airportJsonLd(route.to), offerJsonLd, breadcrumbJsonLd, faqJsonLd]
        .filter(Boolean)
        .map((json, i) => (
          <script
            key={i}
            type="application/ld+json"
            // Build-time stringified site data — not user-controlled.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
          />
        ))}

      <RoutesHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Routes", href: "/routes" }, { label: `${route.from.city} to ${route.to.city}` }]}
        eyebrow={`${route.from.city} (${route.from.iata}) → ${route.to.city} (${route.to.iata})`}
        title={`Private jet, ${route.from.city} to ${route.to.city}.`}
        lead={route.note}
        imageSrc={routeImage(route)}
        imagePosition="center 55%"
      />

      {/* ─── At a glance: overlapping facts card with the from-price ─── */}
      <section aria-label="Route at a glance" className="container-jn relative z-[5] -mt-12">
        <div className="flex flex-wrap border border-line bg-white shadow-[0_14px_40px_rgba(18,35,46,.12)]">
          <dl className="grid min-w-0 flex-[999_1_560px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
            {facts.map(([big, label]) => (
              <div key={label} className="flex flex-col-reverse justify-end gap-1 border-b border-r border-line px-5 py-4">
                <dt className="text-[12px] text-steel">{label}</dt>
                <dd className="font-serif text-[20px] leading-tight">{big}</dd>
              </div>
            ))}
          </dl>
          {cheapest ? (
            <div className="flex min-w-0 flex-[1_1_260px] flex-col justify-center gap-2 px-5 py-4">
              <p className="text-[12px] font-bold text-steel">One way · whole aircraft · all-in</p>
              <p className="font-serif text-[34px] leading-none">From {formatUSD(cheapest.ind.low)}</p>
              <p className="text-[13px] text-steel">
                {cheapest.name} category · about {cheapest.hours} in the air
              </p>
              <RouteQuoteButton
                from={route.from.iata}
                to={route.to.iata}
                category={cheapest.slug}
                label="Get the exact number"
                className="btn btn-primary mt-1 w-full"
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className="container-jn flex flex-wrap items-start gap-7 pt-6">
        {/* ─── Aircraft options ─── */}
        <section className="min-w-0 flex-[1.7_1_520px]">
          <p className="eyebrow mb-1">Aircraft for this lane</p>
          <h2 className="font-serif text-[30px] leading-[1.1]">Every category that flies it, priced.</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-steel">
            Indicative one-way ranges for the whole aircraft, computed by the same engine behind the quote wizard. The
            marked category is what the wizard itself recommends for four passengers on this distance.
          </p>
          <div className="mt-3 grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {options.map((o) => (
              <article key={o.slug} className={`flex flex-col border bg-white px-4 py-[14px] ${o.recommended ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-[22px] leading-[1.1]">{o.name}</h3>
                    <p className="mt-1 text-[12px] text-steel">e.g. {o.exampleModels.join(" · ")}</p>
                  </div>
                  {o.recommended ? <span className="pill pill-clearance shrink-0 !text-[11px]">Recommended</span> : null}
                </div>
                <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 border-y border-line py-[10px] text-[13px]">
                  <dt className="text-steel">Flight time</dt>
                  <dd>{o.hours}</dd>
                  <dt className="text-steel">Hourly</dt>
                  <dd>{formatUSD(o.ind.hourly)}/hr</dd>
                </dl>
                <p className="mt-3 text-[12px] text-steel">One way, all-in</p>
                <p className="font-serif text-[24px] leading-tight">{o.ind.formatted}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                  <RouteQuoteButton from={route.from.iata} to={route.to.iata} category={o.slug} label="Quote it" className="btn btn-secondary btn-sm" />
                  <Link href={o.href} className="text-[13px] font-bold text-gold">
                    {o.name} category <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-[10px] max-w-[70ch] text-[12px] text-steel">
            Flying the other direction? Same lane, same math — the wizard prices {route.to.city} to {route.from.city}{" "}
            identically; repositioning differences show up in the firm quote, not a different rate card.
          </p>
          {cityGuides.length > 0 ? (
            <p className="mt-2 text-[13px] text-steel">
              City guides:{" "}
              {cityGuides.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/private-jet-charter/${c.slug}`} className="font-bold text-gold">
                    {c.name} airports &amp; lanes →
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </section>
        <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
          <aside className="sticky top-[84px] flex flex-col gap-[14px]">
            <RoutePlanForm from={route.from.iata} to={route.to.iata} context={`route-${route.slug}`} />
            <BeforeYouRequest />
          </aside>
        </div>
      </div>

      <RouteFaq
        title="Asked about this route."
        items={FAQ}
        aside={
          related.length > 0 ? (
            <div>
              <h2 className="font-serif text-[28px] leading-[1.1]">Nearby lanes</h2>
              <div className="mt-[10px] grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
                {related.map((r) => (
                  <RouteCardView key={r.slug} r={routeCard(r)} quick={false} />
                ))}
              </div>
              <Link href="/routes" className="mt-3 inline-block text-[13px] font-bold text-gold">
                All route guides <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : undefined
        }
      />

      <AirportBand
        airport={`${route.from.name} · ${route.from.iata}`}
        links={terminalLinks}
        rows={[
          [`${route.from.name} · ${route.from.icao}`, `Departure field for ${route.from.city}.`],
          [`${route.to.name} · ${route.to.icao}`, `Arrival field for ${route.to.city}.`],
        ]}
      />
      <RouteGuideBand />

      <DeskNotes terms={[route.from.city, route.to.city, "routes"]} heading={`From the desk · ${route.from.city} and ${route.to.city}`} />

      <RouteSources />

      <CtaBand
        title="This lane, on the standard."
        body={`Every aircraft we quote on it flies for an ARG/US- or Wyvern-audited operator that passed our vetting. Dispatch knows what's in position today: ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
        imageSrc="/images/light/mountain-landscape.webp"
        imagePosition="right center"
      />
    </>
  );
}
