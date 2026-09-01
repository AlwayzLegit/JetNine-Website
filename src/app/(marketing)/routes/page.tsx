import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { ROUTES } from "@/lib/routes";
import { distanceNm } from "@/lib/airports";
import { formatNm } from "@/lib/fleet";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Routes — Cost by City Pair",
  description:
    "Charter costs and flight times for the lanes we fly most — LA to Vegas, New York to Miami, transcons, and international — each priced by the live engine, whole aircraft, all-in.",
  path: "/routes",
});

export default function RoutesHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // Group lanes by origin city for scannable navigation.
  const groups = new Map<string, typeof ROUTES>();
  for (const r of ROUTES) {
    const key = r.from.city;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "JetNine charter routes",
    itemListElement: ROUTES.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${r.from.city} to ${r.to.city}`,
      url: `${siteUrl}/routes/${r.slug}`,
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
            Routes · {ROUTES.length} lanes priced
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
            The lanes, with numbers on them.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            Every route below carries live from-prices for the whole aircraft, block times per
            category, and the airports a charter actually uses — not the ones the airlines do. A
            lane you fly isn&rsquo;t listed? The wizard prices any pair in about ninety seconds.
          </Reveal>
        </div>
      </header>

      <ProofStrip />

      <section className="py-24 max-md:py-16">
        <div className="container-jn flex flex-col gap-16">
          {[...groups.entries()].map(([city, routes]) => (
            <div key={city}>
              <Reveal>
                <p className="caption mb-8">— From {city}</p>
              </Reveal>
              <ul className="divide-y divide-ink-3 border-y border-ink-3">
                {routes.map((r, i) => (
                  <Reveal key={r.slug} as="li" stagger={(i % 3) as 0 | 1 | 2}>
                    <Link
                      href={`/routes/${r.slug}`}
                      className="group grid grid-cols-1 gap-4 py-7 transition-colors hover:bg-ink-2 sm:grid-cols-[1fr_auto_auto] sm:items-center lg:px-6"
                    >
                      <span>
                        <span className="block font-serif text-[21px] font-normal leading-[1.2] tracking-tight text-bone group-hover:text-clearance">
                          {r.from.city} to {r.to.city}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                          {r.from.icao} → {r.to.icao}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] tracking-[0.04em] text-bone-2">
                        {formatNm(distanceNm(r.from, r.to))}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                        Cost &amp; time <span className="arrow">→</span>
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <QuoteLauncher
        context="routes-hub"
        heading="Your lane, priced live."
        body="Any pair, any date — the wizard prices it with the same engine behind every number on this page."
      />

      <ClosingCTA
        heading="Or name the lane out loud."
        body="Dispatch quotes any route in the world within 30 minutes during operating hours — and picks up in under twenty seconds."
      />
    </>
  );
}
