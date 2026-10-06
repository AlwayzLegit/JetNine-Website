import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { GuideGate } from "@/components/guide-gate";
import { PlanBox } from "@/components/light/plan-box";
import { WindowButton } from "@/components/light/window";
import { SplitHero } from "@/components/company/split-hero";
import { FaqList } from "@/components/company/faq-list";
import { CheckDot } from "@/components/company/icons";
import { STEPS } from "@/components/how-it-works/steps";
import { ChecklistWindow, ConfirmationWindow, ExampleQuoteWindow } from "@/components/how-it-works/windows";

export const metadata: Metadata = pageMetadata({
  title: "How Private Jet Charter Works",
  description:
    "A senior dispatcher, not a chatbot. One number to call. Specific aircraft & pricing back within thirty minutes.",
  path: "/how-it-works",
});

// Light - How it works (board 07).

const RAIL = [
  ["Five steps", "#steps"],
  ["Quote inclusions", "#quote"],
  ["Booking checklist", "#checklist"],
  ["Trusted guidance", "#guidance"],
  ["Questions", "#faqs"],
];

const READY = ["Route and dates", "Passengers and bags", "Timing flexibility", "Pets or access needs"];

const INCLUSIONS = [
  ["Flight & positioning", "Billable time and minimums", "Trip proposal"],
  ["Taxes & airport costs", "Included, separate or conditional", "Itemized quote"],
  ["Catering & ground transport", "Scope, allowances and upgrades", "Written inclusions"],
  ["Changes & cancellation", "Charges, deadlines and refunds", "Agreement"],
];

const CHECKS = [
  { org: "FAA", title: "Verify the operator.", body: "Ask to see the operator’s Air Carrier or Operating Certificate and confirm the aircraft is authorized for charter use.", link: "FAA charter guidance", domain: "faa.gov", url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft" },
  { org: "NBAA", title: "Review the whole proposal.", body: "Check the named aircraft and carrier, additional charges, cancellation terms and complete estimated trip price.", link: "NBAA proposal checklist", domain: "nbaa.org", url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/" },
  { org: "U.S. DOT / eCFR", title: "Understand who does what.", body: "Identify the operating carrier and the capacity in which the charter broker acts for your booking.", link: "Read 14 CFR Part 295", domain: "ecfr.gov", url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295" },
];

const FAQ = [
  { q: "When is my booking confirmed?", a: "Obtain written confirmation and check any outstanding conditions. A request or quote is not itself a confirmed booking." },
  { q: "What can change the final price?", a: "Dates, airports, passenger count, luggage, routing and aircraft availability. Confirm what is included before you accept." },
  { q: "What if my plans or the weather change?", a: "Follow the change and disruption terms in your agreement. The operating carrier decides on delays or diversions for safety." },
  { q: "When should I arrive at the terminal?", a: "Follow the departure instructions for your flight. Most domestic departures need about fifteen minutes at the named terminal." },
  {
    q: "What's a Part 295 broker, and is JetNine one?",
    a: "Yes. JetNine is an indirect air carrier under Part 295 of the US DOT regulations. We arrange charter on behalf of clients with FAA Part 135 certified operators — we don't operate aircraft ourselves. The Part 295 disclosure is in every charter agreement, in plain English: it identifies the operator of record (the certificated operator, not us) and where liability sits.",
  },
  {
    q: "Do you offer empty-leg flights?",
    a: "Yes. Repositioning legs surface on a live board at 30–60% off the equivalent charter price. They're date- and route-locked — you take the flight as scheduled. If your dates and lanes are flexible, set a watchlist and we'll text when one matches.",
  },
];

const GUIDES = [
  { title: "Choose your aircraft", body: "Compare cabin types and find the right fit for your trip.", link: "Explore aircraft", href: "/aircraft", img: "/images/light/jet-light.webp" },
  { title: "Understand trip pricing", body: "Learn what’s included and what can affect the final price.", link: "View the pricing guide", href: "/guides/private-jet-charter-cost", img: "/images/light/cabin-supermid.webp" },
  { title: "Booking checklist", body: "Make sure you have everything ready for a smooth booking.", link: "Open the checklist", href: "/guides/how-to-book-a-private-jet", img: "/images/light/notebook-sunset-window.webp" },
  { title: "Prepare for your first flight", body: "Know what to expect at the terminal and on the day of travel.", link: "Read the guide", href: "/guides/first-private-jet-flight", img: "/images/light/arrival-private-terminal.webp" },
];

// HowTo Schema.org JSON-LD. Google may surface this as a rich result —
// stepped how-to card under the search listing — and it gives the page
// a strong intent signal for queries like 'how to book a private jet'.
// Built straight from the STEPS array so the structured data tracks
// whatever the visible content shows.
const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to charter a private flight with JetNine",
  description:
    "From quote request to wheels-up in five steps. Senior dispatcher, real aircraft, all-in pricing, under thirty minutes to first quote.",
  totalTime: "PT30M",
  step: STEPS.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.title,
    text: `${s.sub} You provide: ${s.provide} You receive: ${s.receive}`,
  })),
};

