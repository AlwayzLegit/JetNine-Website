import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { CITIES } from "@/lib/cities";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter by City — US Markets",
  description:
    "Charter guides for the markets we fly most: the airports that actually matter in each city, drive times, live from-prices per lane, and the operational notes only a dispatch desk writes down.",
  path: "/private-jet-charter",
});

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

      <PageHero
        eyebrow={`Charter by city · ${CITIES.length} markets`}
        title="The markets, field by field."
        lead="Every city below gets the treatment a dispatcher would give a colleague: which airport actually serves which neighborhood, what the season does to the ramps, live from-prices on the lanes people fly, and the operational quirks worth knowing before wheels-up."
      />

      <ProofStrip />

      <section className="section-jn">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CITIES.map((c) => (
              <Link
                key={c.slug}
                href={`/private-jet-charter/${c.slug}`}
                className="card card-pad group flex h-full flex-col max-md:p-5"
              >
                <span className="label-jn">
                  {c.state} · {c.primary.name} ({c.primary.iata})
                </span>
                <h2 className="title-card mt-3 text-bone transition-colors group-hover:text-clearance">
                  {c.name}
                </h2>
                <p className="mt-3 flex-1 text-[15px] leading-[1.6] text-bone-2">
                  {c.lead.split(". ")[0]}.
                </p>
                <span className="mt-5 text-[15px] font-medium text-bone">
                  Airports, lanes &amp; prices <span className="arrow">→</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            Flying somewhere not listed? The network covers 170+ countries — the{" "}
            <Link href="/quote/mission" className="text-link-strong">
              wizard
            </Link>{" "}
            prices any pair, and specific lanes live on{" "}
            <Link href="/routes" className="text-link-strong">
              routes
            </Link>
            .
          </p>
        </div>
      </section>

      <QuoteLauncher
        context="city-hub"
        heading="Your market, priced live."
        body="Origin, destination, date, and passenger count — the same engine behind every from-price on these pages."
      />

      <CtaBand
        title="Local knowledge, every market."
        body="The desk that wrote these guides answers in under twenty seconds, every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
