import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide } from "@/lib/guides";
import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import { BleedHero } from "@/components/guide-long/hero";
import { ChecklistWindow } from "@/components/guide-long/checklist";
import { StartingPointForm } from "@/components/guide-long/start-form";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import { AutoGrid, BTN, H2, Icon, IconWell, TripPrompt, UnderLink, type IconName } from "@/components/guide-long/ui";

const guide = getLongGuide("private-jet-sizes-and-types");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const CHECKS = ["Passenger count recorded", "Baggage dimensions shared", "Cabin priorities listed", "Route reviewed by operator", "Actual layout confirmed"];

const FAQ: Faq[] = [
  {
    q: "Does a heavy jet always fly farther?",
    a: "No. Compare the specific models and operating assumptions. Cabin size and range measure different things.",
  },
  {
    q: "Can every passenger seat be used with full baggage?",
    a: "Not always. Payload, fuel and baggage volume interact. Share bag sizes and passenger count so the operator can confirm.",
  },
  {
    q: "How do heavy and ultra-long-range jets differ?",
    a: "Both offer large cabins. Ultra-long-range models are built for longer nonstop missions; confirm the specific aircraft and route.",
  },
];

// The four categories this guide compares, from the shared fleet catalog
// (sample aircraft, typical seats and range are the site's own figures).
const LABEL: Partial<Record<AircraftCategorySlug, { name: string; body: string; icon: IconName }>> = {
  light: { name: "Light jets", body: "Start here for a compact cabin. Check baggage fit and seating comfort.", icon: "seat" },
  midsize: { name: "Midsize jets", body: "Compare added cabin room and route capability.", icon: "bag" },
  supermid: { name: "Super-midsize jets", body: "Compare cabin space, baggage and longer-range missions.", icon: "seat" },
  heavy: { name: "Heavy jets", body: "Explore wider cabins and more seating-layout options.", icon: "sofa" },
};
const CATS = FLEET.filter((f) => LABEL[f.slug]).map((f) => ({ ...f, ...LABEL[f.slug]! }));
const nm = new Intl.NumberFormat("en-US");

const CHOOSE: [string, string, IconName][] = [
  ["Seating", "Confirm the actual seat map.", "people"],
  ["Baggage", "Share bag sizes and special items.", "bag"],
  ["Cabin comfort", "Check height, lavatory and connectivity.", "wifi"],
  ["Your route", "Confirm airports, payload and fuel stops.", "pin"],
];

const SPECS = [
  { t: "Embraer · Phenom & Praetor", image: "/images/light/jet-light.webp", url: "https://embraer.com/executive-jets-overview/en" },
  { t: "Bombardier · Challenger", image: "/images/light/jet-heavy.webp", url: "https://bombardier.com/en/aircraft" },
];

