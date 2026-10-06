import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BEST_FOR_ICON, CATEGORY_COPY, MODEL_SOURCE } from "@/components/aircraft/category-copy";
import { ChecklistButton } from "@/components/aircraft/checklist-button";
import { FaqList } from "@/components/aircraft/faq-list";
import { GalleryButton } from "@/components/aircraft/gallery-button";
import { LineIcon, type IconName } from "@/components/aircraft/line-icon";
import { ModelCard, type ModelCardData } from "@/components/aircraft/model-card";
import { flightTime, kt, nm, plainSpec, plainWords, titleCase } from "@/components/aircraft/plain";
import { QuoteLink } from "@/components/aircraft/quote-link";
import { SourceCards } from "@/components/aircraft/source-windows";
import {
  CompareWindowButton,
  CostList,
  FitTiles,
  GlanceBand,
  NeighborCards,
  PageRail,
  RangeSection,
  RelatedRow,
  SectionTabs,
  SplitHero,
  TemplateCta,
  h2Cls,
  neighborsFor,
  scrollM,
} from "@/components/aircraft/template-parts";
import { TripForm } from "@/components/aircraft/trip-form";
import { FLEET, getFleetEntry } from "@/lib/fleet";
import { MODELS } from "@/lib/models";
import { pageMetadata } from "@/lib/page-meta";

type RouteParams = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return FLEET.map((f) => ({ category: f.slug }));
}

// Complete page-specific summaries: never truncate a lead or fabricate a
// character limit. Google decides how much text to show for each query.
const CATEGORY_METADATA: Record<string, { title: string; description: string }> = {
  "turboprop": {
    "title": "Turboprop Charter — Aircraft, Cabins & Range",
    "description": "Compare turboprop charter aircraft for regional flights and smaller airports. Explore passenger capacity, baggage space, range and options for your trip."
  },
  "light": {
    "title": "Light Jet Charter — Aircraft, Cabins & Range",
    "description": "Explore light jet charter for small groups and regional travel. Compare aircraft, cabin layouts, baggage capacity and range before requesting a quote."
  },
  "midsize": {
    "title": "Midsize Jet Charter — Cabins, Range & Options",
    "description": "Compare midsize charter jets for business and leisure travel. Review cabin space, seating, baggage and route suitability to find an aircraft for your trip."
  },
  "supermid": {
    "title": "Super-Midsize Jet Charter — Cabins & Range",
    "description": "Explore super-midsize charter jets for longer journeys. Compare stand-up cabins, baggage space, aircraft range and estimated costs for your itinerary."
  },
  "heavy": {
    "title": "Heavy Jet Charter — Large Cabins & Long-Range Travel",
    "description": "Compare heavy jets for group travel and longer flights. Explore cabin layouts, sleeping arrangements, baggage capacity and aircraft options for your route."
  },
  "ultra": {
    "title": "Ultra-Long-Range Jet Charter — Aircraft & Cabins",
    "description": "Explore ultra-long-range jets for intercontinental travel. Compare cabin zones, sleeping options and aircraft range, then discuss your itinerary with JetNine."
  }
};

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) return {};
  // Note: no `image` override here — Next.js auto-discovers the
  // sibling opengraph-image.tsx, which renders a composed
  // category-specific OG card (photo + headline + spec line) at
  // 1200×630. That beats the raw 4:5 fleet photo for social cropping.
  return pageMetadata({
    title: CATEGORY_METADATA[entry.slug].title,
    description: CATEGORY_METADATA[entry.slug].description,
    path: entry.href,
  });
}

const SPEC_ICON: Record<string, IconName> = {
  Passengers: "people",
  Range: "plane",
  Speed: "bolt",
  Endurance: "clock",
  "Cruise altitude": "runway",
  Baggage: "bag",
};

