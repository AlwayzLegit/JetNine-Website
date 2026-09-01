import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { CITIES } from "@/lib/cities";

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

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-20 max-md:pt-[140px] max-md:pb-14">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Charter by city · {CITIES.length} markets
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
            The markets, field by field.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            Every city below gets the treatment a dispatcher would give a colleague: which airport
            actually serves which neighborhood, what the season does to the ramps, live from-prices
            on the lanes people fly, and the operational quirks worth knowing before wheels-up.
          </Reveal>
        </div>
      </header>

      <ProofStrip />

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CITIES.map((c, i) => (
              <Reveal key={c.slug} stagger={(i % 3) as 0 | 1 | 2}>
                <Link
                  href={`/private-jet-charter/${c.slug}`}
                  className="group flex h-full flex-col rounded-[4px] border border-ink-3 bg-ink-2 p-8 transition-colors hover:border-[rgba(232,226,210,0.3)]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    {c.state} · {c.primary.icao}
                  </span>
                  <h2 className="mt-3 font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone group-hover:text-clearance">
                    {c.name}
                  </h2>
                  <p className="mt-3 flex-1 text-[14px] leading-[1.6] text-bone-2">
                    {c.lead.split(". ")[0]}.
                  </p>
                  <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    Airports, lanes &amp; prices <span className="arrow">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            Flying somewhere not listed? The network covers 170+ countries — the{" "}
            <Link href="/quote/mission" className="text-clearance">
              wizard
            </Link>{" "}
            prices any pair, and specific lanes live on{" "}
            <Link href="/routes" className="text-clearance">
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

      <ClosingCTA
        heading="Local knowledge, every market."
        body="The desk that wrote these guides answers in under twenty seconds, every hour of every day."
      />
    </>
  );
}
