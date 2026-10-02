import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { ProofStrip } from "@/components/proof-strip";
import { DeskNotes } from "@/components/desk-notes";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { pageMetadata } from "@/lib/page-meta";
import { ROUTES, getRoute, relatedRoutes, type CharterRoute } from "@/lib/routes";
import { CITIES } from "@/lib/cities";
import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import { MODELS } from "@/lib/models";
import { distanceNm } from "@/lib/airports";
import {
  computeIndicative,
  formatHours,
  formatUSD,
  recommendCategory,
  type Indicative,
} from "@/lib/quote-pricing";
import { SITE } from "@/lib/constants";

// Route pages — audit item 5, scoped to ~20 confirmed low-KD lanes.
// The template is the best-of-breed composite from the four-broker
// audit: from-price hero, at-a-glance spec box, aircraft-by-category
// cards, dollar-figure FAQs, related routes — with the numbers the
// incumbents leave out, computed by the quote engine so no route page
// can contradict the wizard.
type RouteParams = { params: Promise<{ slug: string }> };

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

const nmFormat = new Intl.NumberFormat("en-US");
const formatNm = (n: number) => `${nmFormat.format(n)} nm`;

export function generateStaticParams() {
  return ROUTES.map((r) => ({ slug: r.slug }));
}

type CategoryOption = {
  slug: AircraftCategorySlug;
  name: string;
  href: string;
  ind: Indicative;
  hours: string;
  recommended: boolean;
  exampleModels: string[];
};

