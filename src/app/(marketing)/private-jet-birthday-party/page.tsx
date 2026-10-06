import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { SplitHero } from "@/components/company/split-hero";
import { btnPrimary, btnSecondary } from "@/components/concierge/styles";
import {
  BrokerNote,
  breadcrumbJsonLd,
  cardLinkCls,
  ConfirmTable,
  faqJsonLd,
  h2Cls,
  NavyBand,
  PageRail,
  PATHS,
  PhotoBand,
  QuestionsSection,
  RelatedGuides,
  SandNote,
  sectionCls,
  ServiceGrid,
  SourcesSection,
} from "@/components/concierge/sections";
import { BirthdayButton, BirthdayProvider, BirthdaySidebarForm } from "@/components/concierge/birthday-planner";

const PATH = "/private-jet-birthday-party";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Birthday Party & Celebration Charter",
  description:
    "Plan a private jet birthday celebration with tailored aircraft options, catering, approved decorations and chauffeur transfers. Request your JetNine proposal.",
  path: PATH,
  image: "/images/concierge/birthday-hero.webp",
  imageAlt: "Four friends celebrating a birthday around a cake in a private jet cabin.",
});

const FAQ = [
  {
    q: "Can I bring a birthday cake and decorations?",
    a: "Request them in advance. Confirm cake size, storage, allergens and decoration materials with the operator before purchasing. Ask about flame-free cake toppers and keep aisles, exits and safety equipment clear.",
  },
  {
    q: "How many people can join the celebration?",
    a: "Capacity depends on the specific aircraft and its approved seating layout. Tell your advisor the full guest count, including children, plus baggage and assistance needs. Dining places may be fewer than passenger seats.",
  },
  {
    q: "Is champagne, catering or a cabin attendant included?",
    a: "Do not assume these are included. Ask for the quoted menu, drink selection, service arrangements and any additional charges in writing. Alcohol service and all onboard requests require operator approval.",
  },
  {
    q: "What happens if weather changes our plans?",
    a: "Ask your advisor and operator about revised timing, alternative airports or available replacement aircraft. Availability is not guaranteed. Confirm any revised costs and the separate cancellation terms for transfers, catering and destination bookings.",
  },
  {
    q: "Can we take a scenic birthday flight?",
    a: "Ask about feasibility before making plans. The operator must confirm that the proposed flight, airport access and any sightseeing operation are permitted and practical. Scenic routing and views cannot be guaranteed.",
  },
];

const FIT = [
  ["Small group, shorter trip", "A light or midsize jet may suit. Check cabin height, lavatory and table space."],
  ["More room to dine", "Consider a larger cabin. Confirm dining seats, galley facilities and cabin attendant availability."],
  ["Larger guest list", "Ask about VIP airliners or multiple aircraft. Layouts, airports and minimum charges vary."],
];

const CONFIRM: [string, string, string][] = [
  ["Cake & catering", "Dimensions, allergens, storage and serving", "Galley facilities and supplier deadlines vary"],
  ["Drinks", "Operator-approved selection and service", "Do not assume you can self-serve alcohol"],
  ["Decorations", "Materials, placement and removal approval", "Keep exits and safety equipment clear"],
  ["Music & entertainment", "Device compatibility, Wi-Fi and volume", "Connectivity and cabin systems vary"],
  ["Guests & transfers", "Passenger details, children, baggage and pickup", "Capacity and ground arrangements must match"],
  ["Price & changes", "Itemized total, extras and cancellation terms", "Supplier charges and flight changes may apply"],
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Private jet birthday party charter",
    serviceType: "Private jet charter for celebrations",
    provider: { "@id": `${(process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "")}/#organization` },
    areaServed: { "@type": "Place", name: "Worldwide" },
    description:
      "Aircraft options, tailored catering, operator-approved decorations and chauffeur transfers coordinated around a birthday trip.",
  },
  breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Concierge", path: "/private-jet-concierge" },
    { name: "Birthday celebrations", path: PATH },
  ]),
  faqJsonLd(FAQ),
];

