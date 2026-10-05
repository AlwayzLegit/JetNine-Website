import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { DeskNotes } from "@/components/desk-notes";
import { CATEGORY_COPY, CATEGORY_IMAGE, MODEL_SOURCE } from "@/components/aircraft/category-copy";
import { ChecklistButton } from "@/components/aircraft/checklist-button";
import { FaqList } from "@/components/aircraft/faq-list";
import { GalleryButton } from "@/components/aircraft/gallery-button";
import { LineIcon, type IconName } from "@/components/aircraft/line-icon";
import { kt, nm, perHour, plainWords, wifiLabel } from "@/components/aircraft/plain";
import { QuoteLink } from "@/components/aircraft/quote-link";
import { SourceCards } from "@/components/aircraft/source-windows";
import {
  CostList,
  GlanceBand,
  NeighborCards,
  PageRail,
  RangeSection,
  RelatedRow,
  SectionTabs,
  SplitHero,
  h2Cls,
  scrollM,
} from "@/components/aircraft/template-parts";
import { TripForm } from "@/components/aircraft/trip-form";
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

  const c = CATEGORY_COPY[entry.slug];
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

  const specs: [string, string, IconName][] = [
    ["Passengers", `${m.sample.pax} typical`, "people"],
    ["Range", `${nm(m.sample.rangeNm)} · with reserves`, "plane"],
    ["Cruise", kt(m.sample.speedKt), "bolt"],
    ["Ceiling", `${m.ceilingFt.toLocaleString()} ft`, "runway"],
    ["Cabin height", m.cabin.heightFt, "person"],
    ["Cabin width", m.cabin.widthFt, "seat"],
    ["Cabin length", m.cabin.lengthFt, "seat"],
    ["Baggage", `~${m.baggageCuFt} cu ft`, "bag"],
    ["Wi-Fi", wifiLabel(m.sample.wifi), "globe"],
  ];

  const source = MODEL_SOURCE[m.name] ?? { label: "Ask about this model", href: `mailto:${SITE.email}` };
  const gallery = [
    ...(m.sample.imageUrl ? [{ src: m.sample.imageUrl, label: "Exterior" }] : []),
    { src: c.cabinImage, label: "Cabin" },
    ...entry.cabin.placeholders.map((p, i) => ({
      src: entry.cabin.imageUrls?.[i] ?? c.cabinImage,
      label: plainWords(p.charAt(0) + p.slice(1).toLowerCase()),
    })),
  ];

  const stepUp = getFleetEntry(entry.teaser.right.href.split("/").pop() ?? "");
  const alternatives = [
    ...siblings.map((s) => ({
      slug: entry.slug,
      name: s.shortName,
      body: plainWords(s.knownFor),
      href: `/aircraft/${s.category}/${s.slug}`,
      image: s.sample.imageUrl ?? CATEGORY_IMAGE[entry.slug],
      cta: "Specs & rates",
    })),
    {
      slug: entry.slug,
      name: entry.teaser.right.title,
      body: plainWords(entry.teaser.right.body),
      href: entry.teaser.right.href,
      image: stepUp ? CATEGORY_IMAGE[stepUp.slug] : CATEGORY_IMAGE[entry.slug],
      cta: entry.teaser.right.cta,
    },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <SplitHero
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Aircraft", href: "/aircraft" },
          { label: c.name, href: entry.href },
          { label: m.shortName },
        ]}
        eyebrow={`${entry.name} · ${m.manufacturer}`}
        title={`${m.shortName} charter`}
        tagline={c.tagline}
        intro={plainWords(m.lead)}
        image={m.sample.imageUrl}
        imageAlt={`${m.name} exterior`}
        actions={
          <>
            <QuoteLink
              context={`model-${m.slug}`}
              category={m.category}
              className="inline-flex h-[42px] items-center gap-[10px] rounded-[2px] bg-clearance px-5 text-[14px] font-bold text-white hover:bg-clearance-hover"
            >
              Request a quote →
            </QuoteLink>
            <Link
              href={entry.href}
              className="inline-flex h-[42px] items-center gap-[10px] rounded-[2px] border border-bone px-5 text-[14px] text-bone hover:bg-surface-2"
            >
              All {entry.name.toLowerCase()} aircraft →
            </Link>
          </>
        }
      />

      <GlanceBand
        items={[
          { icon: "people", k: `${m.sample.pax} passengers`, v: "Typical layout" },
          { icon: "plane", k: nm(m.sample.rangeNm), v: "Range · with reserves" },
          { icon: "bolt", k: kt(m.sample.speedKt), v: "Cruise speed" },
          { icon: "person", k: m.cabin.heightFt, v: "Cabin height" },
          ...(rate ? [{ icon: "coins" as const, k: perHour(rate.market), v: `${entry.name} market rate · hourly` }] : []),
        ]}
      />

      <div className="container-jn flex flex-wrap items-start gap-7 pt-[18px]">
        <main className="min-w-0 flex-[999_1_520px]">
          <SectionTabs
            tabs={[
              ["Specifications", "#specs"],
              ...(routes.length ? ([["Routes", "#routes"]] as [string, string][]) : []),
              ["Cabin", "#cabin"],
              ["Range", "#range"],
              ["Pricing", "#pricing"],
            ]}
          />

          <section id="specs" className={`pt-[22px] ${scrollM}`}>
            <h2 className="font-serif text-[32px] font-normal leading-[1.1]">The {m.shortName}, by the numbers.</h2>
            <p className="mt-1 text-[13px] text-steel">{plainWords(m.knownFor)}</p>
            <dl className="mt-3 grid gap-x-8 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
              {specs.map(([k, v, icon]) => (
                <div key={k} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-[10px] text-[13px]">
                  <LineIcon name={icon} size={22} />
                  <dt className="font-bold">{k}</dt>
                  <dd className="text-right text-steel">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[12px] leading-[1.5] text-steel">
              Figures are the typical published layout; exact layout and performance vary by aircraft and are confirmed with your quote.
            </p>
            <a
              href={source.href}
              {...(source.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="mt-2 inline-block whitespace-nowrap border-b border-bone pb-px text-[13px] hover:text-gold"
            >
              {source.label} ↗
            </a>
          </section>

          {routes.length > 0 ? (
            <section id="routes" className={`pt-[26px] ${scrollM}`}>
              <h2 className="font-serif text-[32px] font-normal leading-[1.1]">Popular {m.shortName} routes.</h2>
              <p className="mt-1 max-w-[70ch] text-[13px] text-steel">
                Indicative all-in ranges for the whole aircraft, worked out by the same engine behind our quote form. Tap through and the
                quote opens with the route and category loaded.
              </p>
              <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
                {routes.map((r) => (
                  <div key={`${r.from}-${r.to}`} className="flex flex-col border border-line bg-surface p-[14px]">
                    <span className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">
                      {r.from} → {r.to}
                    </span>
                    <h3 className="mt-1 font-serif text-[22px] font-normal leading-[1.15]">{r.label}</h3>
                    <p className="mt-0.5 text-[12px] text-steel">
                      {r.fromCity} ({r.from}) → {r.toCity} ({r.to})
                    </p>
                    <dl className="mt-3 text-[13px]">
                      <div className="flex justify-between gap-3 border-t border-line py-1.5">
                        <dt className="text-steel">Distance</dt>
                        <dd>{nm(r.nm)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-line py-1.5">
                        <dt className="text-steel">Flight time</dt>
                        <dd>{r.hours}</dd>
                      </div>
                      <div className="flex flex-col border-t border-line pt-1.5">
                        <dt className="text-steel">Indicative, all-in</dt>
                        <dd className="font-serif text-[20px] leading-tight">{r.range}</dd>
                      </div>
                    </dl>
                    <QuoteLink
                      context={`route-card:${r.from}-${r.to}`}
                      category={m.category}
                      from={r.from}
                      to={r.to}
                      pax={Math.min(m.sample.pax, 8)}
                      className="mt-3 self-start border-b border-bone pb-px text-[13px] hover:text-gold"
                    >
                      Get exact quote →
                    </QuoteLink>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="flex max-w-full flex-[1_1_280px] flex-col gap-[14px] lg:sticky lg:top-[calc(var(--header-h)+20px)]">
          {rate ? (
            <div className="border border-line bg-surface px-[18px] py-4">
              <p className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">{entry.name} category · hourly</p>
              <p className="mt-2 font-serif text-[32px] leading-none">{perHour(rate.market)}</p>
              <p className="mt-1 text-[12px] text-steel">Market rate · all-in, locked at acceptance</p>
              <div className="mt-3 border-t border-line pt-3">
                <p className="font-serif text-[22px] leading-none">{perHour(rate.locked)}</p>
                <p className="mt-1 text-[12px] text-steel">JetNine Card · locked for 24 months</p>
              </div>
            </div>
          ) : null}
          <TripForm variant="side" title={`Price a ${m.shortName} trip`} context={`model-${m.slug}-side`} category={m.category} />
          <PageRail
            items={[
              ["Specifications", "#specs"],
              ...(routes.length ? ([["Popular routes", "#routes"]] as [string, string][]) : []),
              ["Cabin details", "#cabin"],
              ["Range", "#range"],
              ["Pricing & alternatives", "#pricing"],
              ["Original sources", "#sources"],
            ]}
          />
        </aside>
      </div>

      {/* ─── Cabin ─── */}
      <section id="cabin" className={`mt-6 border-y border-line bg-surface ${scrollM}`}>
        <div className="container-jn grid items-start gap-7 pb-[22px] pt-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <div>
            <GalleryButton
              images={gallery}
              start={m.sample.imageUrl ? 1 : 0}
              ariaLabel="Open cabin gallery"
              title={`A closer look at the ${m.shortName}.`}
              sub={`Representative ${c.name.toLowerCase()} imagery. Request photos of the quoted aircraft.`}
              className="relative block aspect-[16/9] w-full overflow-hidden border-0 bg-surface-2 p-0"
            >
              <Image src={c.cabinImage} alt={`${c.name} cabin`} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
              <span className="absolute bottom-[10px] right-[10px] inline-flex h-[30px] items-center bg-[rgba(18,35,46,.85)] px-3 text-[12px] text-white">
                View gallery ↗
              </span>
            </GalleryButton>
            <p className="mt-1.5 text-[12px] text-steel">Illustrative interior. Layouts and equipment vary by aircraft.</p>
          </div>
          <div>
            <h2 className={h2Cls}>Inside the {m.shortName}.</h2>
            <div className="mt-[10px]">
              {(
                [
                  ["Headroom", `${m.cabin.heightFt} published cabin height.`, "person"],
                  ["Floor & seating", `${m.cabin.lengthFt} long, ${m.cabin.widthFt} wide; ${m.sample.pax} seats typical.`, "seat"],
                  ["Baggage", `About ${m.baggageCuFt} cu ft. Confirm sizes, weight and loading access.`, "bag"],
                  ["Wi-Fi", `${wifiLabel(m.sample.wifi)} on the typical aircraft. Confirm coverage for your route.`, "cup"],
                ] as [string, string, IconName][]
              ).map(([k, v, icon]) => (
                <div key={k} className="grid grid-cols-[28px_minmax(90px,120px)_minmax(0,1fr)] items-center gap-3 border-t border-line py-[10px] text-[13px] max-[420px]:grid-cols-[28px_minmax(0,1fr)]">
                  <LineIcon name={icon} size={22} />
                  <b>{k}</b>
                  <span className="text-steel max-[420px]:col-start-2">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <ChecklistButton
                label="Open cabin checklist →"
                className="h-10 rounded-[2px] border-0 bg-gold px-4 text-[13px] font-bold text-white hover:opacity-90"
                sub={`Confirm these details for the ${m.shortName} offered.`}
                groups={[{ items: c.checklist }]}
                note="Review current photos and the seating plan."
                cta="Add needs to my request"
                context={`model-${m.slug}-checklist`}
                category={m.category}
              />
            </div>
          </div>
        </div>
      </section>

      <RangeSection
        title={`Can the ${m.shortName} fly your route nonstop?`}
        sub={`About ${nm(m.sample.rangeNm)} with reserves at ${kt(m.sample.speedKt)} cruise. Real-world range depends on load, winds and routing.`}
        tip={c.nonstopTip}
        category={m.category}
        context={`model-${m.slug}-route`}
      />

      {/* ─── Alternatives + cost ─── */}
      <section id="pricing" className={`container-jn grid items-start gap-x-10 gap-y-8 pt-[26px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] ${scrollM}`}>
        <div>
          <h2 className="font-serif text-[28px] font-normal leading-[1.1]">The alternatives worth pricing.</h2>
          <NeighborCards items={alternatives} />
        </div>
        <CostList title={`What does ${m.shortName} charter cost?`} items={c.cost} />
      </section>

      <DeskNotes terms={[m.shortName, m.manufacturer, entry.name, "aircraft", "range"]} heading={`From the desk · ${entry.name}`} />

      <SourceCards models={[{ name: m.name, label: source.label, href: source.href }]} />

      <section id="faqs" className={`container-jn pt-[22px] ${scrollM}`}>
        <h2 className="font-serif text-[24px] font-normal leading-[1.1]">Asked about the {m.shortName}.</h2>
        <FaqList items={FAQ.map((f) => ({ q: f.q, a: plainWords(f.a) }))} />
        <RelatedRow />
      </section>

      <CtaBand
        className="!mt-[22px]"
        imageSrc={c.ctaImage}
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
