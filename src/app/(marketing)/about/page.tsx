import Image from "next/image";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { Placeholder } from "@/components/placeholder";
import { BeliefsAccordion, type Belief } from "@/components/about/beliefs-accordion";
import { SITE, TRUST_BAR } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "About Our Private Jet Charter Brokerage",
  description:
    "JetNine is a senior-dispatcher charter brokerage in Los Angeles. One number, one desk, ready when you are.",
  path: "/about",
});

// Network size and response time come from the trust-bar data so the
// hero never drifts from the homepage.
const NETWORK = TRUST_BAR.find((t) => t.label === "Aircraft network");
const RESPONSE = TRUST_BAR.find((t) => t.label === "Avg. response");

const HERO_FACTS = [
  { label: "Founded", value: String(SITE.legal.foundedYear), sub: "Los Angeles, California" },
  { label: "Dispatch", value: "24/7", sub: "Every hour, every day" },
  {
    label: "Network",
    value: NETWORK && "value" in NETWORK ? `${Math.round(NETWORK.value / 1000)}K+` : "20K+",
    sub: "Aircraft worldwide",
  },
  {
    label: "Avg. response",
    value: RESPONSE && "value" in RESPONSE ? `${RESPONSE.value} min` : "4 min",
    sub: "Call to dispatcher",
  },
];

const BELIEFS: Belief[] = [
  { num: "01", title: "A senior dispatcher beats software, every time.", why: "Apps quote stale fleet data in seconds. We quote real aircraft in thirty minutes. The thirty minutes are because someone is on the phone with the operator, confirming pilot duty, confirming maintenance status, confirming whether the aircraft will actually be available on the day. The app is faster — but the app is also wrong, sometimes, and the wrong-rate is sticker shock when you land." },
  { num: "02", title: "The price you accept is the price you pay.", why: "If fuel jumps 15% between acceptance and departure, that's our problem. If a Part 135 operator changes a fee, our problem. If we have to reposition because of a weather divert, our problem. We've absorbed roughly $400,000 in cost variance in the last 18 months. The number doesn't move once you accept it. Period." },
  { num: "03", title: "We say no to operators a lot.", why: "Our chief pilot rejects roughly 60% of operators that pass paper screening once he visits the hangar. That's a hard number to hold to when the client wants to fly tomorrow and the rejected operator has the only available aircraft. The right answer is to ask the client to wait or fly commercial — and we say it, every time. We would rather refund an entire trip than fly an aircraft we aren't comfortable with." },
  { num: "04", title: "You should not have to fight us on a refund.", why: "The hardest version of this work is when something goes sideways — operator backs out, weather forces a divert, family emergency on the client side. Our policy is to err on the client's side, every time, and to write the refund the same day. If a refund conversation ever feels like a fight, something has gone wrong on our end — and we treat it that way." },
  { num: "05", title: "We don't market our way out of bad operations.", why: "The fastest way to grow a charter brokerage is to spend on lead-gen and trade ops quality for booking volume. We've watched two competitors do exactly that, both bigger than us at the start of 2020, neither still in business. Our growth has been by referral; our headcount has tracked our flight volume; our ops staff have always outnumbered our sales staff. None of that is a strategy — it's just the only honest way to run the company." },
];

const FOUNDERS = [
  {
    initials: "AA",
    name: "Anna Agadzhanyan",
    role: "Founder, CEO · Dispatch lead",
    bio: [
      "Anna runs the dispatch side of the company — the desk, the operator relationships, the standard for what a quote has to look like before it leaves the building.",
      "Her view of the business is unromantic: show up early, work the phones, vet every operator personally, refund without arguing. The dispatch culture comes from her.",
    ],
  },
  {
    initials: "AD",
    name: "Arman Adamson",
    role: "Co-founder, COO · Operations lead",
    bio: [
      "Arman owns the back end of the operation: operator network, audit cycle, finance, regulatory. He is the reason the Part 295 disclosure on every contract is in plain English.",
      "Operations is where charter brokerages quietly fail. His job is making sure the unglamorous parts — vetting, paperwork, insurance verification — hold to the same standard as the front desk.",
    ],
  },
];

const TEAM = [
  { initials: "DG", name: "Daniel Garcia", role: "Senior dispatcher", meta: "East & Mid-Atlantic" },
  { initials: "RP", name: "Renata Padilla", role: "Senior dispatcher", meta: "Latin America" },
  { initials: "JL", name: "James Lee", role: "Senior dispatcher", meta: "Europe" },
  { initials: "SS", name: "Sarah Smith", role: "Dispatcher", meta: "Pacific Northwest" },
  { initials: "AT", name: "Aamir Tyler", role: "Dispatcher", meta: "Asia & Middle East" },
  { initials: "CA", name: "Catalina Anderson", role: "Senior dispatcher", meta: "West Coast" },
  { initials: "EM", name: "Eli Morison", role: "Dispatcher · nights", meta: "24h desk" },
  { initials: "PF", name: "Patrice Fields", role: "Chief pilot", meta: "Operator vetting" },
];

const HQ_ADDRESS = `${SITE.address.line1}, ${SITE.address.cityState}`;
const DIRECTIONS_URL = `https://maps.google.com/?q=${encodeURIComponent(HQ_ADDRESS)}`;

