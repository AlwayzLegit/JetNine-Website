import Image from "next/image";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { ContactForm } from "@/components/contact-form";
import { DeskClock } from "@/components/contact/desk-clock";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Contact 24/7 Private Jet Dispatch",
  description:
    "One desk. One number. Open every hour of every day. Senior dispatcher picks up — average pick-up under twenty seconds.",
  path: "/contact",
});

const DISPATCH_EMAIL = "dispatch@jetnine.com";
const HQ_ADDRESS = `${SITE.address.line1}, ${SITE.address.cityState}`;
const DIRECTIONS_URL = `https://maps.google.com/?q=${encodeURIComponent(HQ_ADDRESS)}`;

const CHANNELS = [
  {
    tag: "Fastest",
    title: "Call the dispatch line.",
    body: "Senior dispatcher picks up. Average call to first specific aircraft quote: under 30 minutes.",
    big: SITE.dispatchPhone,
    href: `tel:${SITE.dispatchPhoneE164}`,
    meta: "24/7/365 · picks up in under 20 seconds",
    primary: true,
  },
  {
    tag: "Email",
    title: "Email dispatch.",
    body: "Best for non-urgent quotes & multi-leg trips you want to think through.",
    big: DISPATCH_EMAIL,
    href: `mailto:${DISPATCH_EMAIL}`,
    meta: "Reply under 30 min in business hours · under 2 h after",
    primary: false,
  },
  {
    tag: "Text",
    title: "Text the desk.",
    body: "For existing clients with a confirmed dispatcher. Same number as the phone line.",
    big: SITE.dispatchPhone,
    href: `sms:${SITE.dispatchPhoneE164}`,
    meta: "Reply under 5 min · escalates automatically after 15",
    primary: false,
  },
];

const SIDE_NOTES = [
  {
    k: "What we'll come back with",
    v: "Three to five specific aircraft, all-in pricing, photos, operator standing.",
  },
  {
    k: "What we won't do",
    v: "Pass your details to operators, run promotional sequences, or share your inquiry with anyone outside the dispatch desk.",
  },
];

const REGIONS = [
  {
    title: "North America · West",
    cities: "Los Angeles · San Francisco · Seattle · Las Vegas · Aspen · Scottsdale",
  },
  { title: "North America · East", cities: "New York (Teterboro, JFK) · Boston · Miami · Washington" },
  { title: "Europe", cities: "London (Luton, Farnborough) · Paris · Geneva · Rome" },
  { title: "Asia & Middle East", cities: "Tokyo · Osaka · Dubai · Hong Kong · Singapore" },
];

const HQ_ROWS = [
  ["Address", HQ_ADDRESS],
  ["Phone", `${SITE.dispatchPhone} · 24 / 7`],
  ["Email", DISPATCH_EMAIL],
  ["Visits", "By appointment · same-day usually OK"],
  ["Press", "press@jetnine.com"],
] as const;

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

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from SITE constants at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />

      <PageHero
        titleClassName="!max-w-[18ch]"
        eyebrow="Contact dispatch"
        title="One desk. One number. Open every hour of every day."
        lead="A senior dispatcher will pick up — and stay on with you for the duration of the call. No phone tree, no hold music, no after-hours voicemail."
      >
        {/* Live status pill — desk is staffed around the clock, so the
            dot is always on; the clock is the verifiably live part. */}
        <p className="mt-7 inline-flex min-h-[40px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[20px] border border-line bg-surface px-4 py-1.5 text-[14px] text-bone-2">
          <span className="dot dot-success" aria-hidden="true" />
          <span>
            Dispatch desk open now · average pick-up under 20 seconds · <DeskClock />
          </span>
        </p>
      </PageHero>

      {/* Channels */}
      <section className="container-jn pt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          {CHANNELS.map((c) => (
            <a
              key={c.tag}
              href={c.href}
              className={[
                "card card-pad flex flex-col gap-3",
                c.primary ? "card-selected" : "",
              ].join(" ")}
            >
              <span className={`label-jn ${c.primary ? "text-gold" : ""}`}>{c.tag}</span>
              <h2 className="title-card">{c.title}</h2>
              <p className="text-bone-2">{c.body}</p>
              <div
                className={[
                  "mt-auto pt-3 font-serif font-light leading-[1.1] text-bone break-all",
                  c.primary ? "text-[36px] max-md:text-[30px]" : "text-[26px]",
                ].join(" ")}
                style={{ fontVariationSettings: '"opsz" 144' }}
              >
                {c.big}
              </div>
              <div className="text-[14px] text-steel">{c.meta}</div>
            </a>
          ))}
        </div>
      </section>

      {/* In writing */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Or, in writing</p>
        <h2 className="title-section max-w-[26ch]">Tell us the route. We&rsquo;ll be in touch.</h2>
        <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="card card-pad max-md:p-5">
            <ContactForm />
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-[17px] text-bone-2">
              If you&rsquo;d rather start with a few lines of context, drop them here. Same
              dispatcher will reach out within thirty minutes during business hours, two hours
              after.
            </p>
            {SIDE_NOTES.map((n) => (
              <div key={n.k} className="card px-6 py-5">
                <div className="label-jn text-gold">{n.k}</div>
                <p className="mt-1.5 text-bone-2">{n.v}</p>
              </div>
            ))}
            <div className="card px-6 py-5">
              <div className="label-jn text-gold">Prefer a faster path?</div>
              <p className="mt-1.5 text-bone-2">
                Call{" "}
                <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link-strong">
                  {SITE.dispatchPhone}
                </a>{" "}
                — same desk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Regions */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Regional dispatchers</p>
        <h2 className="title-section max-w-[26ch]">
          A dedicated dispatcher per region of the network.
        </h2>
        <p className="mt-4 max-w-[64ch] text-[18px] text-bone-2">
          Local airport knowledge, customs &amp; permitting expertise, fluent in the language and
          time zone. They route calls inside the desk so you talk to the right person on the first
          try.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {REGIONS.map((r) => (
            <div key={r.title} className="card px-7 py-6">
              <h3 className="text-[20px] font-medium leading-[1.2] text-bone">{r.title}</h3>
              <p className="mt-2.5 text-[15px] text-bone-2">{r.cities}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HQ */}
      <section className="container-jn section-jn max-md:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 max-md:gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Headquarters</p>
            <h2 className="title-section max-w-[22ch]">
              Van Nuys. Ten minutes from the private terminals at Van Nuys Airport.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[18px] text-bone-2">
              One office, one desk. Visitors welcome by appointment — most clients fly through Van
              Nuys at some point and stop in to meet the dispatcher who handles their flights.
            </p>
            <dl className="card mt-7 px-6 py-2">
              {HQ_ROWS.map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[120px_1fr] gap-4 border-b border-line-faint py-3.5 text-[15px] last:border-b-0 max-md:grid-cols-1 max-md:gap-1"
                >
                  <dt className="text-steel">{k}</dt>
                  <dd className="text-bone">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-2">
            <Image
              src="/images/about/dispatch-room.webp"
              alt="The JetNine dispatch room in Van Nuys."
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
            />
            <a
              href={DIRECTIONS_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-secondary absolute bottom-5 left-5 bg-[rgba(7,8,10,0.85)]"
            >
              Directions <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <CtaBand
        title="Easiest path: pick up the phone."
        body="Senior dispatcher answers. Same one for the life of the trip."
        primary={{ label: SITE.dispatchPhone, href: `tel:${SITE.dispatchPhoneE164}` }}
        secondary={{ label: "Request a quote", href: "/quote/mission" }}
      />
    </>
  );
}
