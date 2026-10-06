import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { ContactForm } from "@/components/contact-form";
import { DeskClock } from "@/components/contact/desk-clock";
import { SplitHero } from "@/components/company/split-hero";
import { FaqList } from "@/components/company/faq-list";
import { Icon, type IconName } from "@/components/company/icons";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Contact 24/7 Private Jet Charter Support",
  description:
    "Contact JetNine by phone or email to discuss a charter, share your itinerary or get trip support. Find our dispatch details and request your next flight.",
  path: "/contact",
});

const DISPATCH_EMAIL = "dispatch@jetnine.com";
// LocalBusiness JSON-LD. Schema.org subtype for a brick-and-mortar
// or local-service-area business. Reinforces Organization on the root
// layout with the specifically-local context — address, phone,
// 24/7 dispatch hours — which Google uses for local-intent queries
// (e.g. "private jet charter Los Angeles", "charter broker Van Nuys").
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/#localbusiness`,
  name: "JetNine",
  legalName: "JetNine LLC",
  url: siteUrl,
  telephone: SITE.dispatchPhoneE164,
  email: DISPATCH_EMAIL,
  description:
    "Senior-dispatcher private aviation charter brokerage. Part 295 indirect air carrier on ARG/US Platinum Part 135 operators.",
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE.address.line1,
    addressLocality: "Los Angeles",
    addressRegion: "CA",
    postalCode: "90077",
    addressCountry: "US",
  },
  areaServed: { "@type": "Place", name: "Worldwide" },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: SITE.dispatchPhoneE164,
      contactType: "Dispatch",
      areaServed: "Worldwide",
      availableLanguage: ["English"],
      hoursAvailable: "Mo-Su 00:00-23:59",
    },
  ],
};

const CHANNELS: { title: string; value: string; note: string; href: string; icon: IconName }[] = [
  { title: "Call JetNine", value: SITE.dispatchPhone, note: "For a conversation or a time-sensitive trip request. Staffed 24/7.", href: `tel:${SITE.dispatchPhoneE164}`, icon: "phone" },
  { title: "Email the team", value: DISPATCH_EMAIL, note: "Send your itinerary or question in writing.", href: `mailto:${DISPATCH_EMAIL}`, icon: "mail" },
];

const AFTER = [
  ["01", "Clarify your trip", "Discuss your route, timing and priorities."],
  ["02", "Review the options", "Review aircraft, operating carrier, pricing and terms."],
  ["03", "Confirm your booking", "Complete the agreement and required payment steps."],
];

const HELPFUL: { title: string; href: string; icon: IconName }[] = [
  { title: "How charter works", href: "/how-it-works", icon: "plane" },
  { title: "Understand charter pricing", href: "/guides/private-jet-charter-cost", icon: "doc" },
  { title: "Compare aircraft", href: "/aircraft", icon: "seat" },
  { title: "Safety questions", href: "/safety", icon: "shield" },
];

