import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { ROUTES } from "@/lib/routes";
import { distanceNm } from "@/lib/airports";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Routes — Cost by City Pair",
  description:
    "Charter costs and flight times for the lanes we fly most — LA to Vegas, New York to Miami, coast to coast, international — priced live, whole aircraft, all-in.",
  path: "/routes",
});

const nmFormat = new Intl.NumberFormat("en-US");
const formatNm = (n: number) => `${nmFormat.format(n)} nm`;

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

      <PageHero
        eyebrow={`Routes · ${ROUTES.length} lanes priced`}
        title="The lanes, with numbers on them."
        lead={
          <>
            Every route below carries live from-prices for the whole aircraft, flight times per
            category, and the airports a charter actually uses — not the ones the airlines do. A
            lane you fly isn&rsquo;t listed? The wizard prices any pair in about ninety seconds.
          </>
        }
      />

      <ProofStrip />

      <section className="section-jn">
        <div className="container-jn flex flex-col gap-14">
          {[...groups.entries()].map(([city, routes]) => (
            <div key={city}>
              <h2 className="title-section mb-6">From {city}</h2>
              <ul className="card divide-y divide-line-faint">
                {routes.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/routes/${r.slug}`}
                      className="group grid grid-cols-1 gap-3 px-7 py-6 transition-colors hover:bg-surface-2 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6 max-md:px-5"
                    >
                      <span>
                        <span className="block font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone transition-colors group-hover:text-clearance">
                          {r.from.city} to {r.to.city}
                        </span>
                        <span className="mt-1 block text-[14px] text-steel">
                          {r.from.name} ({r.from.iata}) → {r.to.name} ({r.to.iata})
                        </span>
                      </span>
                      <span className="text-[15px] text-bone-2">{formatNm(distanceNm(r.from, r.to))}</span>
                      <span className="text-[15px] font-medium text-bone">
                        Cost &amp; time <span className="arrow">→</span>
                      </span>
                    </Link>
                  </li>
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

      <CtaBand
        title="Or name the lane out loud."
        body="Dispatch quotes any route in the world within 30 minutes during operating hours — and picks up in under twenty seconds."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
