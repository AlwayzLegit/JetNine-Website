import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { EdgeHero } from "@/components/company/edge-hero";
import { NextReads, NextStep, TripBrief } from "@/components/charter/sections";
import { CITIES } from "@/lib/cities";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter by City — US Markets",
  description:
    "Charter guides for the markets we fly most: the airports that actually matter in each city, drive times, live from-prices per lane, and the operational notes only a dispatch desk writes down.",
  path: "/private-jet-charter",
});

// Light - Private charter, plus the city directory the hub exists for.
export default function CityHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "JetNine charter markets",
    itemListElement: CITIES.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Private jet charter ${c.name}`,
      url: `${siteUrl}/private-jet-charter/${c.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />

      <EdgeHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Charter" }]}
        title={<span className="[text-wrap:balance]">Private charter, from brief to departure.</span>}
        body="Build the flight around your requirements. Start with the itinerary, then compare suitable aircraft and a complete proposal."
        actions={
          <>
            <Link href="/quote/mission" className="btn h-[42px] border-gold bg-gold !text-[14px] !font-bold text-white hover:bg-[#6b4c2b]">
              Request trip options →
            </Link>
            <a href="#brief" className="btn h-[42px] !border-bone bg-transparent !text-[14px] !font-bold text-bone hover:bg-surface-2">
              Prepare a trip brief
            </a>
          </>
        }
        imageSrc="/images/light/boarding-golden-hour.webp"
        imageAlt="Passengers boarding a private jet at golden hour"
        caption={null}
      />

      <TripBrief />

      {/* City directory */}
      <section id="cities" className="container-jn scroll-mt-[var(--header-h)] pt-14 max-md:pt-10">
        <p className="eyebrow !mb-0 !font-normal !tracking-[0.14em]">Charter by city · {CITIES.length} markets</p>
        <h2 className="mt-[10px] font-serif text-[34px] leading-[1.1]">The markets, field by field.</h2>
        <p className="mt-3 max-w-[68ch] text-steel">
          Which airport actually serves which neighborhood, what the season does to the ramps, live from-prices on the lanes people fly,
          and the operational quirks worth knowing before departure.
        </p>
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/private-jet-charter/${c.slug}`}
              className="group flex flex-col border border-line-faint bg-white p-5 transition-colors hover:border-gold"
            >
              <span className="text-[12px] uppercase tracking-[0.14em] text-gold">
                {c.state} · {c.primary.iata}
              </span>
              <span className="mt-2 font-serif text-[22px] leading-[1.2]">{c.name}</span>
              <span className="mt-2 flex-1 text-[14px] leading-[1.55] text-steel">{c.lead.split(". ")[0]}.</span>
              <span className="mt-4 text-[14px] font-bold group-hover:text-gold">Airports, lanes &amp; prices →</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 max-w-[68ch] text-[15px] text-steel">
          Flying somewhere not listed? The network covers 170+ countries — the{" "}
          <Link href="/quote/mission" className="text-link text-bone">
            quote request
          </Link>{" "}
          prices any pair, and specific lanes live on{" "}
          <Link href="/routes" className="text-link text-bone">
            routes
          </Link>
          .
        </p>
      </section>

      <NextStep />
      <NextReads />

      <CtaBand
        className="!mt-0"
        title="Local knowledge, every market."
        body="The desk that wrote these guides answers every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
