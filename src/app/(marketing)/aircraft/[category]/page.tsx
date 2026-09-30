import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BestForIcon } from "@/components/best-for-icon";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { FleetImage } from "@/components/aircraft/fleet-image";
import { QuoteLink } from "@/components/aircraft/quote-link";
import {
  flightTime,
  kt,
  nm,
  plainShortName,
  plainSpec,
  plainWords,
  sentence,
  titleCase,
  wifiLabel,
} from "@/components/aircraft/plain";
import { SITE } from "@/lib/constants";
import { FLEET, getFleetEntry } from "@/lib/fleet";
import { MODELS } from "@/lib/models";
import { pageMetadata } from "@/lib/page-meta";

type RouteParams = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return FLEET.map((f) => ({ category: f.slug }));
}

// Query-first titles: category-intent searches are "light jet charter",
// "turboprop charter", not the bare category name the old brand-first
// titles carried ("Light · JetNine"). The root template appends "· JetNine".
const SEO_TITLES: Record<string, string> = {
  turboprop: "Turboprop Charter — Aircraft, Range & Rates",
  light: "Light Jet Charter — Aircraft, Range & Rates",
  midsize: "Midsize Jet Charter — Aircraft, Range & Rates",
  supermid: "Super-Midsize Jet Charter — Aircraft & Rates",
  heavy: "Heavy Jet Charter — Aircraft, Range & Rates",
  ultra: "Ultra-Long-Range Jet Charter — Aircraft & Rates",
};

// Meta descriptions come from the entry lead, which can run past the
// ~160-char limit. A blunt slice() cut mid-word ("...quicker to dispa");
// cut at the last word boundary instead and mark the elision.
function truncateAtWord(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) return {};
  // Note: no `image` override here — Next.js auto-discovers the
  // sibling opengraph-image.tsx, which renders a composed
  // category-specific OG card (photo + headline + spec line) at
  // 1200×630. That beats the raw 4:5 fleet photo for social cropping.
  return pageMetadata({
    title: SEO_TITLES[entry.slug] ?? `${entry.name} Charter`,
    description: truncateAtWord(entry.lead),
    path: entry.href,
  });
}

