import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { WindowButton } from "@/components/light/window";
import { CategoryBoard, type BoardCategory } from "@/components/aircraft/category-board";
import { CATEGORY_COPY, CATEGORY_IMAGE } from "@/components/aircraft/category-copy";
import { ChecklistButton } from "@/components/aircraft/checklist-button";
import { FaqList } from "@/components/aircraft/faq-list";
import { GalleryButton } from "@/components/aircraft/gallery-button";
import { LineIcon, type IconName } from "@/components/aircraft/line-icon";
import { nm } from "@/components/aircraft/plain";
import { RouteCheckButton } from "@/components/aircraft/route-check-button";
import { FaaContent, NbaaContent } from "@/components/aircraft/source-windows";
import { TripForm } from "@/components/aircraft/trip-form";
import { FLEET } from "@/lib/fleet";
import { MODELS } from "@/lib/models";

export const metadata: Metadata = pageMetadata({
  title: "Private Charter Aircraft — Compare Jets & Turboprops",
  description:
    "Compare six charter aircraft categories, from turboprops to ultra-long-range jets. Explore cabin space, passenger capacity, baggage and range for your trip.",
  path: "/aircraft",
});

const TABS = [
  ["Categories", "#categories"],
  ["Quick compare", "#compare"],
  ["Cabin checklist", "#checklist"],
  ["Pricing", "#pricing"],
  ["Sources", "#sources"],
  ["FAQs", "#faqs"],
] as const;

const DETAILS: { title: string; body: string; icon: IconName }[] = [
  { title: "Your group", body: "Approved seats, sleeping positions and mobility needs.", icon: "people" },
  { title: "Your baggage", body: "Bag dimensions, weight, golf clubs and pet arrangements.", icon: "bag" },
  { title: "Your comfort", body: "Cabin height, privacy, lavatory and seating plan.", icon: "chair" },
  { title: "Your service", body: "Fitted Wi-Fi, coverage, catering and attendant.", icon: "cup" },
];

const CHECKLIST = [
  { icon: "people" as const, title: "Your group", body: "Approved seats, accessibility and mobility needs.", items: ["Approved passenger seats for everyone", "Mobility assistance"] },
  { icon: "bag" as const, title: "Your baggage", body: "Bags, sports equipment and special items.", items: ["Golf bags or skis", "Large suitcases", "Pets in the cabin"] },
  { icon: "seat" as const, title: "Your comfort", body: "Cabin features for your preferred experience.", items: ["Wi-Fi requested", "Sleeping arrangement", "Enclosed lavatory"] },
];

const MAKERS: [string, string][] = [
  ["Pilatus", "https://www.pilatus-aircraft.com/"],
  ["Textron", "https://txtav.com/"],
  ["Embraer", "https://executive.embraer.com/"],
  ["Bombardier", "https://bombardier.com/en/aircraft"],
  ["Gulfstream", "https://www.gulfstream.com/en/aircraft/"],
  ["Dassault", "https://www.dassaultfalcon.com/aircraft/"],
];

const FAQ = [
  { q: "Can I choose an aircraft by passenger count alone?", a: "No. Seating layout, baggage, route, airport conditions and your cabin priorities also matter. Review the actual aircraft offered." },
  { q: "Does the published range guarantee a nonstop flight?", a: "No. Published range assumes a specific speed, load and reserves. The operating carrier confirms nonstop capability for your route and dates." },
  { q: "Are beds, Wi-Fi and a cabin attendant included?", a: "Only on some aircraft. Confirm fitted equipment and service on the specific aircraft, and whether anything is billed separately." },
  { q: "Does JetNine operate the aircraft?", a: "No. JetNine arranges charter flights as a broker. Independent authorized air carriers operate the flights, and every proposal names the operator." },
];

const sectionTitle = "font-serif text-[30px] font-normal leading-[1.1]";
const scrollM = "scroll-mt-[calc(var(--header-h)+16px)]";