// Light - Birthday party.
export default function BirthdayPartyPage() {
  return (
    <BirthdayProvider>
      <script
        type="application/ld+json"
        // Static page data — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SplitHero
        minHeight={400}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Concierge", href: "/private-jet-concierge" },
          { label: "Birthday celebrations" },
        ]}
        eyebrow="A birthday, beautifully arranged"
        title="Private Jet Birthday Party"
        titleClassName="max-w-[14ch] !text-[clamp(34px,9vw,52px)] !leading-[1.04]"
        subtitle={<span className="block text-[24px] leading-[1.2]">Make the journey part of the celebration.</span>}
        body={
          <p className="max-w-[48ch] text-[#2F4654]">
            Celebrate with your favourite people. JetNine coordinates aircraft options, tailored catering and destination plans around your birthday trip.
          </p>
        }
        actions={
          <>
            <BirthdayButton open="trip" className={btnPrimary}>
              Plan my birthday trip <span aria-hidden="true">→</span>
            </BirthdayButton>
            <a href="#services" className={btnSecondary}>
              What can be arranged <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        imageSrc="/images/concierge/birthday-hero.webp"
        imageAlt="Four friends celebrating a birthday around a cake in a private jet cabin."
        imagePosition="center 45%"
        caption="Illustrative imagery"
      />

      <BrokerNote>JetNine is your charter broker. The licensed operator retains operational control and approves onboard arrangements.</BrokerNote>

      <section className="container-jn flex flex-wrap items-start gap-7 pt-7">
        <PageRail
          items={[
            ["Your celebration", "#services"],
            ["Aircraft fit", "#aircraft-fit"],
            ["Before you book", "#before-booking"],
            ["Helpful sources", "#sources"],
            ["Questions", "#questions"],
          ]}
        />

        <div id="services" className="min-w-0 flex-[999_1_420px] scroll-mt-[calc(var(--header-h)+16px)]">
          <h2 className="m-0 text-pretty font-serif text-[34px] font-normal leading-[1.1]">Your guest list. Your destination. Your style.</h2>
          <p className="mt-[6px] text-[15px] text-steel">One coordinated plan, from the private terminal to the final transfer.</p>
          <ServiceGrid
            cards={[
              {
                title: "The right aircraft",
                icon: PATHS.plane,
                body: "Compare light jets through larger cabins and VIP airliners, subject to availability. Confirm seats, baggage and dining layout.",
                action: (
                  <Link href="/aircraft" className={cardLinkCls}>
                    Explore aircraft →
                  </Link>
                ),
              },
              {
                title: "An itinerary that fits",
                icon: PATHS.route,
                body: "Plan one-way, round-trip or multi-city travel. Scenic flights require separate feasibility and operator approval.",
                action: (
                  <Link href="/routes" className={cardLinkCls}>
                    Explore routes →
                  </Link>
                ),
              },
              {
                title: "A personal celebration",
                icon: PATHS.cake,
                body: "Request a cake, tailored menu, champagne or alcohol-free drinks, approved decorations and entertainment.",
                action: (
                  <Link href="/guides/private-jet-cabin-amenities" className={cardLinkCls}>
                    Amenities &amp; catering →
                  </Link>
                ),
              },
              {
                title: "A smooth arrival",
                icon: PATHS.car,
                body: "Coordinate FBO meeting points, chauffeured transfers and, where feasible, helicopter connections.",
                action: (
                  <Link href="/guides/private-jet-airports-and-fbos" className={cardLinkCls}>
                    Airports &amp; FBOs →
                  </Link>
                ),
              },
              {
                title: "The details behind the day",
                icon: PATHS.doc,
                body: "JetNine coordinates with the operator on permits, airport arrangements and crew logistics. Confirm the itinerary, inclusions and backup plan.",
                action: (
                  <Link href="/how-it-works" className={cardLinkCls}>
                    How it works →
                  </Link>
                ),
              },
            ]}
          />
          <PhotoBand
            className="mt-3"
            src="/images/concierge/birthday-cake.webp"
            alt="Birthday cake, canapés and flowers on a walnut table beside a private jet window."
            aspect="16 / 6"
            position="center 55%"
          />
        </div>

        <aside className="min-w-0 max-w-full flex-[1_1_300px] border border-line bg-surface px-5 pb-[22px] pt-5">
          <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1]">Plan your birthday trip</h2>
          <p className="mb-4 mt-[6px] text-[13px] text-steel">Share the essentials. We’ll review the possibilities.</p>
          <BirthdaySidebarForm />
          <div className="mt-5 border-t border-line pt-[18px]">
            <h3 className="m-0 font-serif text-[21px] font-normal">Planning a surprise?</h3>
            <p className="mb-3 mt-1 text-[13px] text-steel">Nominate one organizer and agree discreet communication.</p>
            <PhotoBand
              src="/images/concierge/birthday-transfer.webp"
              alt="Chauffeur vehicle outside a private terminal at sunset."
              aspect="16 / 10"
              sizes="340px"
            />
          </div>
        </aside>
      </section>

      <section id="aircraft-fit" className={sectionCls}>
        <h2 className={h2Cls}>Choose the cabin around the celebration.</h2>
        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {FIT.map(([t, b]) => (
            <article key={t} className="border border-line bg-surface px-5 py-[18px]">
              <h3 className="m-0 font-serif text-[21px] font-normal">{t}</h3>
              <p className="m-0 mt-[6px] text-[14px] text-steel">{b}</p>
            </article>
          ))}
        </div>
        <SandNote>
          <span>Use the quoted aircraft’s actual layout, not a generic category capacity.</span>
          <Link href="/aircraft" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            Compare aircraft →
          </Link>
        </SandNote>
      </section>

      <section id="before-booking" className={sectionCls}>
        <h2 className={h2Cls}>A few details make all the difference.</h2>
        <ConfirmTable
          label="What to confirm before booking"
          head={["Request", "Confirm before booking", "Why it matters"]}
          rows={CONFIRM}
        />
        <SandNote>Ask about flame-free cake toppers. Clear all decorations with the operator before bringing them onboard.</SandNote>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-[14px]">
          <div>
            <h3 className="m-0 font-serif text-[24px] font-normal">Use this checklist before you book.</h3>
            <p className="mt-1 text-[14px] text-steel">Work through the details with your advisor.</p>
          </div>
          <BirthdayButton open="checklist" className={btnPrimary}>
            Open birthday planning checklist →
          </BirthdayButton>
        </div>
      </section>

      <section className="container-jn pt-10">
        <div className="flex flex-wrap border border-line bg-surface">
          <div className="relative min-h-[200px] flex-[1_1_240px] bg-[#ECE8DF]">
            <Image
              src="/images/concierge/birthday-jet.webp"
              alt="Private jet parked on an airport apron at sunset."
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-[999_1_320px] px-7 py-[26px] max-sm:px-5">
            <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1]">How much does a birthday charter cost?</h2>
            <p className="mt-[10px] max-w-[72ch] text-[15px] text-steel">
              Your quote depends on aircraft, route, dates, flight time, repositioning and requested extras. Ask for an itemized total covering agreed flight
              charges, taxes, catering and transfers.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-[22px] gap-y-[10px] text-[14px] font-bold">
              <Link href="/cost-calculator" className="underline underline-offset-[3px] hover:text-gold">
                Explore the cost calculator →
              </Link>
              <Link href="/guides/how-to-compare-private-jet-quotes" className="underline underline-offset-[3px] hover:text-gold">
                Compare charter quotes →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SourcesSection
        title="Celebrate with the right questions."
        items={[
          {
            org: "FAA",
            title: "Verify charter authorization",
            body: "Check the operating carrier and aircraft.",
            link: "Read official guidance",
            href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
          },
          {
            org: "NBAA",
            title: "Understand charter brokering",
            body: "Review broker roles and recommended practices.",
            link: "Read official guidance",
            href: "https://nbaa.org/aircraft-operations/part-135/nbaa-best-practices-for-air-charter-brokering/",
          },
          {
            org: "The Air Charter Association",
            title: "Know who arranges your flight",
            body: "Understand sourcing and operator coordination.",
            link: "Read official guidance",
            href: "https://www.theaircharterassociation.aero/why-charter/aircharterbroker/",
          },
        ]}
        note="Independent references; no endorsement implied. Requirements vary by route and operator."
      />

      <QuestionsSection items={FAQ} />

      <RelatedGuides
        items={[
          { title: "Cabin Amenities, Wi-Fi & Catering", href: "/guides/private-jet-cabin-amenities", img: "/images/concierge/birthday-cake.webp", link: "Explore the guide" },
          { title: "Private Jet Concierge", href: "/private-jet-concierge", img: "/images/concierge/birthday-transfer.webp", link: "Explore the guide" },
          {
            title: "Weather Delays & Replacement Aircraft",
            href: "/guides/private-jet-disruptions-and-replacements",
            img: "/images/concierge/birthday-jet.webp",
            link: "Explore the guide",
          },
        ]}
      />

      <NavyBand
        title="A memorable birthday starts with a thoughtful plan."
        body="Tell us where you’re going, and what matters along the way."
        action={
          <BirthdayButton open="trip" className="inline-flex h-11 cursor-pointer items-center rounded-[2px] border-0 bg-white px-[22px] text-[14px] font-bold text-bone hover:bg-surface-2">
            Plan my celebration →
          </BirthdayButton>
        }
      />
    </BirthdayProvider>
  );
}