export default async function AircraftCategoryPage({ params }: RouteParams) {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const shortName = plainShortName(entry.shortName, entry.name);

  // BreadcrumbList: Home › Aircraft › {Category}. Helps Google
  // surface the breadcrumb trail under the search result and improves
  // site hierarchy understanding.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Aircraft", item: `${siteUrl}/aircraft` },
      { "@type": "ListItem", position: 3, name: entry.name, item: `${siteUrl}${entry.href}` },
    ],
  };

  // Service: each category is a distinct service offering. Google
  // uses this for the services panel + better matching against
  // category-intent queries ("private heavy jet charter", etc.).
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Private aviation charter",
    name: `JetNine ${entry.name} Charter`,
    description: entry.lead.slice(0, 280),
    provider: {
      "@type": "Organization",
      name: "JetNine",
      url: siteUrl,
    },
    areaServed: { "@type": "Place", name: "Worldwide" },
    url: `${siteUrl}${entry.href}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Built from FLEET catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      {/* ─── Hero: category photo, title, lead, six headline specs ─── */}
      <PageHero
        eyebrow={entry.kicker}
        title={entry.title}
        lead={plainWords(entry.lead)}
        imageSrc={entry.imageUrl}
        imagePosition="center"
      >
        <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-6">
          {entry.heroSpecs.map((raw) => {
            const s = plainSpec(raw);
            return (
              <div key={raw.label}>
                <dt className="label-jn">{s.label}</dt>
                <dd className="mt-1 font-serif text-[28px] font-light leading-none">{s.value}</dd>
                <dd className="mt-1 text-[13px] text-steel">{s.sub}</dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <QuoteLink context={`aircraft-${entry.slug}`} category={entry.slug}>
            Request a quote <span className="arrow">→</span>
          </QuoteLink>
          <Link href="/aircraft" className="btn btn-secondary btn-lg">
            All categories
          </Link>
        </div>
      </PageHero>

      {/* ─── Cabin ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Inside the cabin</p>
        <h2 className="title-section max-w-[20ch]">
          {entry.cabin.headline[0]} <br className="max-md:hidden" />
          {entry.cabin.headline[1]}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {entry.cabin.placeholders.map((cap, i) => (
            <FleetImage
              key={cap}
              src={entry.cabin.imageUrls?.[i]}
              alt={`${entry.name} cabin — ${cap.toLowerCase()}`}
              aspect="4/5"
              sizes="(max-width: 768px) 100vw, 33vw"
              className="rounded-card border border-line"
            />
          ))}
        </div>

        <p className="mt-8 max-w-[64ch] text-[17px] leading-[1.6] text-bone-2">
          {plainWords(entry.cabin.caption)}
        </p>
      </section>

      {/* ─── Reach (ultra only) ─── */}
      {entry.reach ? (
        <section className="section-jn container-jn">
          <p className="eyebrow">Reach</p>
          <h2 className="title-section max-w-[20ch]">
            {entry.reach.headline[0]} <br className="max-md:hidden" />
            {entry.reach.headline[1]}
          </h2>
          <p className="lead mt-5 max-w-[58ch]">{plainWords(entry.reach.lead)}</p>

          <div className="card mt-10 overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="table-jn min-w-[560px] [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
                <thead>
                  <tr>
                    <th scope="col">City pair</th>
                    <th scope="col">Distance</th>
                    <th scope="col">Flight time</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.reach.pairs.map((p) => (
                    <tr key={p.pair}>
                      <td className="font-serif text-[20px] leading-[1.2]">{titleCase(p.pair)}</td>
                      <td className="text-bone-2">{plainWords(p.nm)}</td>
                      <td className="text-clearance">{flightTime(p.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── Sample aircraft ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Sample aircraft</p>
        <h2 className="title-section max-w-[22ch]">A few aircraft in the network.</h2>
        <p className="lead mt-5 max-w-[58ch]">
          Representative examples — we source the right aircraft per trip from a network of vetted
          Part 135 operators.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {entry.samples.map((s) => {
            const model = MODELS.find((mm) => mm.sample.name === s.name);
            const body = (
              <>
                <FleetImage
                  src={s.imageUrl}
                  alt={`${s.name} exterior`}
                  aspect="16/10"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 28vw"
                />
                <div className="flex flex-1 flex-col gap-5 p-6">
                  <h3 className="title-card-sm">{s.name}</h3>
                  <dl className="dl-jn border-t border-line pt-5">
                    <dt>Passengers</dt>
                    <dd>{s.pax}</dd>
                    <dt>Range</dt>
                    <dd>{nm(s.rangeNm)}</dd>
                    <dt>Speed</dt>
                    <dd>{kt(s.speedKt)}</dd>
                    <dt>Year</dt>
                    <dd>{s.year}</dd>
                    <dt>Wi-Fi</dt>
                    <dd>{wifiLabel(s.wifi)}</dd>
                  </dl>
                  {model ? (
                    <span className="mt-auto text-[15px] font-medium">
                      Full specs, rates &amp; routes <span className="arrow">→</span>
                    </span>
                  ) : null}
                </div>
              </>
            );
            return model ? (
              <Link
                key={s.name}
                href={`/aircraft/${model.category}/${model.slug}`}
                className="card flex flex-col overflow-hidden"
              >
                {body}
              </Link>
            ) : (
              <div key={s.name} className="card flex flex-col overflow-hidden">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Best for ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Best for</p>
        <h2 className="title-section max-w-[22ch]">The missions {shortName} does best.</h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {entry.bestFor.map((t) => (
            <div key={t.title} className="card card-pad">
              <div className="mb-5 text-clearance">
                <BestForIcon name={t.iconKey} />
              </div>
              <h3 className="title-card-sm">{plainWords(t.title)}</h3>
              <p className="mt-2 max-w-[48ch] text-bone-2">{plainWords(t.body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Step down / step up ─── */}
      <section className="section-jn container-jn">
        <p className="eyebrow">Considering alternatives</p>
        <h2 className="title-section max-w-[24ch]">Compare the categories on either side.</h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[entry.teaser.left, entry.teaser.right].map((t, i) => (
            <Link key={t.href + i} href={t.href} className="card card-pad flex flex-col gap-3">
              <p className="label-jn">{sentence(t.label)}</p>
              <h3 className="title-card">{t.title}</h3>
              <p className="text-bone-2">{plainWords(t.body)}</p>
              <span className="mt-auto pt-2 text-[15px] font-medium">
                {t.cta} <span className="arrow">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Quote handoff (was the inline launcher form) ─── */}
      <section className="section-jn container-jn">
        <div className="card card-pad grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="eyebrow">Start a quote</p>
            <h2 className="title-card">Price a {shortName} mission.</h2>
            <p className="mt-2 max-w-[52ch] text-bone-2">
              Route, date, and passenger count — the quote opens with this category already chosen
              and prices as you type.
            </p>
          </div>
          <QuoteLink context={`aircraft-${entry.slug}`} category={entry.slug}>
            Request a quote <span className="arrow">→</span>
          </QuoteLink>
        </div>
      </section>

      <CtaBand
        title={entry.finalCta.heading}
        body={plainWords(entry.finalCta.body)}
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
