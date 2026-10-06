import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { SplitHero } from "@/components/company/split-hero";
import { btnPrimary, btnSecondary, linkBtn } from "@/components/concierge/styles";
import {
  BrokerNote,
  cardLinkCls,
  ConfirmTable,
  ExternalLink,
  faqJsonLd,
  breadcrumbJsonLd,
  h2Cls,
  Icon,
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
import {
  ConciergeButton,
  ConciergeChecks,
  ConciergeProvider,
  ConciergeSidebarForm,
} from "@/components/concierge/concierge-planner";

const PATH = "/private-jet-concierge";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Concierge & Travel Planning",
  description:
    "Coordinate private jet charter, chauffeur transfers, tailored catering, hotels and experiences with JetNine. Request a personalized travel plan.",
  path: PATH,
  image: "/images/concierge/hero.webp",
  imageAlt: "Travellers walking to a private jet at sunset as a chauffeur waits beside the car.",
});

const FAQ = [
  {
    q: "Are concierge services included in my charter price?",
    a: "Your written proposal should list what is included, optional charges, supplier deposits and cancellation terms. Confirm every requested extra before booking.",
  },
  {
    q: "Can you guarantee a specific aircraft or event ticket?",
    a: "Availability depends on the operator or supplier. Treat an aircraft, hotel room, restaurant reservation or event ticket as unconfirmed until you receive written confirmation and understand the payment and cancellation terms.",
  },
  {
    q: "Can you arrange dietary and mobility requirements?",
    a: "Share dietary restrictions, allergies, mobility aids and boarding needs as early as possible. The operator must confirm aircraft access, cabin suitability, serving equipment and catering arrangements for the specific flight.",
  },
  {
    q: "What happens if my flight or onward plans change?",
    a: "Contact your named trip advisor. Ask which alternatives are available, which onward bookings are affected, and whether there are revised charges. The operator confirms flight feasibility; supplier changes and refunds follow the applicable terms.",
  },
  {
    q: "Does concierge support mean faster customs clearance?",
    a: "Concierge coordination can help organize arrival details, but it cannot guarantee expedited inspection or admission. Border authorities make those decisions. Confirm travel documents and airport procedures before departure.",
  },
];

const HOW: { icon: string; title: string; body: string }[] = [
  { icon: PATHS.doc, title: "Share your priorities", body: "Route, dates, passenger needs and budget." },
  { icon: PATHS.people, title: "Review your options", body: "Aircraft, services and itemized costs." },
  { icon: PATHS.clipboard, title: "Confirm the details", body: "Approve availability, terms and payments." },
  { icon: PATHS.plane, title: "Travel with support", body: "One itinerary and a named trip contact." },
];

const CONFIRM: [string, string, string][] = [
  ["Aircraft", "Operating carrier, aircraft and cabin layout", "Availability and substitutions"],
  ["Transfers & connections", "Pickup point, baggage space and time buffer", "Traffic, weather and separate bookings"],
  ["Catering", "Menu, allergens and service equipment", "Supplier deadlines and aircraft facilities"],
  ["Hotels & experiences", "Confirmation, deposit and cancellation terms", "Availability and third-party policies"],
  ["Price & changes", "Included items, extras and who authorizes them", "Amendment, waiting and cancellation fees"],
];

const CBP = "https://www.cbp.gov/travel/general-aviation-processing";

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Private jet concierge and travel planning",
    serviceType: "Private jet charter travel coordination",
    provider: { "@id": `${(process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "")}/#organization` },
    areaServed: { "@type": "Place", name: "Worldwide" },
    description:
      "Aircraft sourcing, chauffeur transfers, tailored catering, hotels, dining and experiences coordinated around a private jet itinerary.",
  },
  breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Private Jet Concierge", path: PATH },
  ]),
  faqJsonLd(FAQ),
];

