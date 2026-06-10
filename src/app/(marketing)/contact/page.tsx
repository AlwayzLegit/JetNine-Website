import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { ContactForm } from "@/components/contact-form";
import { DeskClock } from "@/components/contact/desk-clock";
import { KvnyMap } from "@/components/kvny-map";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "One desk. One number. Open every hour of every day. Senior dispatcher picks up — average pick-up under twenty seconds.",
  path: "/contact",
});

const CHANNELS = [
  {
    badge: "CHANNEL 01 · FASTEST",
    title: "Call the dispatch line.",
    strap: "Senior dispatcher picks up. Average call to first specific airframe quote: under 30 minutes.",
    big: SITE.dispatchPhone,
    href: `tel:${SITE.dispatchPhoneE164}`,
    meta: [
      ["HOURS", "24/7/365"],
      ["PICKUP", "< 20 sec avg"],
    ] as const,
    primary: true,
  },
  {
    badge: "CHANNEL 02",
    title: "Email dispatch.",
    strap: "Best for non-urgent quotes & multi-leg trips you want to think through.",
    big: "dispatch@jetnine.com",
    href: "mailto:dispatch@jetnine.com",
    meta: [
      ["REPLY", "< 30 min · biz hrs"],
      ["AFTER HRS", "< 2 hr"],
    ] as const,
    primary: false,
  },
  {
    badge: "CHANNEL 03",
    title: "Text the desk.",
    strap: "For existing clients with a confirmed dispatcher. Same number as the phone line.",
    big: `SMS · ${SITE.dispatchPhone}`,
    href: `sms:${SITE.dispatchPhoneE164}`,
    meta: [
      ["REPLY", "< 5 min"],
      ["ESCALATE", "auto · 15 min"],
    ] as const,
    primary: false,
  },
];

const REGIONS = [
  { id: "01", title: "North America · West", airports: "KVNY · KSFO · KSEA · KLAS · KASE · KSDL" },
  { id: "02", title: "North America · East", airports: "KTEB · KJFK · KBOS · KMIA · KOPF · KIAD" },
  { id: "03", title: "Europe", airports: "EGGW · EGLF · LFPB · LSGG · LIRA" },
  { id: "04", title: "Asia & Middle East", airports: "RJTT · RJBB · OMDB · VHHH · WSSS" },
];