const CHECKS: { org: string; title: string; body: string; link: string; url: string; icon: IconName }[] = [
  { org: "FAA", title: "Verify the operating carrier", body: "Ask for the operator’s certificate and confirm that the aircraft is authorized for charter.", link: "Read FAA charter guidance", url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft", icon: "plane" },
  { org: "NBAA", title: "Review the complete quote", body: "Ask about the aircraft, total trip price, additional charges and cancellation terms.", link: "Open the charter checklist", url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/", icon: "doc" },
];

const FAQ = [
  { q: "Do I need to know which aircraft I want?", a: "No. Start with your route, dates, passenger count and baggage. These details help narrow the options." },
  { q: "Does sending the form book my flight?", a: "No. A request starts a conversation. A flight is confirmed only after the agreement and the required steps are complete." },
  { q: "How should I request a change to an existing trip?", a: "Call with your booking reference, especially close to departure. A change is not confirmed until it is acknowledged in writing." },
];

// Light - Contact (board 10).
export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from SITE constants at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />

      <SplitHero
        tone="sand"
        minHeight={300}
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        eyebrow="Let’s plan your next flight"
        title="Contact JetNine"
        subtitle={<span className="block font-serif text-[clamp(26px,6vw,34px)]">Start with a conversation.</span>}
        body={
          <>
            <p className="max-w-[56ch]">Request a charter quote, ask a question or get help with an existing trip.</p>
            <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 text-[13px] text-steel">
              <span className="dot dot-success" aria-hidden="true" />
              Dispatch desk open now · <DeskClock />
            </p>
          </>
        }
        imageSrc="/images/light/reception-marble-walnut.webp"
      />

      {/* Channels */}
      <section className="container-jn grid gap-4 pt-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {CHANNELS.map((c) => (
          <a
            key={c.title}
            href={c.href}
            className="flex items-center gap-[18px] border border-line bg-surface px-[22px] py-5 transition-colors hover:border-gold max-sm:px-4"
          >
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-navy">
              <Icon name={c.icon} className="h-5 w-5" stroke="#FFFFFF" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-steel">{c.title}</span>
              <span className="block break-words font-serif text-[22px] leading-[1.2]">{c.value}</span>
              <span className="mt-1 block text-[13px] text-steel">{c.note}</span>
            </span>
            <span aria-hidden="true" className="text-[20px]">→</span>
          </a>
        ))}
      </section>

      <ContactForm email={DISPATCH_EMAIL} />

      {/* After you send */}
      <section className="container-jn pt-[30px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">After you send your request</h2>
        <ol className="mt-[14px] flex list-none flex-wrap items-center gap-5 p-0">
          {AFTER.map(([n, title, body], i) => (
            <li key={n} className="contents">
              <div className="flex min-w-0 flex-[1_1_180px] items-center gap-4">
                <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full border border-gold font-serif text-[17px] text-gold">
                  {n}
                </span>
                <div>
                  <div className="text-[15px] font-bold">{title}</div>
                  <div className="text-[13px] text-steel">{body}</div>
                </div>
              </div>
              {i < AFTER.length - 1 ? (
                <span aria-hidden="true" className="text-[22px] text-gold max-sm:hidden">→</span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-[10px] text-center text-[12px] text-steel">Availability and final arrangements are subject to confirmation.</p>
      </section>

      {/* Helpful */}
      <section className="container-jn pt-[26px]">
        <h2 className="font-serif text-[28px] leading-[1.1]">Helpful before you book</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {HELPFUL.map((h) => (
            <Link key={h.href} href={h.href} className="flex items-center gap-3 border border-line bg-surface px-4 py-[14px] transition-colors hover:border-gold">
              <Icon name={h.icon} className="h-6 w-6" />
              <span className="flex-1 text-[14px]">{h.title}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Independent checks */}
      <section className="mt-[26px] border-y border-line bg-surface-2">
        <div className="container-jn pb-[22px] pt-5">
          <h2 className="font-serif text-[26px] leading-[1.1]">Two useful independent checks.</h2>
          <div className="mt-3 grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {CHECKS.map((c) => (
              <div key={c.org} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 border border-line bg-surface px-[18px] py-4">
                <Icon name={c.icon} className="h-[30px] w-[30px]" />
                <div>
                  <div className="text-[14px]">
                    <span className="font-serif text-gold">{c.org}</span> <span className="text-gold">/</span> <b>{c.title}</b>
                  </div>
                  <p className="mb-2 mt-1 text-[13px] leading-[1.45] text-steel">{c.body}</p>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="rule-link !font-sans !text-[13px]">
                    {c.link} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-[10px] text-center text-[12px] text-steel">Independent sources. Links do not imply endorsement.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-jn pb-[26px] pt-[22px]">
        <h2 className="font-serif text-[26px] leading-[1.1]">Before you get in touch</h2>
        <FaqList className="mt-3" items={FAQ} marks={["﹀", "︿"]} />
      </section>
    </>
  );
}