// Light - Concierge.
export default function ConciergePage() {
  return (
    <ConciergeProvider>
      <script
        type="application/ld+json"
        // Static page data — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SplitHero
        minHeight={400}
        crumbs={[{ label: "Home", href: "/" }, { label: "Private Jet Concierge" }]}
        eyebrow="Your journey, thoughtfully arranged"
        title="Private Jet Concierge"
        titleClassName="!text-[clamp(34px,9vw,52px)] !leading-[1.04]"
        subtitle={<span className="block text-[clamp(28px,6vw,40px)] leading-[1.1]">One advisor. Every detail.</span>}
        body={
          <p className="max-w-[50ch] text-[#2F4654]">
            Aircraft options, chauffeur transfers, tailored catering and destination plans, coordinated around your itinerary.
          </p>
        }
        actions={
          <>
            <ConciergeButton open="trip" className={btnPrimary}>
              Plan my journey <span aria-hidden="true">→</span>
            </ConciergeButton>
            <a href="#services" className={btnSecondary}>
              Explore services <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        imageSrc="/images/concierge/hero.webp"
        imageAlt="Travellers walking to a private jet at sunset as a chauffeur waits beside the car."
        caption="Illustrative imagery"
      />

      <BrokerNote>JetNine arranges your travel. The licensed operator retains operational control of the flight.</BrokerNote>

      <section className="container-jn flex flex-wrap items-start gap-7 pt-7">
        <PageRail
          items={[
            ["Services", "#services"],
            ["How it works", "#how"],
            ["What to confirm", "#confirm"],
            ["Helpful sources", "#sources"],
            ["Questions", "#questions"],
          ]}
        />

        <div id="services" className="min-w-0 flex-[999_1_420px] scroll-mt-[calc(var(--header-h)+16px)]">
          <h2 className="m-0 text-pretty font-serif text-[34px] font-normal leading-[1.1]">More than a flight. A coordinated journey.</h2>
          <p className="mt-[6px] text-[15px] text-steel">Tell us what matters. We’ll bring the moving parts together.</p>
          <ServiceGrid
            cards={[
              {
                title: "Aircraft sourcing",
                icon: PATHS.plane,
                body: "Compare available aircraft across multiple operators for your route, passengers, baggage and cabin preferences.",
                action: (
                  <Link href="/aircraft" className={cardLinkCls}>
                    Explore aircraft →
                  </Link>
                ),
              },
              {
                title: "Before you board",
                icon: PATHS.dining,
                body: "Coordinate tailored menus, wine requests and airport meet-and-greets. Confirm dietary needs and order deadlines.",
                action: (
                  <Link href="/guides/private-jet-cabin-amenities" className={cardLinkCls}>
                    Cabin amenities &amp; catering →
                  </Link>
                ),
              },
              {
                title: "Beyond the airport",
                icon: PATHS.car,
                body: "Arrange chauffeur transfers and request helicopter connections or yacht coordination, subject to local availability.",
                action: (
                  <Link href="/guides/private-jet-airports-and-fbos" className={cardLinkCls}>
                    Airports &amp; FBOs →
                  </Link>
                ),
              },
              {
                title: "Your destination, arranged",
                icon: PATHS.hotel,
                body: "Request hotels, villas, restaurant reservations and event tickets. Review supplier terms before confirming.",
                action: (
                  <ConciergeButton open="dest" className={`${linkBtn} mt-auto self-start pt-[6px]`}>
                    Destinations &amp; experiences →
                  </ConciergeButton>
                ),
              },
              {
                title: "Support when plans change",
                icon: PATHS.headset,
                body: "24/7 concierge support for itinerary changes and travel coordination. Keep your trip contact and escalation details close.",
                action: (
                  <ConciergeButton open="support" className={`${linkBtn} mt-auto self-start pt-[6px]`}>
                    Review your next step →
                  </ConciergeButton>
                ),
              },
            ]}
          />
          <PhotoBand
            className="mt-3"
            src="/images/concierge/cabin-dining.webp"
            alt="Dining table set for a meal beside a private jet window."
            aspect="16 / 7"
            position="center 60%"
          />
          <p className="mt-3 text-[13px] text-steel">
            Planning a celebration?{" "}
            <Link href="/private-jet-birthday-party" className="font-bold text-bone underline underline-offset-[3px] hover:text-gold">
              Private jet birthday parties →
            </Link>
          </p>
        </div>

        <aside className="min-w-0 max-w-full flex-[1_1_300px] border border-line bg-surface px-5 pb-[22px] pt-5">
          <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1]">Plan your journey</h2>
          <p className="mb-4 mt-[6px] text-[13px] text-steel">Start with your route. Add the details that make it yours.</p>
          <ConciergeSidebarForm />
          <div className="mt-5 border-t border-line pt-[18px]">
            <h3 className="m-0 font-serif text-[21px] font-normal">Already travelling?</h3>
            <p className="mb-2 mt-1 text-[13px] text-steel">Use the trip contact on your confirmation.</p>
            <ConciergeButton open="support" className={`${linkBtn} mb-3`}>
              Plans changed? →
            </ConciergeButton>
            <PhotoBand
              src="/images/concierge/cabin-notebook.webp"
              alt="Notebook on a cabin table beside a private jet seat."
              aspect="16 / 10"
              className="max-h-[220px]"
              sizes="340px"
            />
          </div>
        </aside>
      </section>

      <section id="how" className={sectionCls}>
        <h2 className={h2Cls}>From first brief to final arrival.</h2>
        <p className="mt-[6px] text-[15px] text-steel">A simple process, with expert support at every step.</p>
        <ol className="m-0 mt-4 grid list-none border border-line bg-surface p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {HOW.map((s, i) => (
            <li key={s.title} className="flex gap-[14px] px-5 py-[18px] shadow-[inset_1px_0_0_var(--line)]">
              <Icon d={s.icon} size={30} />
              <div>
                <span className="font-serif text-[20px] text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="m-0 mt-[2px] font-serif text-[20px] font-normal">{s.title}</h3>
                <p className="m-0 mt-[2px] text-[13px] text-steel">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="confirm" className={sectionCls}>
        <h2 className={h2Cls}>Know what’s confirmed before you travel.</h2>
        <p className="mt-[6px] text-[15px] text-steel">Confirm key details with the operator and suppliers before agreeing to your trip.</p>
        <ConfirmTable
          label="Travel arrangements to confirm"
          head={["Arrangement", "Confirm in writing", "What can vary"]}
          rows={CONFIRM}
        />
        <SandNote>
          <span className="flex-[1_1_300px]">
            International arrivals: we coordinate the details; border authorities control inspection and admission. Expedited clearance is not guaranteed.
          </span>
          <Link href="/guides/international-private-jet-travel" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            International travel guide →
          </Link>
          <ExternalLink href={CBP} className="whitespace-nowrap">
            CBP arrival guidance
          </ExternalLink>
        </SandNote>
        <div className="mt-[22px] flex flex-wrap items-start gap-x-7 gap-y-4">
          <div className="flex-[1_1_240px]">
            <h3 className="m-0 font-serif text-[24px] font-normal">Use this checklist before you book.</h3>
            <p className="mt-1 text-[14px] text-steel">Work through these items with your advisor.</p>
          </div>
          <ConciergeChecks />
        </div>
      </section>

      <SourcesSection
        title="Independent guidance. Better questions."
        sub="Useful resources to help you prepare."
        items={[
          {
            org: "FAA",
            title: "Verify the operating carrier",
            body: "Ask for the operator’s charter authorization.",
            link: "Read FAA guidance",
            href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
          },
          {
            org: "U.S. Customs & Border Protection",
            title: "Prepare for international arrival",
            body: "Check airport procedures and arrival coordination.",
            link: "Read CBP guidance",
            href: CBP,
          },
          {
            org: "The Air Charter Association",
            title: "Understand your broker’s role",
            body: "Aircraft sourcing, coordination and trip support.",
            link: "Read broker guidance",
            href: "https://www.theaircharterassociation.aero/why-charter/aircharterbroker/",
          },
        ]}
        note="Independent references; no endorsement implied. Requirements depend on route and jurisdiction."
      />

      <QuestionsSection items={FAQ} />

      <RelatedGuides
        items={[
          { title: "Cabin Amenities, Wi-Fi & Catering", href: "/guides/private-jet-cabin-amenities", img: "/images/concierge/cabin-dining.webp", link: "Read the guide" },
          { title: "Private Jet Airports & FBOs", href: "/guides/private-jet-airports-and-fbos", img: "/images/concierge/birthday-transfer.webp", link: "Read the guide" },
          { title: "Corporate & Multi-City Charter", href: "/guides/corporate-multi-city-private-jet-charter", img: "/images/concierge/corporate.webp", link: "Read the guide" },
        ]}
      />

      <NavyBand
        image="/images/concierge/jet-hero.webp"
        title="Your itinerary. Every detail considered."
        body="Tell us where you’re going, and what matters along the way."
        action={
          <ConciergeButton open="trip" className="inline-flex h-11 cursor-pointer items-center rounded-[2px] border-0 bg-white px-[22px] text-[14px] font-bold text-bone hover:bg-surface-2">
            Plan my journey →
          </ConciergeButton>
        }
      />
    </ConciergeProvider>
  );
}