const HQ_ROWS = [
  ["ADDRESS", `${SITE.address.line1}, ${SITE.address.cityState}`],
  ["PHONE", `${SITE.dispatchPhone} · 24 / 7`],
  ["EMAIL", "dispatch@jetnine.com"],
  ["VISITS", "By appointment · same-day usually OK"],
  ["PRESS", "press@jetnine.com"],
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
  email: "dispatch@jetnine.com",
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
      <PageHeader
        kicker="Contact dispatch"
        title="One desk. One number. Open every hour of every day."
        lead="A senior dispatcher will pick up — and stay on with you for the duration of the call. No phone tree, no hold music, no after-hours voicemail. Below: the channel that gets you there fastest, plus the form if you'd rather start in writing."
      />

      {/* Live status strip */}
      <section className="border-b border-ink-3 bg-ink-2 py-6">
        <div className="container-jn flex flex-wrap items-center gap-x-10 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone-2">
          <span className="flex items-center gap-3 text-clearance">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-clearance opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-clearance" />
            </span>
            Live · dispatch desk open
          </span>
          <span>Senior dispatcher on the desk now · average pick-up under 20 seconds</span>
          <DeskClock />
        </div>
      </section>

      {/* Channels */}
      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            {CHANNELS.map((c, i) => (
              <Reveal
                key={c.badge}
                stagger={(i as 0 | 1 | 2)}
                className={[
                  "block rounded-[4px] border bg-ink-2 p-10 transition-all duration-200 ease-out-quint hover:-translate-y-0.5",
                  c.primary
                    ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]"
                    : "border-ink-3 hover:border-[rgba(232,226,210,0.3)]",
                ].join(" ")}
              >
                <a href={c.href} className="block">
                  <span
                    className={[
                      "font-mono text-[10px] uppercase tracking-[0.16em]",
                      c.primary ? "text-clearance" : "text-bone-2",
                    ].join(" ")}
                  >
                    — {c.badge}
                  </span>
                  <h3 className="mt-5 font-serif text-[24px] font-normal leading-[1.2] tracking-tight text-bone">
                    {c.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.strap}</p>
                  <div className="mt-8 font-serif text-[28px] font-light leading-tight tracking-tight text-bone break-words">
                    {c.big}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-3 pt-5">
                    {c.meta.map(([lbl, val]) => (
                      <div key={lbl} className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                          {lbl}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.04em] text-bone">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-12 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Or, in writing</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
              Tell us the route. We&rsquo;ll be in touch.
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr]">
            <Reveal stagger={1} className="rounded-[4px] border border-ink-3 bg-ink p-8 sm:p-10">
              <ContactForm />
            </Reveal>

            <Reveal stagger={2} className="flex flex-col gap-6">
              <p className="text-[16px] leading-[1.6] text-bone-2">
                If you&rsquo;d rather start with a few lines of context, drop them here. Same
                dispatcher will reach out within thirty minutes during business hours, two hours
                after.
              </p>
              {[
                {
                  k: "WHAT WE'LL COME BACK WITH",
                  v: "Three to five specific airframes, all-in pricing, photos, operator standing.",
                },
                {
                  k: "WHAT WE WON'T DO",
                  v: "Pass your details to operators, run promotional sequences, or share your inquiry with anyone outside the dispatch desk.",
                },
                {
                  k: "PREFER A FASTER PATH?",
                  v: `Call ${SITE.dispatchPhone} — same desk.`,
                },
              ].map((b) => (
                <div key={b.k} className="border-t border-ink-3 pt-5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — {b.k}
                  </span>
                  <p className="mt-2 text-[14px] leading-[1.6] text-bone-2">{b.v}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Regions */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Regional dispatchers</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
                A dedicated dispatcher per region of the network.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                Local FBO knowledge, customs &amp; permitting expertise, fluent in the language and
                time zone. They route calls inside the desk so you talk to the right person on the
                first try.
              </Reveal>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {REGIONS.map((r, i) => (
              <Reveal
                key={r.id}
                stagger={(i as 0 | 1 | 2)}
                className="flex h-full flex-col gap-5 rounded-[4px] border border-ink-3 bg-ink-2 p-8"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                  REGION {r.id}
                </span>
                <h3 className="font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
                  {r.title}
                </h3>
                <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.08em] text-clearance leading-[1.6]">
                  {r.airports}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HQ */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Reveal className="mb-6">
                <p className="caption">— Headquarters</p>
              </Reveal>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                Van Nuys. Ten minutes from FBO row at KVNY.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
                One office, one desk. Visitors welcome by appointment — most clients fly through Van
                Nuys at some point and stop in to meet the dispatcher who handles their flights.
              </Reveal>
              <Reveal stagger={3} className="mt-10 rounded-[4px] border border-ink-3 bg-ink">
                <ul className="divide-y divide-ink-3">
                  {HQ_ROWS.map(([lbl, val]) => (
                    <li key={lbl} className="grid grid-cols-[140px_1fr] items-baseline gap-4 px-6 py-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                        — {lbl}
                      </span>
                      <span className="text-[14px] leading-[1.5] text-bone">{val}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal stagger={1}>
              <KvnyMap />
            </Reveal>
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="Easiest path: pick up the phone."
        body="Senior dispatcher answers. Same one for the life of the trip."
        primary={{ label: SITE.dispatchPhone, href: `tel:${SITE.dispatchPhoneE164}` }}
        secondary={{ label: "Request a quote", href: "/quote" }}
      />
    </>
  );
}
