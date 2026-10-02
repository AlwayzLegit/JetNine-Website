import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { DeskNotes } from "@/components/desk-notes";
import { FleetImage } from "@/components/aircraft/fleet-image";
import { QuoteLink } from "@/components/aircraft/quote-link";
import { kt, nm, perHour, plainWords, sentence, wifiLabel } from "@/components/aircraft/plain";
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

// Blog band is DB-backed: regenerate hourly so new posts surface without a deploy.
export const revalidate = 3600;

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
      const nmDist = distanceNm(from, to);
      if (nmDist > m.sample.rangeNm) return null;
      const ind = computeIndicative({
        category: m.category,
        legs: [{ id: "s", fromIata: r.from, toIata: r.to, distanceNm: nmDist }],
      });
      if (!ind) return null;
      return {
        ...r,
        nm: nmDist,
        hours: formatHours(ind.hours),
        range: ind.formatted,
        fromCity: from.city,
        toCity: to.city,
      };
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
      a: `${m.lead} If your mission runs past its range or seats, the ${entry.teaser.right.title.toLowerCase()} step-up usually answers; the quote wizard recommends a category per route automatically, and a dispatcher will tell you straight if a cheaper aircraft does your trip just as well.`,
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
    ["Range", `${nm(m.sample.rangeNm)} · with reserves`],
    ["Cruise", kt(m.sample.speedKt)],
    ["Ceiling", `${m.ceilingFt.toLocaleString()} ft`],
    ["Cabin height", m.cabin.heightFt],
    ["Cabin width", m.cabin.widthFt],
    ["Cabin length", m.cabin.lengthFt],
    ["Baggage", `~${m.baggageCuFt} cu ft`],
    ["Wi-Fi", wifiLabel(m.sample.wifi)],
  ];

  return (
    <>
      {/* Product rich results require offers; turboprops have no published rate, so they get no Product block rather than an invalid one. */}
      {rate ? (
        <script
          type="application/ld+json"
          // Build-time stringified site data — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ─── Hero: name, lead, the rate front and centre ─── */}
      <PageHero
        eyebrow={`${entry.name} · ${m.manufacturer}`}
        title={`${m.shortName} charter.`}
        lead={plainWords(m.lead)}
      >
        <nav aria-label="Breadcrumb" className="mt-6 text-[15px] text-bone-2">
          <Link href="/aircraft" className="text-link tap-pad">
            Aircraft
          </Link>
          <span aria-hidden> · </span>
          <Link href={entry.href} className="text-link tap-pad">
            {entry.name}
          </Link>
          <span aria-hidden> · </span>
          <span aria-current="page">{m.shortName}</span>
        </nav>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end">
          <div className="flex flex-wrap items-center gap-4">
            <QuoteLink context={`model-${m.slug}`} category={m.category}>
              Request a quote <span className="arrow">→</span>
            </QuoteLink>
            <Link href={entry.href} className="btn btn-secondary btn-lg">
              All {entry.name.toLowerCase()} aircraft
            </Link>
          </div>
          {rate ? (
            <div className="card card-pad">
              <p className="label-jn">{entry.name} category · hourly</p>
              <p className="mt-3 font-serif text-[40px] font-light leading-none">{rate.market}</p>
              <p className="mt-2 text-[14px] text-bone-2">Market rate · all-in, locked at acceptance</p>
              <div className="mt-5 border-t border-line pt-5">
                <p className="font-serif text-[24px] font-light leading-none text-clearance">
                  {perHour(rate.locked)}
                </p>
                <p className="mt-2 text-[14px] text-bone-2">JetNine Card · locked for 24 months</p>
              </div>
            </div>
          ) : null}
        </div>
      </PageHero>

      {/* ─── Photo + specifications ─── */}
      <section className="section-jn container-jn grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <FleetImage
          src={m.sample.imageUrl}
          alt={`${m.name} exterior`}
          aspect="16/10"
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="rounded-card border border-line"
        />
        <div className="card">
          <div className="border-b border-line px-7 py-5">
            <h2 className="title-card-sm">Specifications</h2>
            <p className="mt-1 text-[14px] text-steel">Typical layout</p>
          </div>
          <dl className="dl-jn px-7 py-6">
            {specs.map(([label, val]) => (
              <div key={label} className="contents">
                <dt>{label}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-7 py-4 text-[13px] leading-[1.6] text-steel">
            Figures are the typical published layout; exact layout and performance vary by aircraft
            and are confirmed with your quote.
          </p>
        </div>
      </section>

      {/* ─── Popular routes, engine-priced ─── */}
      {routes.length > 0 ? (
        <section className="section-jn container-jn">
          <p className="eyebrow">Popular {m.shortName} routes</p>
          <h2 className="title-section max-w-[24ch]">What it flies, and for what.</h2>
          <p className="lead mt-5 max-w-[64ch]">
            Indicative all-in ranges for the whole aircraft, worked out by the same engine behind
            our quote form. Tap through and the quote opens with the route and category loaded.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {routes.map((r) => (
              <div key={`${r.from}-${r.to}`} className="card card-pad flex flex-col gap-5">
                <div>
                  <h3 className="title-card-sm">{r.label}</h3>
                  <p className="mt-1 text-[14px] text-bone-2">
                    {r.fromCity} ({r.from}) → {r.toCity} ({r.to})
                  </p>
                </div>
                <dl className="dl-jn border-y border-line py-5">
                  <dt>Distance</dt>
                  <dd>{nm(r.nm)}</dd>
                  <dt>Flight time</dt>
                  <dd>{r.hours}</dd>
                </dl>
                <div className="flex flex-1 flex-col justify-end gap-4">
                  <div>
                    <p className="label-jn">Indicative, all-in</p>
                    <p className="mt-1 font-serif text-[24px] font-light leading-tight">{r.range}</p>
                  </div>
                  <QuoteLink
                    context={`route-card:${r.from}-${r.to}`}
                    category={m.category}
                    from={r.from}
                    to={r.to}
                    pax={Math.min(m.sample.pax, 8)}
                    className="btn btn-secondary self-start"
                  >
                    Get exact quote <span className="arrow">→</span>
                  </QuoteLink>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ─── FAQ ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Asked about the {m.shortName}</p>
        <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="border-t border-line pt-6">
              <h3 className="title-card-sm">{f.q}</h3>
              <p className="mt-3 max-w-[62ch] text-bone-2">{plainWords(f.a)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Alternatives ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Compare</p>
        <h2 className="title-section max-w-[24ch]">The alternatives worth pricing.</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {siblings.map((s) => (
            <Link
              key={s.slug}
              href={`/aircraft/${s.category}/${s.slug}`}
              className="card card-pad flex flex-col gap-3"
            >
              <p className="label-jn">Same category · {entry.name}</p>
              <h3 className="title-card-sm">{s.shortName}</h3>
              <p className="flex-1 text-bone-2">{plainWords(s.knownFor)}</p>
              <span className="pt-2 text-[15px] font-medium">
                Specs &amp; rates <span className="arrow">→</span>
              </span>
            </Link>
          ))}
          <Link href={entry.teaser.right.href} className="card card-pad flex flex-col gap-3">
            <p className="label-jn">{sentence(entry.teaser.right.label)}</p>
            <h3 className="title-card-sm">{entry.teaser.right.title}</h3>
            <p className="flex-1 text-bone-2">{plainWords(entry.teaser.right.body)}</p>
            <span className="pt-2 text-[15px] font-medium">
              {entry.teaser.right.cta} <span className="arrow">→</span>
            </span>
          </Link>
        </div>
      </section>

      <DeskNotes terms={[m.shortName, m.manufacturer, entry.name, "aircraft", "range"]} heading={`From the desk · ${entry.name}`} />

      {/* ─── Quote handoff (was the inline launcher form) ─── */}
      <section className="section-jn container-jn">
        <div className="card card-pad grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="eyebrow">Start a quote</p>
            <h2 className="title-card">Price a {m.shortName} mission.</h2>
            <p className="mt-2 max-w-[52ch] text-bone-2">
              Route, date, and passengers — the quote opens with the category already chosen and
              prices as you type. Dispatch confirms specific aircraft within 30 minutes.
            </p>
          </div>
          <QuoteLink context={`model-${m.slug}`} category={m.category}>
            Request a quote <span className="arrow">→</span>
          </QuoteLink>
        </div>
      </section>

      <CtaBand
        title={`${m.shortName}, sourced and vetted.`}
        body={`Every ${m.shortName} we quote flies for an ARG/US- or Wyvern-audited operator that passed our on-site vetting. Ask dispatch which aircraft are in position: ${SITE.dispatchPhone}.`}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
