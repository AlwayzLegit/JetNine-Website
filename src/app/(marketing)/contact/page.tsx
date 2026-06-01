import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { ContactForm } from "@/components/contact-form";
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
  { id: "01", title: "North America · West", airports: "KVNY · KSFO · KSEA · KLAS · KASE · KSDL", person: "Catalina Vance", years: "14 yrs · West-coast lanes" },
  { id: "02", title: "North America · East", airports: "KTEB · KJFK · KBOS · KMIA · KOPF · KIAD", person: "Daniel Hsieh", years: "17 yrs · East & Mid-Atlantic" },
  { id: "03", title: "Europe", airports: "EGGW · EGLF · LFPB · LSGG · LIRA", person: "James Kowalski", years: "22 yrs · transatlantic ops" },
  { id: "04", title: "Asia & Middle East", airports: "RJTT · RJBB · OMDB · VHHH · WSSS", person: "Aamir Talwar", years: "11 yrs · trans-pacific & ME" },
];

const HQ_ROWS = [
  ["ADDRESS", `${SITE.address.line1}, ${SITE.address.cityState}`],
  ["PHONE", `${SITE.dispatchPhone} · 24 / 7`],
  ["EMAIL", "dispatch@jetnine.com"],
  ["VISITS", "By appointment · same-day usually OK"],
  ["PRESS", "press@jetnine.com"],
] as const;

const FBOS = [
  { icao: "KVNY", fbo: "Signature Flight Support", sub: "FBO of record · home base", city: "Van Nuys, CA", notes: "Customs · 24h tower" },
  { icao: "KTEB", fbo: "Meridian Teterboro", sub: "Northeast hub", city: "Teterboro, NJ", notes: "24h customs" },
  { icao: "KSFO", fbo: "Signature SFO", sub: "Bay Area", city: "San Francisco, CA", notes: "Customs available" },
  { icao: "KOPF", fbo: "Atlantic Aviation Opa-Locka", sub: "Miami, ex-MIA", city: "Opa-Locka, FL", notes: "24h customs" },
  { icao: "KASE", fbo: "Atlantic Aviation Aspen", sub: "Mountain ops", city: "Aspen, CO", notes: "Slot-controlled" },
  { icao: "EGGW", fbo: "Signature London Luton", sub: "Preferred London FBO", city: "London, UK", notes: "24h customs" },
  { icao: "LFPB", fbo: "Universal Aviation Le Bourget", sub: "Paris", city: "Paris, FR", notes: "Schengen ops" },
  { icao: "RJTT", fbo: "Universal Aviation Haneda", sub: "Tokyo, slot-restricted", city: "Tokyo, JP", notes: "Slot req'd · 96h notice" },
];

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
          <span>Catalina V. and Eli M. on the desk now · average pick-up under 20 seconds</span>
          <span className="ml-auto text-steel">VAN NUYS · 14:08 PT</span>
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
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-clearance leading-[1.6]">
                  {r.airports}
                </p>
                <div className="mt-auto border-t border-ink-3 pt-5">
                  <div className="font-serif text-[18px] font-normal leading-[1.2] text-bone">
                    {r.person}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {r.years}
                  </div>
                </div>
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
              <Placeholder caption="KVNY · VAN NUYS MAP" aspect="4/5" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* FBO partners */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Preferred FBO partners</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                Where to find us on the ramp.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                A short list of FBOs we route through most often. We hold accounts at all of them —
                fueling, ramp, and ground are coordinated by your dispatcher before you arrive.
              </Reveal>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {["ICAO", "FBO", "City", "Notes"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-ink-3 px-6 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FBOS.map((f) => (
                  <tr key={f.icao} className="border-b border-ink-3 transition-colors hover:bg-ink-2">
                    <td className="px-6 py-5 font-mono text-[12px] tracking-[0.06em] text-clearance">
                      {f.icao}
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-serif text-[17px] font-normal leading-[1.2] text-bone">
                        {f.fbo}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                        {f.sub}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                      {f.city}
                    </td>
                    <td className="px-6 py-5 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                      {f.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
