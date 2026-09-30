import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { GuideGate } from "@/components/guide-gate";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Pricing Guide (2026)",
  description:
    "The pricing guide written by a desk that publishes its rates: hourly costs by category, a real itemized quote, one-way vs round-trip economics, last-minute reality, and every price driver.",
  path: "/guides",
});

export default function GuidesHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // ItemList of chapters — the hub is a series index, and saying so in
  // schema helps the chapters get treated as one work.
  const seriesJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "The JetNine Charter Pricing Guide",
    itemListElement: GUIDE_CHAPTERS.map((c) => ({
      "@type": "ListItem",
      position: c.chapter,
      name: c.title,
      url: `${siteUrl}${c.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd) }}
      />

      <PageHero
        eyebrow={`The charter pricing guide · ${GUIDE_CHAPTERS.length} chapters`}
        title="Charter pricing, with the prices left in."
        lead={
          <>
            Most charter guides explain everything about cost except the numbers. This one is
            written by the desk that publishes its rate card: real hourly rates, a real itemized
            quote, and the honest levers that move a price — in the order you&rsquo;d ask.
          </>
        }
      >
        <p className="mt-6 text-[14px] text-steel">
          By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly
        </p>
      </PageHero>

      <ProofStrip />

      <section className="section-jn">
        <div className="container-jn">
          <ol className="card divide-y divide-line-faint">
            {GUIDE_CHAPTERS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={c.href}
                  className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-5 px-7 py-6 transition-colors hover:bg-surface-2 md:grid-cols-[72px_minmax(0,1fr)_auto] md:gap-6 max-md:px-5"
                >
                  <span className="font-serif text-[36px] font-light leading-none text-clearance">
                    {String(c.chapter).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="title-card-sm block text-bone transition-colors group-hover:text-clearance">
                      {c.title}
                    </span>
                    <span className="mt-1.5 block max-w-[70ch] text-[15px] leading-[1.6] text-bone-2">
                      {c.description}
                    </span>
                  </span>
                  <span className="text-[15px] font-medium text-bone max-md:col-start-2">
                    Read <span className="arrow">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            Prefer the number to the reading? The{" "}
            <Link href="/cost-calculator" className="text-link-strong">
              cost calculator
            </Link>{" "}
            runs your route against the same rate card in about ninety seconds.
          </p>
        </div>
      </section>

      <GuideGate context="guides-hub" />

      <QuoteLauncher
        context="guides-hub"
        heading="Skip to your number."
        body="Route, date, and passenger count — live indicative pricing from the same engine behind every figure in this guide."
      />

      <CtaBand
        title="Written by the desk that answers."
        body="Questions the guide doesn't cover go straight to a senior dispatcher — average pick-up under twenty seconds, every hour of every day."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: `Call dispatch · ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