export default async function AircraftCategoryPage({ params }: RouteParams) {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) notFound();
  const c = CATEGORY_COPY[entry.slug];

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

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

  const models: ModelCardData[] = entry.samples.map((s) => {
    const m = MODELS.find((mm) => mm.sample.name === s.name);
    return {
      ref: m?.manufacturer ?? entry.name,
      name: s.name,
      headline: `Up to ${s.pax} passengers · ${nm(s.rangeNm)} published range · ${kt(s.speedKt)} cruise.`,
      detail: m ? `${plainWords(m.knownFor)} Ask for the exact seating plan and baggage allowance.` : "Ask for the exact seating plan and baggage allowance.",
      image: s.imageUrl,
      href: m ? `/aircraft/${m.category}/${m.slug}` : undefined,
      source: MODEL_SOURCE[s.name] ?? { label: "Ask about this model", href: "/contact" },
      category: entry.slug,
      pax: s.pax,
    };
  });
  const sources = models.map((m) => ({ name: m.name, label: m.source.label, href: m.source.href }));

  const gallery = [
    { src: c.cabinImage, label: "Cabin" },
    ...entry.cabin.placeholders.map((p, i) => ({
      src: entry.cabin.imageUrls?.[i] ?? c.cabinImage,
      label: plainWords(p.charAt(0) + p.slice(1).toLowerCase()),
    })),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Built from FLEET catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />

      <SplitHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Aircraft", href: "/aircraft" }, { label: c.name }]}
        title={entry.title.replace(/\.$/, "")}
        tagline={c.tagline}
        intro={plainWords(entry.lead)}
        image={c.hero}
        actions={
          <>
            <QuoteLink
              context={`aircraft-${entry.slug}`}
              category={entry.slug}
              className="inline-flex h-[42px] items-center gap-[10px] rounded-[2px] bg-clearance px-5 text-[14px] font-bold text-white hover:bg-clearance-hover"
            >
              {c.cta} →
            </QuoteLink>
            <CompareWindowButton slug={entry.slug} label={c.compareLabel} />
          </>
        }
      />

      <GlanceBand
        items={entry.heroSpecs.map((raw) => {
          const s = plainSpec(raw);
          return { icon: SPEC_ICON[s.label] ?? "doc", k: s.value, v: `${s.label} · ${s.sub}` };
        })}
      />

      <div className="container-jn flex flex-wrap items-start gap-7 pt-[18px]">
        <main className="min-w-0 flex-[999_1_520px]">
          <SectionTabs
            tabs={[
              ["Trip fit", "#fit"],
              ["Aircraft", "#aircraft"],
              ["Cabin", "#cabin"],
              ["Range", "#range"],
              ["Pricing", "#pricing"],
            ]}
          />

          <FitTiles
            title={c.fitTitle}
            caveat={c.caveat}
            items={entry.bestFor.map((t) => ({ title: plainWords(t.title), body: plainWords(t.body), icon: BEST_FOR_ICON[t.iconKey] ?? "check" }))}
          />

          <section id="aircraft" className={`pt-[26px] ${scrollM}`}>
            <h2 className="font-serif text-[32px] font-normal leading-[1.1]">{c.modelsTitle}</h2>
            <p className="mt-1 text-[13px] text-steel">
              Representative models to discuss — not live aircraft inventory. We source the right aircraft per trip from a network of
              vetted Part 135 operators.
            </p>
            <div className="mt-[14px] flex flex-col gap-3">
              {models.map((m) => (
                <ModelCard key={m.name} m={m} />
              ))}
            </div>
            <p className="mt-[10px] text-[12px] text-steel">
              Model specifications are a starting point. Your quote should identify the actual aircraft and operator.
            </p>
          </section>
        </main>

        <aside className="flex max-w-full flex-[1_1_280px] flex-col gap-[14px] lg:sticky lg:top-[calc(var(--header-h)+20px)]">
          <TripForm variant="side" title={c.sideTitle} context={`aircraft-${entry.slug}-side`} category={entry.slug} />
          <PageRail
            items={[
              ["Trip fit", "#fit"],
              ["Aircraft", "#aircraft"],
              ["Cabin details", "#cabin"],
              ["Range", "#range"],
              ["Pricing", "#pricing"],
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
              ariaLabel="Open cabin gallery"
              title="A closer look at your cabin."
              sub={`${entry.cabin.headline[0]} ${entry.cabin.headline[1]}`}
              className="relative block aspect-[16/9] w-full overflow-hidden border-0 bg-surface-2 p-0"
            >
              <Image src={c.cabinImage} alt={`${c.name} cabin`} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
              <span className="absolute bottom-[10px] right-[10px] inline-flex h-[30px] items-center bg-[rgba(18,35,46,.85)] px-3 text-[12px] text-white">
                View gallery ↗
              </span>
            </GalleryButton>
            <p className="mt-1.5 text-[12px] text-steel">Illustrative interior. Layouts and equipment vary.</p>
          </div>
          <div>
            <h2 className={h2Cls}>{c.roomTitle}</h2>
            <p className="mt-2 text-[13px] leading-[1.55] text-steel">{plainWords(entry.cabin.caption)}</p>
            <div className="mt-[10px]">
              {c.room.map(([k, v, icon]) => (
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
                sub="Confirm these details for the aircraft offered."
                groups={[{ items: c.checklist }]}
                note="Review current photos and the seating plan."
                cta="Add needs to my request"
                context={`aircraft-${entry.slug}-checklist`}
                category={entry.slug}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Range ─── */}
      <RangeSection title={c.nonstopTitle} sub={c.nonstopSub} tip={c.nonstopTip} category={entry.slug} context={`aircraft-${entry.slug}-route`}>
        {entry.reach ? (
          <div className="mt-6">
            <h3 className="font-serif text-[24px] font-normal leading-[1.15]">
              {entry.reach.headline[0]} {entry.reach.headline[1]}
            </h3>
            <p className="mt-1 max-w-[70ch] text-[13px] text-steel">{plainWords(entry.reach.lead)}</p>
            <div className="mt-3 border border-line bg-white text-[13px]">
              <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr] gap-3 bg-surface-2 px-[14px] py-[9px] text-[12px] font-bold">
                <span>City pair</span>
                <span>Distance</span>
                <span>Flight time</span>
              </div>
              {entry.reach.pairs.map((p) => (
                <div key={p.pair} className="grid grid-cols-[minmax(0,2fr)_1fr_1fr] items-center gap-3 border-t border-line px-[14px] py-[9px]">
                  <span className="font-serif text-[16px]">{titleCase(p.pair)}</span>
                  <span className="text-steel">{plainWords(p.nm)}</span>
                  <span className="text-steel">{flightTime(p.time)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </RangeSection>

      {c.arrival ? (
        <section id="arrival" className={`container-jn pt-[26px] ${scrollM}`}>
          <h2 className={h2Cls}>Plan the arrival as carefully as the flight.</h2>
          <div className="mt-3 grid items-center gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {c.arrival.map(([title, body, icon], i) => (
              <div key={title} className="grid grid-cols-[28px_26px_minmax(0,1fr)] items-start gap-[10px] border-r border-line pr-4">
                <span className="font-serif text-[22px] leading-none text-gold">0{i + 1}</span>
                <LineIcon name={icon} size={24} />
                <span>
                  <b className="block text-[14px]">{title}</b>
                  <span className="text-[12px] text-steel">{body}</span>
                </span>
              </div>
            ))}
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href="/guides" className="text-link whitespace-nowrap font-bold">
                International charter guide →
              </Link>
              <a href="https://travel.state.gov/content/travel/en/international-travel.html" target="_blank" rel="noopener noreferrer" className="text-link whitespace-nowrap font-bold">
                U.S. traveler guidance ↗
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── Neighbours + cost ─── */}
      <section id="pricing" className={`container-jn grid items-start gap-x-10 gap-y-8 pt-[26px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] ${scrollM}`}>
        <div>
          <h2 className="font-serif text-[28px] font-normal leading-[1.1]">Compare the neighboring categories.</h2>
          <NeighborCards items={neighborsFor(entry.slug)} />
        </div>
        <CostList title={`What does ${c.name.toLowerCase()} charter cost?`} items={c.cost} />
      </section>

      {c.lessRange ? (
        <div className="container-jn mt-[22px]">
          <div className="flex flex-wrap items-center gap-5 border border-line bg-surface px-[18px] py-[14px]">
            <span className="font-serif text-[20px]">Need less range?</span>
            <span className="flex-1 text-[13px] text-steel">{c.lessRange}</span>
            <Link href="/aircraft/heavy" className="text-link whitespace-nowrap text-[13px] font-bold">
              Explore heavy jets →
            </Link>
            <Link href="/aircraft" className="text-link whitespace-nowrap text-[13px] font-bold">
              View all aircraft →
            </Link>
          </div>
        </div>
      ) : null}

      <SourceCards models={sources} />

      <section id="faqs" className={`container-jn pt-[22px] ${scrollM}`}>
        <h2 className="font-serif text-[24px] font-normal leading-[1.1]">Good questions before you book.</h2>
        <FaqList items={c.faq.map(([q, a]) => ({ q, a }))} />
        <RelatedRow />
      </section>

      <TemplateCta title={c.ctaTitle} image={c.ctaImage} cta={c.cta} />
    </>
  );
}
