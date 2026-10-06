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
import { ChecklistWindow } from "@/components/guide-long/checklist";
import { CopyButton } from "@/components/guide-long/copy-button";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import { SourcesBody } from "@/components/guide-long/sources-body";
import { AutoGrid, Icon, type IconName } from "@/components/guide-long/ui";

const guide = getLongGuide("how-to-book-a-private-jet");

export const metadata: Metadata = pageMetadata({
  title: "How to Book a Private Jet — Charter Booking Guide",
  description: "Follow the steps to book a private jet: prepare your trip brief, compare aircraft and operators, review pricing and terms, and confirm your travel arrangements.",
  path: guide.href,
  image: guide.image,
});

// jn-light-chrome.js SOURCES.book
const SOURCES: Source[] = [
  { name: "FAA", body: "Check the operating carrier and charter authorization.", linkLabel: "Read charter guidance", href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft" },
  { name: "NBAA", body: "Review the aircraft, itinerary and total estimated price.", linkLabel: "Open quote checklist", href: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/" },
  { name: "U.S. DOT", body: "Understand broker disclosures and applicable consumer rules.", linkLabel: "Read broker rules", href: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295" },
];
const SOURCES_NOTE = "Guidance is jurisdiction-specific. These organizations do not endorse JetNine.";

// jn-light-chrome.js checklist(): "Before you commit".
const CHECKLIST = [
  "The proposal: aircraft, airports and itinerary",
  "The proposal: named operating carrier",
  "The proposal: complete price and exclusions",
  "The agreement: payment requirements",
  "The agreement: cancellation and refund terms",
  "The agreement: changes and substitutions",
  "Next step: outstanding confirmation requirements",
  "Next step: trip contact details",
];

const FAQ: Faq[] = [
  {
    q: "When is my flight actually confirmed?",
    a: "Follow the confirmation requirements in your agreement and check the written confirmation. A request or quote alone does not confirm a booking. At JetNine, the trip sheet you sign supersedes the quote and lists the operating carrier and tail number.",
  },
  {
    q: "Do I need to choose an aircraft first?",
    a: "No. Start with your trip brief; dispatch proposes aircraft that fit the route, group and dates.",
  },
  {
    q: "What information is needed for a quote?",
    a: "Route, dates, passenger count, luggage and any special requirements. Flexibility on timing or airports often improves the options.",
  },
  {
    q: "Can I change my itinerary after booking?",
    a: "Often, within the change procedures in your agreement. Changes to dates, airports or passengers can affect price and availability.",
  },
  {
    q: "How early should I arrive?",
    a: "Follow the departure instructions for your flight. For most domestic trips, fifteen minutes before departure at the named terminal is enough.",
  },
];

const BRIEF = "Four passengers. Los Angeles to Las Vegas. Friday afternoon to Sunday evening. Four overnight bags. Flexible departure time.";
const TEMPLATE = "Route: \nDates and times: \nTiming flexibility: \nPassengers: \nBags and special items: \nPets or mobility needs: \nBest contact: ";

const CONFIRMATION: [IconName, string, string][] = [
  ["cal", "Route & dates", "Match your agreed itinerary"],
  ["clock", "Departure times", "Check local times"],
  ["plane", "Aircraft & operator", "Review the confirmed details"],
  ["page", "Agreement & payment", "Check the required steps"],
  ["person", "Passenger information", "Complete outstanding requests"],
  ["info", "Departure instructions", "Confirm when these will follow"],
  ["people", "Trip contact", "Know who to reach"],
];

type Step = {
  id: string;
  n: string;
  title: string;
  sub: string;
  wide?: boolean;
  checksTitle?: string;
  checks?: string[];
  rows?: { title: string; body: string; icon: IconName }[];
  numbered?: string[];
  foot?: string;
  side?: "brief" | "confirm";
  links?: { label: string; href: string }[];
};

const STEPS: Step[] = [
  {
    id: "request",
    n: "01",
    title: "Prepare your trip request.",
    sub: "A clear brief helps us find the right aircraft and provide accurate options.",
    wide: true,
    checksTitle: "Include the following details",
    checks: ["Route & travel dates", "Timing flexibility", "Passenger count", "Pets or mobility needs", "Bags & special items", "Best contact details"],
    side: "brief",
  },
  {
    id: "review",
    n: "02",
    title: "Review the complete proposal.",
    sub: "Look beyond the price and review all details about the aircraft, operator and terms.",
    rows: [
      { title: "Aircraft & itinerary", body: "Confirm cabin, airports, timing and any planned stops.", icon: "plane" },
      { title: "Operating carrier", body: "Know who will operate the flight.", icon: "send" },
      { title: "Total price & conditions", body: "Check inclusions, exclusions and quote validity.", icon: "coins" },
    ],
    foot: "Verify the operator’s charter authorization with the FAA.",
    links: [
      { label: "Compare charter quotes", href: "/guides/how-to-compare-private-jet-quotes" },
      { label: "Charter safety checklist", href: "/guides/private-jet-charter-safety-checklist" },
    ],
  },
  {
    id: "agreement",
    n: "03",
    title: "Check the agreement before accepting.",
    sub: "Read the agreement carefully and make sure you understand the terms.",
    checks: ["Contracting parties", "Change procedures", "Payment requirements", "Aircraft substitutions", "Cancellation terms", "Disruption arrangements"],
    foot: "Resolve outstanding questions before committing.",
    links: [{ label: "Cancellation & refunds", href: "/legal#cancellation" }],
  },
  {
    id: "confirm",
    n: "04",
    title: "Confirm the booking.",
    sub: "Complete the required steps to secure your flight under the agreed terms.",
    wide: true,
    numbered: [
      "Accept the agreed proposal",
      "Complete required agreement and payment steps",
      "Provide requested passenger information securely",
      "Obtain and check written confirmation",
    ],
    foot: "Payment alone does not confirm a flight.",
    side: "confirm",
  },
  {
    id: "fly",
    n: "05",
    title: "Prepare for departure.",
    sub: "Follow the instructions for your flight and be ready for a smooth experience.",
    checks: ["Private terminal address", "Confirmed luggage", "Specific arrival instructions", "Latest itinerary", "Required identification", "Trip contact details"],
    foot: "Follow the instructions supplied for your specific flight.",
    links: [
      { label: "Your first private flight", href: "/guides/first-private-jet-flight" },
      { label: "Airports & terminals", href: "/guides/private-jet-airports-and-fbos" },
      { label: "International travel", href: "/guides/international-private-jet-travel" },
    ],
  },
];

const SERIF_BTN = "border-0 bg-transparent p-0 font-serif text-[14px] font-semibold text-bone underline decoration-line underline-offset-4 hover:text-gold";

function ConfirmationWindow() {
  return (
    <WindowButton
      label={<>Preview confirmation checklist <span aria-hidden="true">↗</span></>}
      className="mt-3 inline-flex h-9 items-center gap-2 rounded-[2px] border border-bone bg-white px-3 font-serif text-[13px] font-semibold text-bone"
      title="Check your booking confirmation"
      sub="Know what is confirmed and what remains outstanding."
    >
      <div className="mt-[18px]">
        {CONFIRMATION.map(([i, a, b]) => (
          <div key={a} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-[14px] border-b border-line py-[11px] text-[15px] sm:grid-cols-[28px_180px_minmax(0,1fr)]">
            <Icon name={i} />
            <b className="font-semibold">{a}</b>
            <span className="text-steel max-sm:col-start-2">{b}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-[10px] rounded-[3px] bg-surface-2 px-[14px] py-3 text-[14px]">
        <Icon name="info" size={20} />
        <span>
          <b>Ask:</b> What remains outstanding before my flight is confirmed?
        </span>
      </div>
      <p className="mb-0 mt-[14px] text-[13px] text-steel">A request, quote or payment alone should not be treated as confirmation.</p>
    </WindowButton>
  );
}

export default function HowToBookPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <div className="container-jn pt-[18px]">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: "How to book a private jet" }]} />
        <div className="mt-[14px] flex flex-wrap items-start gap-6">
          <div className="min-w-0 max-w-full flex-[1_1_150px] self-stretch">
            <TocNav
              variant="ruled"
              title="In this guide"
              numbered
              className="font-serif"
              items={[
                { label: "Request options", href: "#request", n: "01" },
                { label: "Review the proposal", href: "#review", n: "02" },
                { label: "Check the agreement", href: "#agreement", n: "03" },
                { label: "Confirm the booking", href: "#confirm", n: "04" },
                { label: "Prepare to fly", href: "#fly", n: "05" },
                { label: "FAQs", href: "#faqs" },
              ]}
              extra={{
                title: "Related guides",
                links: [
                  { label: "Charter cost", href: "/guides/private-jet-charter-cost" },
                  { label: "Compare quotes", href: "/guides/how-to-compare-private-jet-quotes" },
                  { label: "Safety checklist", href: "/guides/private-jet-charter-safety-checklist" },
                  { label: "First private flight", href: "/guides/first-private-jet-flight" },
                ],
              }}
            />
          </div>

          <div className="min-w-0 flex-[999_1_240px] font-serif">
            <p className="mb-[14px] font-sans text-[12px] font-semibold uppercase tracking-[.16em] text-gold">Your booking guide</p>
            <h1 className="m-0 font-normal leading-[1.06] tracking-[-.02em]" style={{ fontSize: "clamp(34px, 9vw, 50px)" }}>
              How to Book a
              <br />
              Private Jet Charter
            </h1>
            <p className="mt-4 text-[19px] leading-[1.4]">From your first trip request to a confirmed itinerary and a prepared departure.</p>
            <p className="mt-3 max-w-[62ch] text-[15px] text-steel">
              Share your requirements, review the aircraft and operator, understand the agreement, and confirm the next step.
            </p>
            <div className="mt-[22px] flex flex-wrap items-center gap-3">
              <Link href="/quote/mission" className="btn btn-primary h-[46px] font-serif">
                Request a quote <span aria-hidden="true">↗</span>
              </Link>
              <ChecklistWindow
                label="View booking checklist"
                className="btn h-[46px] border-bone bg-transparent font-serif text-bone"
                title="Before you commit."
                items={CHECKLIST}
                storageKey="how-to-book"
              />
            </div>
            <div className="mt-6 flex max-w-[560px] items-center justify-between overflow-x-auto pb-[2px] font-sans">
              {STEPS.map((s, i) => (
                <span key={s.id} className="contents">
                  <a href={`#${s.id}`} className="flex flex-none flex-col items-center gap-[6px] text-bone hover:text-gold">
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-bone text-[12px] font-semibold">{s.n}</span>
                    <span className="text-[12px] font-semibold uppercase tracking-[.1em]">{["Request", "Review", "Agree", "Confirm", "Fly"][i]}</span>
                  </a>
                  {i < STEPS.length - 1 ? (
                    <span aria-hidden="true" className="mx-1 mb-[18px] min-w-[10px] flex-1 overflow-hidden whitespace-nowrap text-center text-[20px] text-gold">
                      ⟶
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <figure className="m-0 mt-6">
              <div className="relative aspect-[16/6.5] overflow-hidden rounded-[2px] bg-surface-2">
                <Image src="/images/light/golden-hour-boarding.webp" alt="" fill priority sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
              </div>
            </figure>
          </div>

          <div className="min-w-0 max-w-full flex-[1_1_230px] self-stretch">
            <aside className="sticky top-[calc(var(--header-h)+16px)] flex flex-col gap-4">
              <PlanBox title="Start with your itinerary" sub=" " context="guide-how-to-book-a-private-jet" />
              <div className="rounded-[3px] border border-line bg-white p-5">
                <h3 className="m-0 font-serif text-[21px] font-normal leading-[1.2]">Know what to check</h3>
                <p className="mb-3 mt-[6px] text-[14px] text-steel">Use our checklist and trusted sources to book with confidence.</p>
                <div className="flex flex-col items-start gap-2">
                  <ChecklistWindow
                    label={<>View the booking checklist <span aria-hidden="true">↗</span></>}
                    className={SERIF_BTN}
                    title="Before you commit."
                    items={CHECKLIST}
                    storageKey="how-to-book"
                  />
                  <WindowButton
                    label={<>Sources &amp; guidance <span aria-hidden="true">↗</span></>}
                    className={SERIF_BTN}
                    title="Sources & useful guidance"
                    sub="Read the original advice behind this guide."
                    variant="drawer"
                  >
                    <SourcesBody sources={SOURCES} note={SOURCES_NOTE} />
                  </WindowButton>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <section className="mt-8 font-serif">
          <h2 className="m-0 text-[30px] font-normal leading-[1.12]">Where are you in the booking process?</h2>
          <AutoGrid min={160} gap="gap-3" className="mt-[14px]">
            {(
              [
                ["Request received", "Your requirements are submitted.", "page"],
                ["Proposal received", "Options and terms are ready to review.", "page"],
                ["Confirmation pending", "Required booking steps remain.", "clock"],
                ["Booking confirmed", "Written confirmation under the agreement.", "check"],
              ] as [string, string, IconName][]
            ).map(([t, b, i]) => (
              <div key={t} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-[3px] border border-line bg-white p-[18px]">
                <Icon name={i} size={30} />
                <div>
                  <h3 className="m-0 text-[17px] font-normal leading-[1.2]">{t}</h3>
                  <p className="mt-1 text-[14px] text-steel">{b}</p>
                </div>
              </div>
            ))}
          </AutoGrid>
          <p className="mt-2 text-[12px] text-steel">Illustrative stages. A request or quote is not a confirmed booking.</p>
        </section>

        {STEPS.map((s) => (
          <section key={s.id} id={s.id} className="mt-7 flex flex-wrap items-start gap-x-7 border-t border-line pt-[26px] font-serif">
            <span className="min-w-0 max-w-full flex-[1_1_40px] text-[22px] leading-[1.3] text-gold">{s.n}</span>
            <div className="min-w-0 max-w-full flex-[1_1_260px]">
              <h2 className="m-0 text-[28px] font-normal leading-[1.12] tracking-[-.01em]">{s.title}</h2>
              <p className="mt-[10px] text-[15px] text-steel">{s.sub}</p>
            </div>
            <div
              className="grid min-w-0 flex-[999_1_240px] items-start gap-6 max-md:mt-4"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${s.wide ? 260 : 180}px), 1fr))` }}
            >
              <div>
                {s.checks ? (
                  <>
                    {s.checksTitle ? <p className="mb-[10px] font-sans text-[12px] font-semibold uppercase tracking-[.16em]">{s.checksTitle}</p> : null}
                    <ul className="m-0 grid list-none gap-x-6 gap-y-[9px] p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
                      {s.checks.map((c) => (
                        <li key={c} className="flex items-center gap-[10px] text-[15px]">
                          <span className="flex h-4 w-4 flex-none items-center justify-center rounded-[2px] border border-gold text-[12px] text-gold">✓</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {s.rows ? (
                  <div className="flex flex-col gap-3">
                    {s.rows.map((r) => (
                      <div key={r.title} className="flex flex-wrap items-center gap-3 text-[15px]">
                        <Icon name={r.icon} size={24} />
                        <b className="min-w-0 max-w-full flex-[1_1_180px] font-semibold">{r.title}</b>
                        <span className="min-w-0 flex-[999_1_200px] text-steel">{r.body}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {s.numbered ? (
                  <ol className="m-0 flex list-none flex-col gap-[9px] p-0">
                    {s.numbered.map((t, i) => (
                      <li key={t} className="flex items-center gap-3 text-[15px]">
                        <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-gold font-sans text-[12px] font-semibold text-white">{i + 1}</span>
                        {t}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {s.foot ? <p className="mt-3 text-[13px] text-steel">{s.foot}</p> : null}
              </div>
              <div>
                {s.side === "brief" ? (
                  <div className="rounded-[3px] bg-surface-2 p-4">
                    <div className="font-sans text-[12px] font-semibold uppercase tracking-[.16em] text-gold">Example trip brief</div>
                    <p className="mt-2 text-[14px]">{BRIEF}</p>
                    <CopyButton
                      text={TEMPLATE}
                      label="Copy trip-request template"
                      className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-[2px] border border-bone bg-white px-3 font-serif text-[13px] font-semibold text-bone"
                    />
                  </div>
                ) : null}
                {s.side === "confirm" ? (
                  <div className="rounded-[3px] bg-surface-2 p-4">
                    <div className="font-sans text-[12px] font-semibold uppercase tracking-[.16em] text-gold">Ask this question</div>
                    <p className="mt-2 text-[14px]">What remains outstanding before my flight is confirmed?</p>
                    <ConfirmationWindow />
                  </div>
                ) : null}
                {s.links ? (
                  <div className="flex flex-col items-end gap-2 text-right max-md:items-start max-md:text-left">
                    {s.links.map((l) => (
                      <Link key={l.href} href={l.href} className="text-[14px] font-semibold text-bone underline decoration-line underline-offset-4 hover:text-gold">
                        {l.label} <span aria-hidden="true">↗</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))}

        <section id="faqs" className="mt-8 pb-9 font-serif">
          <h2 className="m-0 text-[32px] font-normal leading-[1.12] tracking-[-.01em]">Your booking questions, answered.</h2>
          <div className="mt-[14px] rounded-[3px] border border-line bg-white px-4">
            <FaqList items={FAQ} name="book-faq" variant="rule" className="border-t-0 [&>details:last-child]:border-b-0 [&_summary]:font-serif" />
          </div>
        </section>
      </div>

      <CtaBand
        className="!mt-0"
        title="Your next flight starts with a clear brief."
        body="Share your route, dates and requirements."
        primary={{ label: "Request options for your itinerary", href: "/quote/mission" }}
        secondary={null}
        imageSrc="/images/light/wing-over-sunset-clouds.webp"
      />
      <SourcesStrip sources={SOURCES} note={SOURCES_NOTE} />
    </>
  );
}
