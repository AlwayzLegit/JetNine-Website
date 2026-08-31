import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { ProofStrip } from "@/components/proof-strip";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";

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

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-20 max-md:pt-[140px] max-md:pb-14">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            The charter pricing guide · {GUIDE_CHAPTERS.length} chapters
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
            Charter pricing, with the prices left in.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            Most charter guides explain everything about cost except the numbers. This one is
            written by the desk that publishes its rate card: real hourly rates, a real itemized
            quote, and the honest levers that move a price — in the order you&rsquo;d ask.
          </Reveal>
          <Reveal stagger={3} className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
            — By the JetNine dispatch desk · Updated {RATES_UPDATED} · Rates reviewed quarterly
          </Reveal>
        </div>
      </header>

      <ProofStrip />

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {GUIDE_CHAPTERS.map((c, i) => (
              <Reveal key={c.slug} as="li" stagger={(i % 3) as 0 | 1 | 2}>
                <Link
                  href={c.href}
                  className="group grid grid-cols-1 gap-6 py-10 transition-colors hover:bg-ink-2 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-6"
                >
                  <span className="font-mono text-[36px] font-light leading-none text-clearance">
                    {String(c.chapter).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone group-hover:text-clearance">
                      {c.title}
                    </span>
                    <span className="mt-2 block max-w-[70ch] text-[14px] leading-[1.6] text-bone-2">
                      {c.description}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 group-hover:text-clearance">
                    Read <span className="arrow">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
          <p className="mt-10 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            Prefer the number to the reading? The{" "}
            <Link href="/cost-calculator" className="text-clearance">
              cost calculator
            </Link>{" "}
            runs your route against the same rate card in about ninety seconds.
          </p>
        </div>
      </section>

      <QuoteLauncher
        context="guides-hub"
        heading="Skip to your number."
        body="Route, date, and passenger count — live indicative pricing from the same engine behind every figure in this guide."
      />

      <ClosingCTA
        heading="Written by the desk that answers."
        body="Questions the guide doesn't cover go straight to a senior dispatcher — average pick-up under twenty seconds, every hour of every day."
      />
    </>
  );
}