// Every category whose published range covers the leg, priced by the
// engine — cheapest first. The recommendation mirrors the wizard's own
// recommendCategory() so the two never disagree.
function categoryOptions(route: CharterRoute): { nm: number; options: CategoryOption[] } {
  const nm = distanceNm(route.from, route.to);
  const rec = recommendCategory(4, nm);
  const options = FLEET.filter((f) => f.rangeNm >= nm)
    .map((f) => {
      const ind = computeIndicative({
        category: f.slug,
        legs: [{ id: "r", fromIata: route.from.iata, toIata: route.to.iata, distanceNm: nm }],
      });
      if (!ind) return null;
      return {
        slug: f.slug,
        name: f.name,
        href: f.href,
        ind,
        hours: formatHours(ind.hours),
        recommended: f.slug === rec,
        exampleModels: MODELS.filter((m) => m.category === f.slug)
          .slice(0, 2)
          .map((m) => m.shortName),
      };
    })
    .filter((o): o is CategoryOption => o !== null)
    .sort((a, b) => a.ind.low - b.ind.low)
    .slice(0, 4);
  return { nm, options };
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const route = getRoute(slug);
  if (!route) return {};
  const { nm, options } = categoryOptions(route);
  const cheapest = options[0];
  return pageMetadata({
    title: `Private Jet ${route.from.city} to ${route.to.city} — Cost & Time`,
    description: `Charter ${route.from.city} to ${route.to.city}: ${formatNm(nm)}, about ${options[0] ? options[options.length - 1].hours : "—"} in the air${cheapest ? `, from ${formatUSD(cheapest.ind.low)} one way for the whole aircraft` : ""}. Live pricing, vetted operators, quotes in 30 minutes.`,
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

      {/* ─── Header: route + from-price ─── */}
      <header className="bg-ink pt-[96px] pb-4 max-md:pt-14">
        <div className="container-jn grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow">
              <Link href="/routes" className="tap-pad transition-colors hover:text-bone">
                Routes
              </Link>
              <span aria-hidden> · </span>
              {route.from.city} ({route.from.iata}) → {route.to.city} ({route.to.iata})
            </p>
            <h1 className="title-page max-w-[16ch] !text-[clamp(40px,5.5vw,64px)]">
              Private jet, {route.from.city} to {route.to.city}.
            </h1>
            <p className="lead mt-5 max-w-[58ch]">{route.note}</p>
          </div>
          {cheapest ? (
            <div className="card card-pad max-md:p-5">
              <p className="label-jn">One way · whole aircraft · all-in</p>
              <div className="mt-4 font-serif text-[44px] font-light leading-none tracking-tight text-bone max-md:text-[36px]">
                From {formatUSD(cheapest.ind.low)}
              </div>
              <p className="mt-3 text-[15px] text-bone-2">
                {cheapest.name} category · about {cheapest.hours} in the air
              </p>
              <div className="mt-6 border-t border-line pt-5">
                <RouteQuoteLink
                  from={route.from.iata}
                  to={route.to.iata}
                  category={cheapest.slug}
                  pax={4}
                  label="Get the exact number"
                  className="btn btn-primary btn-lg max-md:w-full"
                />
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* ─── At a glance ─── */}
      <section aria-label="Route at a glance" className="section-jn">
        <div className="container-jn">
          <div className="card grid grid-cols-1 divide-y divide-line-faint sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
            {[
              [`${route.from.name} (${route.from.iata})`, `Departing ${route.from.city}`],
              [`${route.to.name} (${route.to.iata})`, `Arriving ${route.to.city}`],
              [formatNm(nm), "Distance, as the crow flies"],
              [`About ${fastest?.hours ?? "—"}`, `Flight time · ${fastest?.name.toLowerCase() ?? ""}`],
              ["Under 30 min", "Quote turnaround · same-day flyable"],
            ].map(([big, label]) => (
              <div key={label} className="flex flex-col justify-center gap-1.5 px-6 py-6 lg:border-r lg:border-line lg:last:border-r-0">
                <span className="font-serif text-[22px] font-normal leading-tight tracking-tight text-bone">
                  {big}
                </span>
                <span className="text-[14px] text-steel">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Aircraft options ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">Aircraft for this lane</p>
          <h2 className="title-section max-w-[26ch]">Every category that flies it, priced.</h2>
          <p className="mt-5 max-w-[66ch] text-[17px] leading-[1.55] text-bone-2">
            Indicative one-way ranges for the whole aircraft, computed by the same engine behind
            the quote wizard. The marked category is what the wizard itself recommends for four
            passengers on this distance.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {options.map((o) => (
              <div
                key={o.slug}
                className={["card card-pad flex flex-col gap-5 max-md:p-5", o.recommended ? "card-selected" : ""].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="title-card-sm text-bone">{o.name}</div>
                    <div className="mt-1 text-[14px] text-steel">e.g. {o.exampleModels.join(" · ")}</div>
                  </div>
                  {o.recommended ? (
                    <span className="shrink-0 text-[13px] font-semibold text-gold">Recommended</span>
                  ) : null}
                </div>
                <dl className="dl-jn border-y border-line py-4">
                  <dt>Flight time</dt>
                  <dd>{o.hours}</dd>
                  <dt>Hourly</dt>
                  <dd>{formatUSD(o.ind.hourly)}/hr</dd>
                </dl>
                <div className="flex flex-1 flex-col justify-end gap-4">
                  <div>
                    <div className="text-[14px] text-steel">One way, all-in</div>
                    <div className="mt-1 font-serif text-[26px] font-light leading-tight tracking-tight text-bone">
                      {o.ind.formatted}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <RouteQuoteLink
                      from={route.from.iata}
                      to={route.to.iata}
                      category={o.slug}
                      pax={4}
                      label="Quote it"
                      className="btn btn-secondary btn-sm"
                    />
                    <Link href={o.href} className="text-link text-[15px]">
                      Category <span className="arrow">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[70ch] text-[15px] leading-[1.6] text-steel">
            Flying the other direction? Same lane, same math — the wizard prices{" "}
            {route.to.city} to {route.from.city} identically; repositioning differences show up in
            the firm quote, not a different rate card.
          </p>
          {cityGuides.length > 0 ? (
            <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-steel">
              City guides:{" "}
              {cityGuides.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/private-jet-charter/${c.slug}`} className="text-link">
                    {c.name} airports &amp; lanes
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Asked about this route.</h2>
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

      <div className="section-jn">
        <ProofStrip />
      </div>

      {/* ─── Related routes ─── */}
      {related.length > 0 ? (
        <section className="section-jn">
          <div className="container-jn">
            <h2 className="title-section mb-8">Nearby lanes</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/routes/${r.slug}`} className="card card-pad group flex h-full flex-col max-md:p-5">
                  <span className="label-jn">
                    {r.from.city} ({r.from.iata}) → {r.to.city} ({r.to.iata})
                  </span>
                  <h3 className="title-card-sm mt-3 text-bone transition-colors group-hover:text-clearance">
                    {r.from.city} to {r.to.city}
                  </h3>
                  <span className="mt-5 text-[15px] font-medium text-bone">
                    Cost &amp; time <span className="arrow">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <DeskNotes terms={[route.from.city, route.to.city, "routes"]} heading={`From the desk · ${route.from.city} and ${route.to.city}`} />

      <QuoteLauncher
        context={`route-${route.slug}`}
        defaultFrom={route.from.iata}
        defaultTo={route.to.iata}
        heading={`Price ${route.from.city} to ${route.to.city} now.`}
        body="The route is already filled in — add a date and passenger count and the wizard prices it as you type."
      />

      <CtaBand
        title="This lane, on the standard."
        body={`Every aircraft we quote on it flies for an ARG/US- or Wyvern-audited operator that passed our vetting. Dispatch knows what's in position today: ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
