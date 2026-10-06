import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { QuoteLauncher } from "@/components/quote-launcher";
import { GuideGate } from "@/components/guide-gate";
import { WindowButton } from "@/components/light/window";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { GUIDE_LIBRARY } from "@/lib/guides-short";
import { GIcon, type GuideIconName } from "@/components/guide-short/icons";
import { GuideLibrary, HubFaq, PreBookingButton } from "@/components/guide-short/library";
import { FaaGuidance, NbaaChecklist } from "@/components/guide-short/hub-windows";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Guides — Costs, Booking & Travel",
  description:
    "Explore private jet charter guides covering costs, aircraft selection, booking, safety and travel planning. Prepare your trip and compare quotes with confidence.",
  path: "/guides",
});

// "Understand the price, chapter by chapter" — the prototype's five
// chapter lines, driven by the real pricing-guide registry.
const CHAPTER_LINES: Record<string, [string, string]> = {
  "private-jet-charter-cost": ["Total trip pricing", "See how the main cost components fit together."],
  "private-jet-cost-per-hour": ["Hourly rates by aircraft category", "Learn why an hourly rate is only a starting point."],
  "one-way-vs-round-trip": ["One-way or round trip?", "Understand positioning and itinerary economics."],
  "last-minute-private-jet": ["Last-minute charter costs", "See how timing and availability affect options."],
  "what-affects-charter-price": ["What changes the final price?", "Check taxes, airport fees and requested extras."],
};

const PREPARED = [
  { title: "Choose the right aircraft", body: "Compare cabin, baggage and route needs.", link: "Explore aircraft", href: "/aircraft", img: "/images/fleet/supermid.webp" },
  { title: "Compare charter quotes", body: "Check the carrier, total price and terms.", link: "Read the quote guide", href: "/guides/how-to-compare-private-jet-quotes", img: "/images/hero/how-it-works.webp" },
  { title: "International private jet travel", body: "Plan documents and destination requirements.", link: "Read travel guide", href: "/guides/international-private-jet-travel", img: "/images/hero/runway-night.webp" },
  { title: "Flying with pets", body: "Plan cabin needs and destination paperwork.", link: "Read pet travel guide", href: "/guides/private-jet-travel-with-pets", img: "/images/fleet/light.webp" },
];

const CHECKLIST: [string, string, GuideIconName][] = [
  ["Trip details", "Dates, route, passengers and cabin needs.", "clock"],
  ["Aircraft & operator", "Right aircraft, operator and certifications.", "plane"],
  ["Total price & extras", "Confirm what’s included and any additional costs.", "doc"],
  ["Changes & cancellation", "Review terms and flexibility options.", "gear"],
];

const FAQ: [string, string][] = [
  ["Which guide should I read first?", "Start with the beginner’s guide, then explore pricing and aircraft options for your trip."],
  ["Is a calculator estimate a confirmed quote?", "No. An estimate frames a budget. A written quote names the aircraft, operator, total price and terms."],
  ["Where can I check official travel requirements?", "Use the U.S. Department of State for destination entry rules and USDA APHIS for pet travel. Links are in the sources section."],
];