const linkCls = "rule-link mt-3 border-0 border-b bg-transparent p-0 !text-[14px]";

export default function HowItWorksPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from STEPS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <SplitHero
        minHeight={330}
        crumbs={[{ label: "Home", href: "/" }, { label: "How it works" }]}
        eyebrow="From first request to departure"
        title="How Private Jet Charter Works"
        titleClassName="!text-[clamp(34px,9vw,56px)] !leading-[1.02]"
        subtitle={<span className="block text-[22px] leading-[1.25]">Five clear steps, from your trip brief to your confirmed flight.</span>}
        body={<p className="text-[14px] text-steel">Know what to provide, what to compare and what happens next.</p>}
        actions={
          <>
            <Link href="/quote/mission" className="btn btn-primary btn-sm !h-[42px] !font-bold">
              Start a trip request →
            </Link>
            <WindowButton
              label="View the booking checklist"
              className="btn btn-secondary btn-sm !h-[42px] !border-bone !font-normal"
              title="Before you commit"
              sub="Your booking review checklist."
              variant="drawer"
            >
              <ChecklistWindow />
            </WindowButton>
          </>
        }
        imageSrc="/images/light/page-13-hero.webp"
      />

      {/* Step strip */}
      <nav aria-label="Steps" className="border-b border-line bg-surface">
        <ol className="container-jn flex list-none flex-wrap items-center gap-4 py-[14px]">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-4 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <a href={`#${s.id}`} className="flex items-baseline gap-[10px] whitespace-nowrap">
                <span className="font-serif text-[22px] text-gold">{s.n}</span>
                <span className="font-serif text-[16px]">{s.nav}</span>
              </a>
              {i < STEPS.length - 1 ? <span aria-hidden="true" className="h-px flex-1 bg-line max-md:hidden" /> : null}
            </li>
          ))}
        </ol>
      </nav>

      <div className="container-jn flex flex-wrap items-start gap-7 pt-6">
        {/* Rail */}
        <div className="min-w-0 max-w-full flex-[1_1_150px] self-stretch max-lg:hidden">
          <nav aria-label="On this page" className="sticky top-[calc(var(--header-h)+20px)] border-r border-line pr-3">
            <p className="mb-2 text-[13px] text-steel">On this page</p>
            {RAIL.map(([label, href], i) => (
              <a
                key={href}
                href={href}
                className={`-ml-[2px] block border-l-2 px-[10px] py-[6px] text-[13px] ${i === 0 ? "border-gold font-bold text-bone" : "border-transparent text-steel hover:text-bone"}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Steps */}
        <div id="steps" className="min-w-0 flex-[999_1_240px] scroll-mt-[calc(var(--header-h)+16px)]">
          <h2 className="font-serif text-[34px] leading-[1.1]">What happens at each step.</h2>
          {STEPS.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className="grid scroll-mt-[calc(var(--header-h)+16px)] grid-cols-[70px_minmax(0,1fr)] gap-[10px] border-b border-line py-[22px] max-sm:grid-cols-[52px_minmax(0,1fr)]"
            >
              <span className="font-serif text-[clamp(34px,9vw,44px)] leading-none text-gold">{s.n}</span>
              <div>
                <h3 className="font-serif text-[22px] leading-[1.2]">{s.title}</h3>
                <p className="mt-1 text-[14px] text-steel">{s.sub}</p>
                <dl className="mt-[10px] grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                  <dt className="font-bold">You provide</dt>
                  <dd className="m-0 text-steel">{s.provide}</dd>
                  <dt className="font-bold">You receive</dt>
                  <dd className="m-0 text-steel">{s.receive}</dd>
                </dl>
                {s.note ? <p className="mt-3 bg-surface-2 px-[14px] py-[10px] text-[13px]">{s.note}</p> : null}
                {s.link.window === "confirmation" ? (
                  <WindowButton
                    label={`${s.link.label} →`}
                    className={linkCls}
                    title="Check your booking confirmation"
                    sub="Know what is confirmed and what remains outstanding."
                  >
                    <ConfirmationWindow />
                  </WindowButton>
                ) : s.link.href ? (
                  <Link href={s.link.href} className="rule-link mt-3 !text-[14px]">
                    {s.link.label} →
                  </Link>
                ) : null}
                {s.image ? (
                  <div className="relative mt-4 aspect-[16/5] overflow-hidden bg-surface-2">
                    <Image src="/images/light/cabin-supermid.webp" alt="" aria-hidden fill sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {/* Aside */}
        <div className="min-w-0 max-w-full flex-[1_1_260px] self-stretch">
          <aside id="checklist" className="sticky top-[calc(var(--header-h)+20px)] flex scroll-mt-[calc(var(--header-h)+16px)] flex-col gap-[14px]">
            <PlanBox title="Start with your trip." sub="" button="Request suitable options" />
            <div className="border border-line bg-surface">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                <Image src="/images/light/chair-at-sunset.webp" alt="" aria-hidden fill sizes="320px" className="object-cover" />
              </div>
              <div className="px-[18px] py-4">
                <h3 className="font-serif text-[20px]">Keep these details ready.</h3>
                <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                  {READY.map((r) => (
                    <li key={r} className="flex items-center gap-[10px] font-serif text-[14px]">
                      <CheckDot />
                      {r}
                    </li>
                  ))}
                </ul>
                <WindowButton
                  label="Open the checklist →"
                  className={linkCls}
                  title="Before you commit"
                  sub="Your booking review checklist."
                  variant="drawer"
                >
                  <ChecklistWindow />
                </WindowButton>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Quote inclusions */}
      <section id="quote" className="mt-7 scroll-mt-[var(--header-h)] border-y border-line bg-surface">
        <div className="container-jn pb-5 pt-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-[30px] leading-[1.1]">Know what your quote includes.</h2>
              <p className="mt-1 text-[14px] text-steel">Compare the complete itinerary price and identify anything billed separately.</p>
            </div>
            <div className="text-right max-sm:text-left">
              <a
                href="https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/"
                target="_blank"
                rel="noopener noreferrer"
                className="rule-link !font-sans !text-[13px]"
              >
                NBAA proposal checklist ↗
              </a>
              <div className="text-[12px] text-steel">External guidance</div>
            </div>
          </div>
          <div className="mt-[14px] border border-line text-[13px]">
            <div className="grid bg-surface-2 font-bold [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))] max-sm:hidden">
              <span className="px-3 py-[9px]">Check</span>
              <span className="border-l border-line px-3 py-[9px]">What to clarify</span>
              <span className="border-l border-line px-3 py-[9px]">Where to find it</span>
            </div>
            {INCLUSIONS.map(([check, clarify, where], i) => (
              <div key={check} className={`grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))] ${i ? "border-t border-line" : "sm:border-t sm:border-line"}`}>
                <span className="px-3 py-[9px] max-sm:pb-0 max-sm:font-bold">{check}</span>
                <span className="border-l border-line px-3 py-[9px] text-steel max-sm:border-l-0 max-sm:py-0">{clarify}</span>
                <span className="border-l border-line px-3 py-[9px] max-sm:border-l-0 max-sm:pt-0">{where}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-surface-2 px-[14px] py-[10px] text-[13px]">
            <span className="flex items-center gap-[10px]">
              <span aria-hidden="true" className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">
                i
              </span>
              Ask for the total estimated price including applicable taxes and fees.
            </span>
            <WindowButton
              label="See an itemized example →"
              className="rule-link border-0 border-b bg-transparent p-0 !text-[14px]"
              title="An itemized example quote"
              sub="Every line, all-in — the way a JetNine quote reads."
            >
              <ExampleQuoteWindow />
            </WindowButton>
          </div>
        </div>
      </section>

      {/* Guidance */}
      <section id="guidance" className="container-jn scroll-mt-[var(--header-h)] pt-6">
        <p className="eyebrow !mb-2 !tracking-[0.2em]">Independent guidance</p>
        <h2 className="font-serif text-[34px] leading-[1.1]">Three checks before you commit.</h2>
        <div className="mt-[14px] grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {CHECKS.map((c) => (
            <div key={c.org} className="border border-t-2 border-line border-t-gold bg-surface px-[18px] py-4">
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold">{c.org}</div>
              <h3 className="mt-[6px] font-serif text-[20px]">{c.title}</h3>
              <p className="mb-[10px] mt-[6px] text-[13px] leading-[1.5] text-steel">{c.body}</p>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="rule-link !font-sans !text-[13px]">
                {c.link} ↗
              </a>
              <div className="mt-1 text-[12px] text-steel">{c.domain}</div>
            </div>
          ))}
        </div>
        <p className="mt-[10px] text-center text-[12px] text-steel">
          External sources provide independent guidance; no endorsement of JetNine is implied.
        </p>
      </section>

      {/* FAQ */}
      <section id="faqs" className="container-jn grid scroll-mt-[var(--header-h)] items-start gap-10 pt-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <p className="eyebrow !mb-2 !tracking-[0.2em]">Questions</p>
          <h2 className="font-serif text-[34px] leading-[1.1]">Before your first flight.</h2>
          <p className="mt-[10px] text-[14px] text-steel">Clear answers to common questions about chartering a private jet.</p>
        </div>
        <FaqList items={FAQ} />
      </section>

      {/* Guides */}
      <section className="container-jn pb-[26px] pt-7">
        <p className="eyebrow !mb-2 !tracking-[0.2em]">JetNine planning guides</p>
        <h2 className="font-serif text-[30px] leading-[1.1]">Explore the details when you need them.</h2>
        <div className="mt-[14px] grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          {GUIDES.map((g) => (
            <Link key={g.title} href={g.href} className="group block">
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                <Image src={g.img} alt="" aria-hidden fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
              </div>
              <div className="mt-[10px] text-[15px] font-bold">{g.title}</div>
              <p className="mb-2 mt-1 text-[13px] text-steel">{g.body}</p>
              <span className="border-b border-bone pb-px text-[13px] group-hover:text-gold">{g.link} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Kept from the previous page: the pricing-guide lead capture
          (fires pricing_guide_requested). */}
      <div className="[&>section]:!pt-10 [&>section]:pb-10">
        <GuideGate context="how-it-works" />
      </div>

      <CtaBand
        className="!mt-0"
        imageSrc="/images/light/wing-clouds.webp"
        imagePosition="right center"
        title="A clear brief is the first step."
        body="Share your plans. Review your options with confidence."
        primary={{ label: "Start a trip request", href: "/quote/mission" }}
        secondary={null}
      />
    </>
  );
}
