import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { ProofStrip } from "@/components/proof-strip";
import { QuoteLauncher, RouteQuoteLink } from "@/components/quote-launcher";
import { pageMetadata } from "@/lib/page-meta";
import { ROUTES, getRoute, relatedRoutes, type CharterRoute } from "@/lib/routes";
import { CITIES } from "@/lib/cities";
import { FLEET, formatNm, type AircraftCategorySlug } from "@/lib/fleet";
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
      a: `The leg is ${formatNm(nm)} great-circle. Block time runs about ${fastest?.hours} in the fastest suitable category (${fastest?.name.toLowerCase()}), a little longer in a turboprop or light jet — the quote lists the estimate per airframe.`,
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
      <header className="border-b border-ink-3 bg-ink pt-[180px] pb-16 max-md:pt-[130px] max-md:pb-12">
        <div className="container-jn grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              <Link href="/routes" className="transition-colors hover:text-bone">Routes</Link>
              <span aria-hidden>·</span>
              <span>{route.from.iata} → {route.to.iata}</span>
            </Reveal>
            <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
              Private jet, {route.from.city} to {route.to.city}.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
              {route.note}
            </Reveal>
          </div>
          {cheapest ? (
            <Reveal stagger={2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — One way · whole aircraft · all-in
              </p>
              <div className="mt-5 font-serif text-[44px] font-light leading-none tracking-tight text-bone">
                From {formatUSD(cheapest.ind.low)}
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                {cheapest.name} category · ~{cheapest.hours} block
              </p>
              <div className="mt-6 border-t border-ink-3 pt-5">
                <RouteQuoteLink
                  from={route.from.iata}
                  to={route.to.iata}
                  category={cheapest.slug}
                  pax={4}
                  label="Get the exact number"
                  className="btn btn-primary"
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </header>

      {/* ─── At a glance ─── */}
      <section aria-label="Route at a glance" className="border-b border-ink-3 bg-ink-2">
        <div className="container-jn flex flex-wrap items-stretch">
          {[
            [`${route.from.icao} · ${route.from.name}`, `Departing ${route.from.city}`],
            [`${route.to.icao} · ${route.to.name}`, `Arriving ${route.to.city}`],
            [formatNm(nm), "Great-circle distance"],
            [`~${fastest?.hours ?? "—"}`, `Block time · ${fastest?.name.toLowerCase() ?? ""}`],
            ["< 30 min", "Quote turnaround · same-day flyable"],
          ].map(([big, label]) => (
            <div
              key={label}
              className="flex min-w-[170px] flex-1 flex-col justify-center gap-1.5 border-r border-ink-3 px-6 py-6 last:border-r-0"
            >
              <span className="font-serif text-[18px] font-normal leading-tight tracking-tight text-bone">
                {big}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-2">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Aircraft options ─── */}
      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— Aircraft for this lane</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            Every category that flies it, priced.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[66ch] text-[17px] leading-[1.55] text-bone-2">
            Indicative one-way ranges for the whole aircraft, computed by the same engine behind
            the quote wizard. The marked category is what the wizard itself recommends for four
            passengers on this distance.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {options.map((o, i) => (
              <Reveal
                key={o.slug}
                stagger={(i % 3) as 0 | 1 | 2}
                className={[
                  "flex flex-col gap-5 rounded-[4px] border bg-ink-2 p-7",
                  o.recommended ? "border-clearance" : "border-ink-3",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-[22px] font-normal leading-tight tracking-tight text-bone">
                      {o.name}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-steel">
                      e.g. {o.exampleModels.join(" · ")}
                    </div>
                  </div>
                  {o.recommended ? (
                    <span className="shrink-0 rounded-[2px] bg-clearance px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 border-y border-ink-3 py-5 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Block</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{o.hours}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Hourly</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{formatUSD(o.ind.hourly)}/hr</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                      — One way, all-in
                    </div>
                    <div className="mt-1 font-serif text-[21px] font-light leading-tight tracking-tight text-bone">
                      {o.ind.formatted}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <RouteQuoteLink
                      from={route.from.iata}
                      to={route.to.iata}
                      category={o.slug}
                      pax={4}
                      label="Quote it"
                      className="btn btn-secondary btn-sm"
                    />
                    <Link
                      href={o.href}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-clearance transition-colors hover:text-bone"
                    >
                      Category <span className="arrow">→</span>
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 max-w-[70ch] text-[13px] leading-[1.6] text-steel">
            Flying the other direction? Same lane, same math — the wizard prices{" "}
            {route.to.city} to {route.from.city} identically; repositioning differences show up in
            the firm quote, not a different rate card.
          </p>
          {(() => {
            const guides = CITIES.filter(
              (c) => c.name === route.from.city || c.name === route.to.city,
            );
            return guides.length > 0 ? (
              <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.6] text-steel">
                City guides:{" "}
                {guides.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 ? " · " : ""}
                    <Link href={`/private-jet-charter/${c.slug}`} className="text-clearance">
                      {c.name} airports &amp; lanes
                    </Link>
                  </span>
                ))}
              </p>
            ) : null;
          })()}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about this route</p>
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

      <ProofStrip />

      {/* ─── Related routes ─── */}
      {related.length > 0 ? (
        <section className="border-t border-ink-3 py-24 max-md:py-16">
          <div className="container-jn">
            <Reveal>
              <p className="caption mb-6">— Nearby lanes</p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((r, i) => (
                <Reveal key={r.slug} stagger={(i % 3) as 0 | 1 | 2}>
                  <Link
                    href={`/routes/${r.slug}`}
                    className="group flex h-full flex-col rounded-[4px] border border-ink-3 bg-ink-2 p-8 transition-colors hover:border-[rgba(232,226,210,0.3)]"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                      {r.from.iata} → {r.to.iata}
                    </span>
                    <h3 className="mt-3 font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone group-hover:text-clearance">
                      {r.from.city} to {r.to.city}
                    </h3>
                    <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                      Cost &amp; time <span className="arrow">→</span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <QuoteLauncher
        context={`route-${route.slug}`}
        defaultFrom={route.from.iata}
        defaultTo={route.to.iata}
        heading={`Price ${route.from.city} to ${route.to.city} now.`}
        body="The route is already filled in — add a date and passenger count and the wizard prices it as you type."
      />

      <ClosingCTA
        heading="This lane, on the standard."
        body={`Every airframe we quote on it flies for an ARG/US- or Wyvern-audited operator that passed our vetting. Dispatch knows what's in position today: ${SITE.dispatchPhone}.`}
      />
    </>
  );
}
