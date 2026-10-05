import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide } from "@/lib/guides";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { PlanBox } from "@/components/light/plan-box";
import { SourcesStrip, type Source } from "@/components/light/sources-strip";
import { WindowButton } from "@/components/light/window";
import { CtaBand } from "@/components/cta-band";
import { TocNav } from "@/components/guide-long/toc";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import { AutoGrid, Icon, type IconName } from "@/components/guide-long/ui";
import { SourcesBody } from "@/components/guide-long/sources-body";

const guide = getLongGuide("private-jet-charter-guide");

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter: A Beginner’s Guide",
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

// jn-light-chrome.js SOURCES.guide
const SOURCES: Source[] = [
  { name: "FAA · United States", body: "Verify the operating carrier and charter authorization.", linkLabel: "Read charter guidance", href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft" },
  { name: "U.S. DOT", body: "Understand the difference between brokers and operators.", linkLabel: "Read broker rules", href: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295" },
  { name: "NBAA", body: "Questions to ask about your trip and quote.", linkLabel: "Open charter checklist", href: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/" },
  { name: "CAA · United Kingdom", body: "Operator checks for UK charter arrangements.", linkLabel: "Read UK guidance", href: "https://www.caa.co.uk/air-passengers/about-your-trip/charters-and-air-taxi-flights/" },
];

const FAQ: Faq[] = [
  {
    q: "Do I need a membership to charter a jet?",
    a: "No. On-demand charter can be arranged trip by trip at market rates. The JetNine Card and other programs have separate terms for frequent flyers.",
  },
  {
    q: "Who actually operates my flight?",
    a: "A licensed operating carrier flies the aircraft. JetNine arranges the flight as a broker; the operating carrier and tail number are stated on your trip sheet before you sign.",
  },
  {
    q: "Is the price per aircraft or per passenger?",
    a: "This guide concerns whole-aircraft charter for your party. Confirm the complete itinerary price and any passenger-dependent taxes or charges.",
  },
  {
    q: "What should I prepare before requesting options?",
    a: "Start with your route, dates, passenger count, luggage and flexibility. Include special requirements that could affect the aircraft or itinerary.",
  },
];

type Stage = {
  id: string;
  n: string;
  stage: string;
  title: string;
  sub: string;
  checks?: string[];
  rows?: { title: string; body: string; icon: IconName }[];
  note: { title?: string; text: string; info?: boolean; sources?: string };
  cards: { href: string; title: string; body: string; icon: IconName }[];
};

const STAGES: Stage[] = [
  {
    id: "plan",
    n: "01",
    stage: "Plan",
    title: "Start with your trip, not an aircraft.",
    sub: "Share the essentials so the options fit your journey.",
    checks: ["Route and travel dates", "Passengers and luggage", "Timing flexibility", "Pets or accessibility needs"],
    note: { title: "Example trip brief", text: "Four passengers. Los Angeles to Las Vegas. Friday to Sunday. Four overnight bags. Flexible departure time." },
    cards: [
      { href: "/guides/private-jet-sizes-and-types", title: "Aircraft sizes & types", body: "Find the right cabin for your journey.", icon: "plane" },
      { href: "/guides/how-to-choose-the-right-private-jet", title: "Choosing the right jet", body: "Match the aircraft to your needs.", icon: "pin" },
    ],
  },
  {
    id: "compare",
    n: "02",
    stage: "Compare",
    title: "Compare the complete journey.",
    sub: "Look beyond the aircraft and review the full picture.",
    rows: [
      { title: "Aircraft fit", body: "Confirm cabin, baggage space and the proposed operating plan.", icon: "plane" },
      { title: "Total trip price", body: "Check taxes, fees, inclusions and exclusions.", icon: "coins" },
      { title: "Clear responsibilities", body: "Identify the seller and the actual operating carrier.", icon: "page" },
    ],
    note: { text: "An hourly rate is only one part of a trip price.", info: true },
    cards: [
      { href: "/guides/private-jet-charter-cost", title: "Private jet charter cost", body: "Understand what’s included.", icon: "coins" },
      { href: "/guides/how-to-compare-private-jet-quotes", title: "How to compare quotes", body: "Key factors and questions to ask.", icon: "page" },
    ],
  },
  {
    id: "book",
    n: "03",
    stage: "Book",
    title: "Know what to check before you commit.",
    sub: "Review the details and terms so there are no surprises.",
    checks: [
      "Named operating carrier and authorization",
      "Cancellation and refund terms",
      "Aircraft, airports and itinerary",
      "Substitution and disruption arrangements",
      "Complete price and payment requirements",
    ],
    note: { text: "The FAA recommends checking the charter operator’s authorization.", info: true, sources: "FAA consumer guidance" },
    cards: [
      { href: "/guides/how-to-book-a-private-jet", title: "How to book a private jet", body: "From proposal to confirmation.", icon: "page" },
      { href: "/guides/private-jet-charter-safety-checklist", title: "Charter safety checklist", body: "Key items to review.", icon: "shield" },
    ],
  },
  {
    id: "fly",
    n: "04",
    stage: "Fly",
    title: "Arrive prepared for your first flight.",
    sub: "Follow the departure instructions supplied for your confirmed itinerary.",
    checks: ["Private terminal location", "Passenger and luggage details", "Arrival and identification instructions", "Trip contact and special arrangements"],
    note: { text: "Private flights usually leave from a private terminal (called an FBO), not the main airline terminal.", info: true },
    cards: [
      { href: "/guides/first-private-jet-flight", title: "Your first private jet flight", body: "What to expect on the day.", icon: "plane" },
      { href: "/guides/private-jet-airports-and-fbos", title: "Airports & terminals", body: "Locations and useful information.", icon: "pin" },
    ],
  },
];

const DIRECTORY: { n: string; stage: string; links: [string, string][] }[] = [
  { n: "01", stage: "Plan", links: [["Aircraft types", "/guides/private-jet-sizes-and-types"], ["Charter costs", "/guides/private-jet-charter-cost"], ["When to book", "/guides/how-far-in-advance-to-book-a-private-jet"]] },
  { n: "02", stage: "Compare", links: [["Choosing a company", "/guides/how-to-choose-a-charter-company"], ["Reading a quote", "/guides/how-to-compare-private-jet-quotes"], ["Broker vs. operator", "/guides/private-jet-broker-vs-operator"]] },
  { n: "03", stage: "Book", links: [["Booking steps", "/guides/how-to-book-a-private-jet"], ["Safety checks", "/guides/private-jet-charter-safety-checklist"], ["Cancellation terms", "/legal#cancellation"]] },
  { n: "04", stage: "Fly", links: [["Your first flight", "/guides/first-private-jet-flight"], ["Baggage planning", "/guides/private-jet-baggage-limits"], ["International travel", "/guides/international-private-jet-travel"]] },
];

const sourcesButton = (label: string, className: string) => (
  <WindowButton label={<>{label} <span aria-hidden="true">↗</span></>} className={className} title="Sources & useful guidance" sub="Read the original advice behind this guide." variant="drawer">
    <SourcesBody sources={SOURCES} note="Sources support the guidance, not an endorsement of JetNine." />
  </WindowButton>
);

const INDENT = { paddingLeft: "max(0px, min(196px, calc(100% - 340px)))" };

export default function BeginnersGuidePage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <div className="container-jn pt-[18px]">
        <div style={INDENT}>
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: "Beginner’s guide" }]} />
        </div>
        <div className="mt-[14px] flex flex-wrap items-start gap-6">
          <div className="min-w-0 max-w-full flex-[1_1_200px] self-stretch">
            <TocNav
              variant="boxed"
              title="In this guide"
              numbered
              items={[
                { label: "How charter works", href: "#roles" },
                { label: "Plan your trip", href: "#plan", n: "01" },
                { label: "Compare options", href: "#compare", n: "02" },
                { label: "Book with confidence", href: "#book", n: "03" },
                { label: "Prepare to fly", href: "#fly", n: "04" },
                { label: "Explore the guides", href: "#guides" },
                { label: "FAQs", href: "#faqs" },
              ]}
              extra={{
                title: "Quick links",
                links: [
                  { label: "Charter cost", href: "/guides/private-jet-charter-cost" },
                  { label: "Aircraft types", href: "/guides/private-jet-sizes-and-types" },
                  { label: "Safety checklist", href: "/guides/private-jet-charter-safety-checklist" },
                  { label: "Charter glossary", href: "/guides/private-jet-charter-glossary" },
                ],
              }}
            />
          </div>

          <div className="min-w-0 flex-[999_1_240px]">
            <p className="mb-[14px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">Start here</p>
            <h1 className="m-0 font-serif font-normal leading-[1.06] tracking-[-.02em]" style={{ fontSize: "clamp(34px, 9vw, 50px)" }}>
              {guide.title}
            </h1>
            <p className="mt-4 text-[20px] leading-[1.4]">Understand how charter works, what to compare, and how to prepare for your first flight.</p>
            <p className="mt-3 max-w-[62ch] text-[16px] text-steel">
              Start with your route, dates, passengers and luggage. Then compare suitable aircraft, the complete trip price and
              the operating carrier.
            </p>
            <div className="mt-[22px] flex flex-wrap items-center gap-3">
              <a href="#guides" className="btn btn-primary h-[46px]">
                Explore the guides <span aria-hidden="true">↓</span>
              </a>
              <Link href="/quote/mission" className="btn h-[46px] border-gold bg-transparent text-bone hover:text-gold">
                Plan your first trip <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="mt-6 flex max-w-[560px] items-center justify-between gap-3 overflow-x-auto">
              {STAGES.map((s, i) => (
                <span key={s.id} className="contents">
                  <a href={`#${s.id}`} className="flex flex-col items-center gap-1 text-bone hover:text-gold">
                    <span className="font-serif text-[26px] leading-none">{s.n}</span>
                    <span className="text-[12px] font-semibold uppercase tracking-[.16em]">{s.stage}</span>
                  </a>
                  {i < STAGES.length - 1 ? (
                    <span aria-hidden="true" className="text-[20px] text-gold">
                      ⟶
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <figure className="m-0 mt-6">
              <div className="relative aspect-[16/6.5] overflow-hidden rounded-[2px] bg-surface-2">
                <Image src="/images/light/page-03-hero.webp" alt="" fill priority sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
              </div>
            </figure>

            <section id="roles" className="mt-7">
              <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.15]">Who arranges your flight?</h2>
              <AutoGrid min={180} gap="gap-4" className="mt-[14px]">
                {(
                  [
                    ["You", "Define the trip and review the proposal.", "person"],
                    ["Charter broker", "Arranges transportation with an operating carrier.", "people"],
                    ["Operating carrier", "Operates the aircraft and controls the flight.", "send"],
                  ] as [string, string, IconName][]
                ).map(([t, b, i]) => (
                  <div key={t} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-l border-line pl-4">
                    <Icon name={i} size={30} />
                    <div>
                      <h3 className="m-0 font-serif text-[19px] font-normal leading-[1.2]">{t}</h3>
                      <p className="mt-1 text-[14px] text-steel">{b}</p>
                    </div>
                  </div>
                ))}
              </AutoGrid>
              <div className="mt-[14px] text-center">
                <Link href="/guides/private-jet-broker-vs-operator" className="whitespace-nowrap border-b border-line pb-[2px] text-[14px] font-semibold text-gold">
                  Understand brokers vs. operators <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </section>
          </div>

          <div className="min-w-0 max-w-full flex-[1_1_230px] self-stretch">
            <aside className="sticky top-[calc(var(--header-h)+16px)] flex flex-col gap-4">
              <PlanBox title="Plan your first trip" sub="A few details to get started." />
              <div className="rounded-[3px] border border-line bg-white p-5">
                <Icon name="page" size={30} />
                <h3 className="mt-[10px] font-serif text-[21px] font-normal leading-[1.2]">Learn with confidence</h3>
                <p className="mb-[10px] mt-[6px] text-[14px] text-steel">Practical guidance from aviation authorities.</p>
                {sourcesButton("View sources", "text-link border-0 bg-transparent p-0 text-[14px] font-semibold")}
              </div>
            </aside>
          </div>
        </div>

        {STAGES.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="mt-7 grid items-start gap-10 border-t border-line pt-7"
            style={{ ...INDENT, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
          >
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[.16em] text-gold">
                {s.n} / {s.stage}
              </p>
              <h2 className="m-0 font-serif font-normal leading-[1.1] tracking-[-.01em]" style={{ fontSize: "clamp(28px, 7vw, 34px)" }}>
                {s.title}
              </h2>
              <p className="mt-[10px] text-[16px] text-steel">{s.sub}</p>
            </div>
            <div>
              {s.checks ? (
                <ul className="m-0 grid list-none gap-x-6 gap-y-[10px] p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
                  {s.checks.map((c) => (
                    <li key={c} className="flex items-center gap-[10px] text-[15px]">
                      <Icon name="check" size={20} />
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.rows ? (
                <div className="flex flex-col gap-3">
                  {s.rows.map((r) => (
                    <div key={r.title} className="flex flex-wrap items-center gap-3 text-[15px]">
                      <Icon name={r.icon} size={26} />
                      <b className="min-w-0 max-w-full flex-[1_1_170px] font-semibold">{r.title}</b>
                      <span className="min-w-0 flex-[999_1_240px] text-steel">{r.body}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex items-start gap-[10px] rounded-[3px] bg-surface-2 px-4 py-[14px] text-[14px]">
                {s.note.info ? <Icon name="info" size={20} className="mt-[1px]" /> : null}
                <div>
                  {s.note.title ? <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.16em] text-gold">{s.note.title}</div> : null}
                  <span>{s.note.text}</span>
                  {s.note.sources ? <> {sourcesButton(s.note.sources, "text-link border-0 bg-transparent p-0 text-[14px] font-semibold")}</> : null}
                </div>
              </div>
              <AutoGrid gap="gap-3" className="mt-[14px]">
                {s.cards.map((c) => (
                  <Link
                    key={c.href + c.title}
                    href={c.href}
                    className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3 rounded-[3px] border border-line bg-white px-4 py-[14px] text-bone hover:border-gold hover:text-bone"
                  >
                    <Icon name={c.icon} size={26} />
                    <span>
                      <b className="block text-[15px] font-semibold">
                        {c.title} <span aria-hidden="true" className="font-normal">↗</span>
                      </b>
                      <span className="text-[13px] text-steel">{c.body}</span>
                    </span>
                  </Link>
                ))}
              </AutoGrid>
            </div>
          </section>
        ))}
      </div>

      <section id="guides" className="mt-9 border-y border-line bg-surface-2">
        <div className="container-jn pb-7 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.12]">Find your next answer.</h2>
              <p className="mt-1 text-[15px] text-steel">Explore practical guides for every stage of your journey.</p>
            </div>
            <Link href="/guides" className="text-[14px] font-semibold text-gold">
              Browse all guides <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <AutoGrid min={160} gap="gap-6" className="mt-5">
            {DIRECTORY.map((d) => (
              <div key={d.n} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-l border-line pl-4">
                <span className="font-serif text-[30px] leading-none">{d.n}</span>
                <div>
                  <div className="mb-2 mt-[6px] text-[12px] font-semibold uppercase tracking-[.16em]">{d.stage}</div>
                  {d.links.map(([l, h]) => (
                    <Link key={h} href={h} className="flex justify-between gap-2 py-1 text-[14px] text-bone hover:text-gold">
                      <span>{l}</span>
                      <span aria-hidden="true" className="text-gold">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </AutoGrid>
        </div>
      </section>

      <section id="faqs" className="container-jn pb-9 pt-8">
        <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.12] tracking-[-.01em]">A few first-flight questions.</h2>
        <FaqList items={FAQ} name="beginner-faq" variant="rule" className="mt-[14px]" />
      </section>

      <CtaBand
        className="!mt-0"
        title="Your first trip starts with a clear plan."
        body="Share your route, dates and requirements."
        primary={{ label: "Plan your first trip", href: "/quote/mission" }}
        secondary={null}
      />
      <SourcesStrip sources={SOURCES} note="Sources support the guidance, not an endorsement of JetNine." />
    </>
  );
}