// AboutPage + Person schema. AboutPage links the page to the
// Organization (declared on the root layout) so Google can connect
// the dots between 'JetNine' as an entity and this page as its
// authoritative about source. Person entries for the founders give
// the company named principals — useful for the knowledge panel and
// for 'who founded JetNine' queries.
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About JetNine",
  description:
    "JetNine is a senior-dispatcher charter brokerage in Los Angeles. One number, one desk, ready when you are.",
  mainEntity: {
    "@type": "Organization",
    name: "JetNine",
    legalName: "JetNine LLC",
    foundingDate: "2026",
    foundingLocation: { "@type": "Place", name: "Los Angeles, CA" },
    founder: FOUNDERS.map((f) => ({
      "@type": "Person",
      name: f.name,
      jobTitle: f.role,
      worksFor: { "@type": "Organization", name: "JetNine" },
    })),
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from FOUNDERS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      <PageHero
        titleClassName="!max-w-[16ch]"
        eyebrow={`About JetNine · est. ${SITE.legal.foundedYear}`}
        title="A small company built on the old idea of one phone number."
        lead="JetNine is a senior-dispatcher charter brokerage in Los Angeles. We don't run a marketing engine. We don't run a marketplace. We don't sell memberships unless you actually need one."
        imageSrc="/images/hero/about.webp"
        imagePosition="center"
      >
        <div className="mt-3.5 grid grid-cols-1 items-end gap-12 max-md:gap-8 lg:grid-cols-[1.2fr_1fr]">
          <p className="lead max-w-[56ch]">
            Most of what we do, on most days, looks the same as it did in 1998 — pick up the phone,
            listen, work the operators, send back specific aircraft with all-in pricing. That part
            is the work. Everything else is decoration.
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line-2 pt-6">
            {HERO_FACTS.map((f) => (
              <div key={f.label}>
                <dt className="text-[13px] text-steel">{f.label}</dt>
                <dd
                  className="mt-1 font-serif text-[32px] font-light leading-none text-bone"
                  style={{ fontVariationSettings: '"opsz" 144' }}
                >
                  {f.value}
                </dd>
                <dd className="mt-1 text-[14px] text-bone-2">{f.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </PageHero>

      {/* Beliefs */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Beliefs</p>
        <h2 className="title-section max-w-[24ch]">Five things we refuse to compromise on.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] text-bone-2">
          The shape of the company comes from these. They&rsquo;ve cost us business, on multiple
          occasions. They&rsquo;ve also kept us on the desks we still want to be on, fifteen years
          from now.
        </p>
        <BeliefsAccordion beliefs={BELIEFS} />
      </section>

      {/* Founders */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Founders</p>
        <h2 className="title-section max-w-[24ch]">Two people you can talk to, on day one.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] text-bone-2">
          Anna runs the dispatch side; Arman runs operations. They still answer their own phones.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {FOUNDERS.map((f) => (
            <div
              key={f.name}
              className="card card-pad grid grid-cols-[200px_minmax(0,1fr)] gap-7 max-md:grid-cols-1 max-md:gap-5 max-md:p-5"
            >
              {/* Photo placeholder — real portraits are still to be supplied. */}
              <div className="relative w-[200px] max-md:w-[160px]">
                <Placeholder aspect="4/5" glyph="" className="rounded-control" />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center font-serif text-[40px] font-light text-steel"
                  style={{ fontVariationSettings: '"opsz" 144' }}
                >
                  {f.initials}
                </span>
              </div>
              <div>
                <h3 className="font-serif text-[28px] font-normal leading-[1.15] text-bone">
                  {f.name}
                </h3>
                <div className="label-jn mt-1.5 text-gold">{f.role}</div>
                {f.bio.map((para, i) => (
                  <p key={para.slice(0, 20)} className={`${i === 0 ? "mt-3.5" : "mt-2.5"} text-bone-2`}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">The desk</p>
        <h2 className="title-section max-w-[26ch]">The people who pick up.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] text-bone-2">
          When you call, one of these people answers. The same dispatcher handles your quote, your
          contract, and any in-flight changes — and stays with you across trips.
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((t) => (
            <li key={t.name} className="card flex items-center gap-3.5 px-5 py-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-clearance"
              >
                {t.initials}
              </span>
              <div>
                <div className="text-[16px] font-medium text-bone">{t.name}</div>
                <div className="text-[14px] text-bone-2">{t.role}</div>
                <div className="text-[13px] text-steel">{t.meta}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* HQ */}
      <section className="container-jn section-jn max-md:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 max-md:gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Headquarters</p>
            <h2 className="title-section max-w-[22ch]">
              One office. One dispatch desk. Open 24 / 7 / 365.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[17px] text-bone-2">
              The dispatch desk is in Van Nuys, ten minutes from the private terminals at Van Nuys
              Airport. We deliberately don&rsquo;t have satellite offices — when something needs to
              be solved at three in the morning, we want everyone in the same room.
            </p>
            <p className="mt-3 max-w-[56ch] text-[17px] text-bone-2">
              The office is staffed every hour of every day. The night desk handles overseas
              dispatch, weather diversions, and the small but annoying number of clients whose
              calendars only allow them to think about a flight at 1 a.m.
            </p>
            <div className="card mt-6 flex items-center justify-between gap-4 px-6 py-5 max-md:flex-col max-md:items-start">
              <address className="not-italic">
                <div className="text-[13px] text-steel">Address</div>
                <div className="mt-1 text-[17px] text-bone">
                  {SITE.address.line1}, {SITE.address.cityState}
                </div>
              </address>
              <a
                href={DIRECTIONS_URL}
                target="_blank"
                rel="noopener"
                className="btn btn-secondary max-md:w-full"
              >
                Directions <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface-2 max-md:aspect-[4/3]">
            <Image
              src="/images/about/dispatch-room.webp"
              alt="The JetNine dispatch room in Van Nuys."
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