export default function AircraftPage() {
  const cats: BoardCategory[] = FLEET.map((f) => {
    const c = CATEGORY_COPY[f.slug];
    return {
      slug: f.slug,
      href: f.href,
      name: c.plural,
      body: c.cardBody,
      examples: f.sampleAircraft.join(" · "),
      image: CATEGORY_IMAGE[f.slug],
      pax: f.pax,
      range: nm(f.rangeNm),
      fit: c.quick.fit,
      cabin: c.quick.cabin,
      bags: c.quick.bags,
      sub: c.tagline,
      samples: f.samples.map((s) => {
        const m = MODELS.find((mm) => mm.sample.name === s.name);
        return { name: s.name, image: s.imageUrl, href: m ? `/aircraft/${m.category}/${m.slug}` : undefined };
      }),
    };
  });

  return (
    <>
      {/* ─── Hero: paper over the wide jet band, trip card on the right ─── */}
      <section className="relative overflow-hidden border-b border-line">
        <Image
          src="/images/light/page-06-hero-band.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 max-lg:![background:rgba(247,245,240,0.82)]"
          style={{
            background:
              "linear-gradient(90deg,rgba(247,245,240,.9) 0%,rgba(247,245,240,.78) 22%,rgba(247,245,240,.3) 40%,rgba(247,245,240,0) 52%)",
          }}
        />
        <div className="container-jn relative grid items-start gap-10 pb-6 pt-[14px] lg:min-h-[400px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="pt-1">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Aircraft" }]} className="font-serif" />
            <p className="mb-1.5 mt-[14px] text-[12px] font-bold uppercase tracking-[.22em] text-gold">The JetNine aircraft guide</p>
            <h1 className="max-w-[22ch] font-serif text-[clamp(32px,4.4vw,48px)] font-normal leading-[1.02] tracking-[-.015em]">
              Private Jet &amp; Turboprop
              <br />
              Charter Aircraft
            </h1>
            <p className="mt-[10px] font-serif text-[22px] leading-[1.2]">Find the right cabin for your journey.</p>
            <p className="mt-2 max-w-[40ch] text-[13px] leading-[1.5]">
              Explore six aircraft categories. Compare the cabin, baggage space and route requirements that matter to your trip.
            </p>
            <p className="mt-14 text-[12px] text-steel max-lg:mt-6">Illustrative aircraft imagery</p>
          </div>
          <TripForm variant="hub" title="Start with your trip" context="aircraft-hub" />
        </div>
      </section>

      <nav aria-label="On this page" className="border-b border-line bg-surface">
        <div className="container-jn flex flex-wrap justify-center gap-x-7 text-[13px]">
          {TABS.map(([label, href], i) => (
            <a key={href} href={href} className={`border-b-2 py-3 ${i === 0 ? "border-bone font-bold" : "border-transparent hover:text-gold"}`}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ─── Six categories ─── */}
      <section id="categories" className={`container-jn pt-[26px] ${scrollM}`}>
        <h2 className="font-serif text-[32px] font-normal leading-[1.1]">Six categories. A clear place to start.</h2>
        <p className="mt-1 text-[13px] text-steel">Explore the category, then compare the actual aircraft offered.</p>
        <CategoryBoard cats={cats} />
      </section>

      {/* ─── Quick compare ─── */}
      <section id="compare" className={`mt-6 border-y border-line bg-surface ${scrollM}`}>
        <div className="container-jn pb-6 pt-[22px]">
          <h2 className={sectionTitle}>Quick compare: what to check first.</h2>
          <div className="mt-3 border border-line bg-white text-[13px]">
            <div className="grid gap-3 bg-surface-2 px-[14px] py-[9px] text-[12px] font-bold max-md:hidden md:grid-cols-[1fr_0.8fr_0.8fr_2fr_auto]">
              <span>Category</span>
              <span>Passengers</span>
              <span>Typical range</span>
              <span>Key question</span>
              <span>Next step</span>
            </div>
            {FLEET.map((f) => (
              <div
                key={f.slug}
                className="grid items-center gap-x-3 gap-y-1 border-t border-line px-[14px] py-[9px] max-md:[&:nth-child(2)]:border-t-0 md:grid-cols-[1fr_0.8fr_0.8fr_2fr_auto]"
              >
                <span className="font-bold">{CATEGORY_COPY[f.slug].name}</span>
                <span className="text-steel">
                  <span className="md:hidden">Passengers: </span>Up to {f.pax}
                </span>
                <span className="text-steel">
                  <span className="md:hidden">Range: </span>
                  {nm(f.rangeNm)}
                </span>
                <span className="text-steel">{CATEGORY_COPY[f.slug].question}</span>
                <Link href={f.href} className="whitespace-nowrap font-bold text-gold hover:underline">
                  View guide →
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-steel">All values approximate · range varies by load, winds and reserves.</p>
        </div>
      </section>

      {/* ─── Cabin checklist ─── */}
      <section id="checklist" className={`container-jn grid items-center gap-8 pt-[26px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))] ${scrollM}`}>
        <div>
          <div className="grid aspect-[16/10] grid-cols-[1.4fr_1fr] grid-rows-2 gap-1.5">
            {[
              ["/images/light/cabin-supermid.webp", "row-span-2"],
              ["/images/light/cabin-baggage.webp", ""],
              ["/images/light/cabin-dining.webp", ""],
            ].map(([src, span], i) => (
              <GalleryButton
                key={src}
                start={i}
                ariaLabel="Open cabin photos"
                images={[
                  { src: "/images/light/cabin-supermid.webp", label: "Seating and layout" },
                  { src: "/images/light/cabin-baggage.webp", label: "Baggage" },
                  { src: "/images/light/cabin-dining.webp", label: "Dining" },
                  { src: "/images/light/jet-midsize.webp", label: "Exterior" },
                ]}
                className={`relative overflow-hidden border-0 bg-surface-2 p-0 ${span}`}
              >
                <Image src={src} alt="" fill sizes="(max-width: 768px) 60vw, 360px" className="object-cover" />
              </GalleryButton>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-steel">Illustrative cabin</p>
        </div>
        <div>
          <h2 className={sectionTitle}>Choose the details that make the trip.</h2>
          <div className="mt-[10px]">
            {DETAILS.map((d) => (
              <div key={d.title} className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3 py-[9px]">
                <LineIcon name={d.icon} size={26} />
                <span>
                  <b className="block text-[14px]">{d.title}</b>
                  <span className="text-[13px] text-steel">{d.body}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-[18px]">
            <ChecklistButton
              label="Open aircraft checklist →"
              className="h-10 rounded-[2px] border-0 bg-gold px-4 text-[13px] font-bold text-white hover:opacity-90"
              groups={CHECKLIST}
              context="aircraft-hub-checklist"
            />
            <Link href="/guides" className="text-link whitespace-nowrap text-[13px] font-bold">
              How to choose the right private jet →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Range band ─── */}
      <section id="range" className={`on-navy relative mt-[26px] overflow-hidden bg-navy ${scrollM}`}>
        <div className="absolute inset-y-0 right-0 w-[60%] max-md:hidden">
          <Image src="/images/light/jet-ultra-flight.webp" alt="" aria-hidden fill sizes="60vw" className="object-cover object-right" />
        </div>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg,rgba(18,35,46,1) 0%,rgba(18,35,46,1) 52%,rgba(18,35,46,.2) 72%,rgba(18,35,46,0) 100%)" }}
        />
        <div className="container-jn relative py-[26px]">
          <h2 className={`${sectionTitle} text-white`}>Published range is a starting point.</h2>
          <p className="mt-1.5 max-w-[60ch] text-[14px] text-navy-on-2">
            Passenger load, bags, winds, routing, speed and airport conditions affect a flight. Ask the operating carrier to assess the
            aircraft offered for your itinerary.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-[22px] gap-y-3 text-[13px] text-white">
            {(
              [
                ["Exact aircraft", "plane"],
                ["Actual route", "pin"],
                ["Your travel dates", "calendar"],
              ] as const
            ).map(([label, icon]) => (
              <span key={label} className="flex items-center gap-2 border-r border-[rgba(255,255,255,.25)] pr-[22px]">
                <LineIcon name={icon} size={20} stroke="#FFFFFF" />
                {label}
              </span>
            ))}
            <RouteCheckButton
              label="Check my route →"
              context="aircraft-hub-route"
              className="h-10 rounded-[2px] border border-white bg-transparent px-[18px] text-[13px] font-bold text-white hover:bg-[rgba(255,255,255,.08)]"
            />
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className={`container-jn grid items-start gap-8 pt-[26px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))] ${scrollM}`}>
        <div>
          <h2 className={sectionTitle}>Compare the total trip price.</h2>
          <p className="mt-1.5 max-w-[60ch] text-[13px] text-steel">
            Ask for a written proposal showing the aircraft, operating carrier, included services and possible additional charges.
          </p>
          <ul className="mt-[14px] grid gap-x-6 gap-y-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {["Flight time and positioning", "Catering and requested services", "Taxes, airport fees and crew charges", "Cancellation and substitution terms"].map((p) => (
              <li key={p} className="flex items-center gap-[10px] text-[14px]">
                <span aria-hidden="true" className="flex h-4 w-4 flex-none items-center justify-center rounded-[2px] border border-gold text-[12px] text-gold">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-line bg-surface px-[18px] py-4">
          <h3 className="font-serif text-[20px] font-normal">Plan with confidence</h3>
          <div className="mt-2 flex flex-col text-[13px] font-bold">
            <Link href="/guides/private-jet-charter-cost" className="border-b border-line py-[7px] hover:text-gold">
              Private jet charter cost guide →
            </Link>
            <Link href="/guides/what-affects-charter-price" className="border-b border-line py-[7px] hover:text-gold">
              How to compare charter quotes →
            </Link>
            <Link href="/how-it-works" className="py-[7px] hover:text-gold">
              How to book a private jet →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Sources ─── */}
      <section id="sources" className={`container-jn pt-[26px] ${scrollM}`}>
        <h2 className={sectionTitle}>Helpful sources, linked to your decisions.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <LineIcon name="doc" size={28} />
            <div>
              <b className="block text-[14px]">FAA · Verify your operator</b>
              <span className="mb-2 mt-0.5 block text-[12px] text-steel">Ask for the carrier certificate and aircraft charter authorization.</span>
              <WindowButton
                label="Read FAA guidance ↗"
                className="text-link border-0 bg-transparent p-0 text-left text-[13px] font-bold"
                title="Verify the operating carrier"
                sub="The Federal Aviation Administration (FAA) provides guidance to help you verify the operating carrier for a charter flight."
                variant="drawer"
              >
                <FaaContent />
              </WindowButton>
            </div>
          </div>
          <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <LineIcon name="book" size={28} />
            <div>
              <b className="block text-[14px]">NBAA · Compare your proposal</b>
              <span className="mb-2 mt-0.5 block text-[12px] text-steel">Review total pricing, extra charges and cancellation terms.</span>
              <WindowButton
                label="Read charter checklist ↗"
                className="text-link border-0 bg-transparent p-0 text-left text-[13px] font-bold"
                title="Compare the whole proposal"
                sub="Use this checklist to review a charter proposal. It covers key items to confirm before you book."
              >
                <NbaaContent />
              </WindowButton>
            </div>
          </div>
          <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border border-line bg-surface px-4 py-[14px]">
            <LineIcon name="gear" size={28} />
            <div>
              <b className="block text-[14px]">Manufacturers · Check the aircraft</b>
              <span className="mb-2 mt-0.5 block text-[12px] text-steel">Review the exact model, cabin dimensions and range assumptions.</span>
              <a href="#makers" className="text-link text-[13px] font-bold">
                View manufacturer references →
              </a>
            </div>
          </div>
        </div>
        <div id="makers" className="mt-[10px] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-[1_1_420px] flex-wrap gap-x-[18px] gap-y-1 text-[12px]">
            {MAKERS.map(([name, href]) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="text-link whitespace-nowrap font-bold">
                {name} ↗
              </a>
            ))}
          </div>
          <span className="text-[12px] text-steel">Independent sources; no endorsement implied.</span>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faqs" className={`container-jn pt-[26px] ${scrollM}`}>
        <h2 className={sectionTitle}>Good questions before you choose.</h2>
        <FaqList items={FAQ} layout="panel" />
      </section>

      {/* ─── Closing band (sand over mountains) ─── */}
      <section className="relative mt-7 overflow-hidden bg-surface-2">
        <Image src="/images/light/mountain-landscape.webp" alt="" aria-hidden fill sizes="100vw" className="object-cover opacity-[.55]" style={{ objectPosition: "center 70%" }} />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(247,245,240,.55),rgba(247,245,240,.35))" }} />
        <div className="container-jn relative flex flex-wrap items-center justify-center gap-[26px] py-7">
          <h2 className="font-serif text-[28px] font-normal leading-[1.1]">Tell us the trip. Start with the right questions.</h2>
          <Link href="/quote/mission" className="inline-flex h-[42px] items-center rounded-[2px] bg-clearance px-[18px] text-[14px] font-bold text-white hover:bg-clearance-hover">
            Request aircraft options →
          </Link>
        </div>
      </section>
    </>
  );
}