export default function JetSizesPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <BleedHero
        crumb="Private jet sizes"
        title={guide.title}
        titleMax="20ch"
        description={<span className="text-[16px] text-bone">Compare light, midsize, super-midsize and heavy jets, then check the aircraft for your trip.</span>}
        image="/images/light/page-24-hero.webp"
        imagePosition="75% 50%"
        bleedWidth="100%"
        fade="linear-gradient(90deg,rgba(247,245,240,.98) 0%,rgba(247,245,240,.95) 50%,rgba(247,245,240,.3) 72%,rgba(247,245,240,0) 100%)"
        actions={
          <>
            <a href="#comparison" className={BTN.bronze}>
              Compare jet sizes <span aria-hidden="true">↓</span>
            </a>
            <a href="#cabins" className={BTN.ghost}>
              Help me choose →
            </a>
          </>
        }
        tabs={[
          { label: "Comparison", href: "#comparison" },
          { label: "Cabin differences", href: "#cabins" },
          { label: "Choosing a jet", href: "#choosing" },
          { label: "FAQs", href: "#faqs" },
          { label: "Sources", href: "#sources" },
        ]}
      />

      <section id="comparison" className="container-jn pt-[26px]">
        <H2>Four categories. One clear comparison.</H2>
        <p className="mt-1 text-[15px] text-steel">Examples below illustrate each category; they are not category-wide limits.</p>
        <div className="mt-[14px] border border-line bg-white">
          <div className="flex flex-wrap gap-x-4 gap-y-1 bg-surface-2 px-3 py-[9px] text-[12px] font-bold uppercase tracking-[.14em] text-steel max-sm:hidden">
            <span className="flex-[0_0_76px]" />
            <span className="min-w-0 flex-[999_1_120px]">Category</span>
            <span className="min-w-0 flex-[999_1_120px]">Example aircraft</span>
            <span className="min-w-0 flex-[999_1_120px]">Typical seats</span>
            <span className="min-w-0 flex-[999_1_120px]">Typical range*</span>
            <span className="min-w-0 flex-[999_1_120px]">Explore</span>
          </div>
          {CATS.map((c, i) => (
            <div key={c.slug} className={`flex flex-wrap items-center gap-x-4 gap-y-[6px] border-t border-surface-2 px-3 py-2 ${i % 2 ? "bg-panel" : "bg-white"}`}>
              <span className="relative block aspect-[3/2] w-[76px] flex-[0_0_76px] overflow-hidden bg-surface-2">
                {c.imageUrl ? <Image src={c.imageUrl} alt="" fill sizes="76px" className="object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-[999_1_120px] font-serif text-[19px]">{c.name}</span>
              <span className="min-w-0 flex-[999_1_120px] text-[14px]">{c.sampleAircraft.join(" · ")}</span>
              <span className="min-w-0 flex-[999_1_120px] text-[14px]">Up to {c.pax}</span>
              <span className="min-w-0 flex-[999_1_120px] text-[14px]">{nm.format(c.rangeNm)} nm</span>
              <Link href={c.href} className="min-w-0 flex-[999_1_120px] whitespace-nowrap text-[14px] text-bone underline underline-offset-[3px] hover:text-gold">
                {c.name} →
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-[6px] text-[12px] text-steel">
          * Typical maximum range for the category with reserves, from JetNine’s aircraft pages. Actual range varies with the
          specific model, payload, weather and routing — the operator confirms it for your itinerary.
        </p>
        <div className="mt-3 flex items-center gap-3 bg-surface-2 px-4 py-[10px] text-[14px]">
          <Icon name="info" size={18} />A larger cabin does not automatically mean greater range.
        </div>
      </section>

      <section id="cabins" className="container-jn pt-[26px]">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div>
            <H2>What changes as you size up?</H2>
            <AutoGrid className="mt-3">
              {CATS.map((c) => (
                <div key={c.slug} className="grid grid-cols-[48px_minmax(0,1fr)] gap-[14px] border border-line bg-white p-4">
                  <IconWell name={c.icon} size={48} />
                  <div>
                    <div className="font-serif text-[19px]">{c.name}</div>
                    <p className="mb-[10px] mt-1 text-[13px] leading-[1.5] text-steel">{c.body}</p>
                    <div className="text-[13px]">Example: {c.sampleAircraft[0]}</div>
                  </div>
                </div>
              ))}
            </AutoGrid>
            <UnderLink href="/aircraft" className="mt-[10px] inline-block">
              Need a different category? Explore turboprops and ultra-long-range jets
            </UnderLink>
          </div>
          <StartingPointForm />
        </AutoGrid>
      </section>

      <section id="choosing" className="container-jn pt-[26px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <H2>Choose the aircraft, not just the category.</H2>
          <ChecklistWindow label="Questions to ask before booking →" className={BTN.text} items={CHECKS} storageKey="jet-sizes" />
        </div>
        <AutoGrid min={160} className="mt-3">
          {CHOOSE.map(([t, b, d]) => (
            <div key={t} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border border-line bg-white p-[14px]">
              <IconWell name={d} size={44} />
              <div>
                <div className="font-serif text-[17px]">{t}</div>
                <div className="text-[13px] text-steel">{b}</div>
              </div>
            </div>
          ))}
        </AutoGrid>
      </section>

      <section className="container-jn pt-[26px]">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="faqs">
            <H2 size={28}>Common questions</H2>
            <FaqList items={FAQ} name="sizes-faq" variant="disc" className="mt-[10px]" />
          </div>
          <div id="sources">
            <H2 size={28}>Check the original specifications.</H2>
            <div className="mt-[10px] flex flex-col gap-2">
              {SPECS.map((s) => (
                <div key={s.t} className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-[14px] border border-line bg-white p-2">
                  <span className="relative block aspect-[2/1] overflow-hidden bg-surface-2">
                    <Image src={s.image} alt="" fill sizes="84px" className="object-cover" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-serif text-[17px]">{s.t}</div>
                    <UnderLink href={s.url}>View manufacturer specifications</UnderLink>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-[6px] text-[12px] text-steel">Manufacturer references; no endorsement implied.</p>
            <div className="mt-3 border border-line bg-white px-[14px] py-3">
              <div className="font-serif text-[18px]">Plan your next step.</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {[
                  ["Browse aircraft", "/aircraft"],
                  ["Estimate charter cost", "/cost-calculator"],
                  ["Explore routes", "/routes"],
                  ["Charter safety", "/safety"],
                ].map(([l, h]) => (
                  <Link key={h} href={h} className="whitespace-nowrap text-bone underline hover:text-gold">
                    {l} →
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </AutoGrid>
      </section>

      <div className="pt-[26px]" />
      <TripPrompt
        title="Tell us about your trip."
        body="Match cabin needs, baggage and route."
        action={
          <Link href="/quote/mission" className={BTN.navy}>
            Request aircraft options →
          </Link>
        }
      />
    </>
  );
}