export default function GuidesHubPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // ItemList of chapters — the pricing guide is a series index, and saying
  // so in schema helps the chapters get treated as one work.
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
  // The whole library, as a collection page.
  const libraryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Private Jet Charter Guides",
    url: `${siteUrl}/guides`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: GUIDE_LIBRARY.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: `${siteUrl}${g.href}`,
      })),
    },
  };

  const chapters = GUIDE_CHAPTERS.map((c) => ({
    n: String(c.chapter).padStart(2, "0"),
    title: CHAPTER_LINES[c.slug]?.[0] ?? c.navTitle,
    body: CHAPTER_LINES[c.slug]?.[1] ?? c.description,
    href: c.href,
  }));

  const sourceBtn = "border-0 bg-transparent p-0 text-left text-[13px] font-bold text-bone underline decoration-line underline-offset-4";

  return (
    <div className="bg-ink text-bone">
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(libraryJsonLd) }} />

      <GuideLibrary guides={GUIDE_LIBRARY} chapters={chapters} />

      {/* Choose well. Arrive prepared. */}
      <section className="container-jn pt-[26px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">Choose well. Arrive prepared.</h2>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[14px]">
          {PREPARED.map((p) => (
            <div key={p.title} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-center gap-4 border border-line bg-surface p-3">
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                <Image src={p.img} alt="" fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
              </div>
              <div>
                <b className="block text-[15px]">{p.title}</b>
                <span className="mb-2 mt-1 block text-[13px] text-steel">{p.body}</span>
                <Link href={p.href} className="text-[13px] font-bold text-gold">
                  {p.link} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Go straight to the source */}
      <section className="container-jn pt-[26px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">Go straight to the source.</h2>
        <p className="mt-1 text-[13px] text-steel">Independent guidance for the decisions that matter.</p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <GIcon name="shield" size={26} />
            <div>
              <b className="block text-[14px]">FAA</b>
              <span className="mb-2 mt-[2px] block text-[12px] text-steel">Verify the operating carrier and aircraft charter authorization.</span>
              <WindowButton label="Charter guidance ↗" className={sourceBtn} title="Verify the operating carrier" sub="The Federal Aviation Administration (FAA) provides guidance to help you verify the operating carrier for a charter flight." variant="drawer">
                <FaaGuidance />
              </WindowButton>
            </div>
          </div>
          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <GIcon name="doc" size={26} />
            <div>
              <b className="block text-[14px]">NBAA</b>
              <span className="mb-2 mt-[2px] block text-[12px] text-steel">Compare total pricing, extra charges and cancellation terms.</span>
              <WindowButton label="Proposal checklist ↗" className={sourceBtn} title="Compare proposals with confidence" sub="Use this checklist to review quotes from different providers and understand what’s included.">
                <NbaaChecklist />
              </WindowButton>
            </div>
          </div>
          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <GIcon name="globe" size={26} />
            <div>
              <b className="block text-[14px]">U.S. Department of State</b>
              <span className="mb-2 mt-[2px] block text-[12px] text-steel">Check destination entry requirements and travel advisories for U.S. travelers.</span>
              <a href="https://travel.state.gov/en/international-travel/planning/checklist.html" target="_blank" rel="noopener noreferrer" className={sourceBtn}>
                Destination information ↗
              </a>
            </div>
          </div>
          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <GIcon name="paw" size={26} />
            <div>
              <b className="block text-[14px]">USDA APHIS</b>
              <span className="mb-2 mt-[2px] block text-[12px] text-steel">Check pet export requirements and plan with an accredited veterinarian.</span>
              <a href="https://www.aphis.usda.gov/pet-travel/pet-travel-process-overview" target="_blank" rel="noopener noreferrer" className={sourceBtn}>
                Pet travel process ↗
              </a>
            </div>
          </div>
        </div>
        <p className="mt-[6px] text-right text-[12px] text-steel">Independent resources. No endorsement of JetNine implied.</p>
      </section>

      {/* Pre-booking checklist band */}
      <section className="container-jn mt-[22px]">
        <div className="flex flex-wrap items-center gap-5 border border-line bg-surface px-5 py-4">
          <div className="min-w-0 max-w-full flex-[1_1_230px]">
            <h2 className="font-serif text-[24px] leading-[1.1]">Your pre-booking checklist.</h2>
            <p className="mt-1 text-[13px] text-steel">Review these key areas before requesting a quote.</p>
          </div>
          <div className="grid min-w-0 flex-[999_1_240px] grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2">
            {CHECKLIST.map(([t, b, ic]) => (
              <div key={t} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 border border-line bg-ink p-[10px]">
                <GIcon name={ic} size={20} />
                <span>
                  <b className="block text-[12px]">{t}</b>
                  <span className="text-[12px] text-steel">{b}</span>
                </span>
              </div>
            ))}
          </div>
          <PreBookingButton
            label="Open checklist →"
            className="h-10 max-w-full flex-none whitespace-nowrap rounded-control border-0 bg-gold px-4 text-[13px] font-bold text-white hover:opacity-90"
          />
        </div>
      </section>

      {/* Quick answers */}
      <section className="container-jn pt-[22px]">
        <h2 className="font-serif text-[26px] leading-[1.1]">Quick answers before you start.</h2>
        <HubFaq items={FAQ} />
      </section>

      {/* Pricing-guide PDF lead capture (kept from the previous hub). */}
      <GuideGate context="guides-hub" />

      <QuoteLauncher
        context="guides-hub"
        heading="Skip to your number."
        body="Route, date, and passenger count — live indicative pricing from the same engine behind every figure in this guide."
      />

      <CtaBand
        title="Have the questions. Now plan the flight."
        body="Expert guidance for your next trip."
        imageSrc="/images/light/jet-midsize.webp"
        imagePosition="right center"
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Contact JetNine", href: "/contact" }}
      />
    </div>
  );
}
