import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide, GUIDE_AUTHORITIES } from "@/lib/guides";
import { SplitHero } from "@/components/guide-long/hero";
import { TocNav } from "@/components/guide-long/toc";
import { ChecklistWindow, MiniChecklist } from "@/components/guide-long/checklist";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import { related } from "@/components/guide-long/related";
import {
  BTN,
  BrokerNote,
  FlowTable,
  GuideBand,
  H2,
  Notice,
  NumberCols,
  Overline,
  RelatedCards,
  SourceCards,
  UnderLink,
} from "@/components/guide-long/ui";

const guide = getLongGuide("private-jet-broker-vs-operator");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const CHECKS = ["Operating carrier identified", "Broker role explained", "Aircraft details received", "Price and terms reviewed", "Trip contact confirmed"];

const FAQ: Faq[] = [
  {
    q: "Does booking through a broker mean the broker flies the aircraft?",
    a: "No. The operating carrier performs the flight. Confirm its identity and the broker’s role in your agreement. On a JetNine booking, the operating carrier and tail number are stated on your trip sheet before you sign.",
  },
  {
    q: "What does operational control mean?",
    a: "It is the authority over starting, conducting and ending a flight. The operating carrier holds it, not the broker or the passenger.",
  },
  {
    q: "Who tells me if the operator changes?",
    a: "Ask who will notify you, how quickly, and whether the new carrier and aircraft will be confirmed in writing.",
  },
  {
    q: "Where can I check charter authorization?",
    a: "Ask for the operator’s certificate details and use the FAA guidance linked on this page to understand what to verify.",
  },
];

export default function BrokerVsOperatorPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <SplitHero
        crumb="Broker vs. operator"
        kicker="Know who does what"
        title={guide.title}
        subtitle="Who arranges your charter. Who operates your flight."
        description="Understand the responsibilities and the details to confirm before booking."
        image="/images/light/page-29-hero.webp"
        actions={
          <>
            <a href="#difference" className={BTN.navy}>
              Compare the roles <span aria-hidden="true">↓</span>
            </a>
            <ChecklistWindow label="Open booking checklist" className={BTN.outline} items={CHECKS} storageKey="broker-operator" />
          </>
        }
      />

      <BrokerNote />

      <section className="container-jn flex flex-wrap items-start gap-7 pt-[26px]">
        <div className="min-w-0 max-w-full flex-[1_1_150px] self-stretch">
          <TocNav
            items={[
              { label: "The difference", href: "#difference" },
              { label: "Responsibilities", href: "#responsibilities" },
              { label: "What to confirm", href: "#confirm" },
              { label: "Trusted guidance", href: "#sources" },
              { label: "Questions", href: "#faqs" },
            ]}
          />
        </div>

        <div id="difference" className="min-w-0 flex-[999_1_240px] border-l border-line pl-6 max-sm:border-l-0 max-sm:pl-0">
          <H2 size={34}>Two roles. Different responsibilities.</H2>
          <p className="mt-[6px] text-[15px] text-steel">
            You can book through a broker or directly with an operator. When a broker arranges your charter, confirm which
            carrier will operate the flight.
          </p>
          <div id="responsibilities">
            {[
              {
                n: "01",
                t: "The charter broker",
                s: "Arranges and coordinates.",
                b: "A broker helps source aircraft, compare proposals and coordinate the booking with the operating carrier. JetNine acts as a broker.",
                link: "How to choose a charter company",
                href: "/guides/how-to-choose-a-charter-company",
              },
              {
                n: "02",
                t: "The aircraft operator",
                s: "Operates the flight.",
                b: "The operating carrier has operational control and is responsible for the flight’s operational requirements.",
                link: "What to verify about the operator",
                href: "/guides/private-jet-charter-safety-checklist",
              },
            ].map((r, i) => (
              <div key={r.n} className={`grid grid-cols-[76px_minmax(0,1fr)] gap-5 py-5 max-sm:grid-cols-[52px_minmax(0,1fr)] ${i === 0 ? "border-b border-line" : ""}`}>
                <span className="font-serif leading-none text-gold" style={{ fontSize: "clamp(34px, 9vw, 44px)" }}>
                  {r.n}
                </span>
                <div>
                  <div className="font-serif text-[22px] leading-[1.2]">{r.t}</div>
                  <div className="font-serif text-[18px] text-bone-2">{r.s}</div>
                  <p className="mb-2 mt-[6px] max-w-[52ch] text-[14px] text-steel">{r.b}</p>
                  <UnderLink href={r.href} className="whitespace-nowrap">
                    {r.link}
                  </UnderLink>
                </div>
              </div>
            ))}
          </div>
          <div className="relative aspect-[16/8.5] overflow-hidden bg-surface-2">
            <Image src="/images/light/lounge-golden-hour.webp" alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
            <span className="absolute bottom-2 left-[10px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
              Illustrative cabin
            </span>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <div className="border border-line bg-white p-[18px]">
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1]">Before you book.</h2>
            <MiniChecklist items={CHECKS} className="mt-3" />
            <ChecklistWindow
              label="Open full checklist →"
              className="mt-[14px] h-[38px] rounded-[2px] border-0 bg-navy px-[18px] text-[13px] font-bold text-white"
              items={CHECKS}
              storageKey="broker-operator"
            />
            <p className="mt-2 text-[12px] text-steel">A planning aid: confirm the details for your trip.</p>
          </div>
          <div className="border border-line bg-white">
            <div className="relative aspect-[3/2.4] bg-surface-2">
              <Image src="/images/light/warm-midsize-cabin.webp" alt="" fill sizes="(max-width: 768px) 100vw, 320px" className="object-cover" />
            </div>
            <div className="px-4 py-[14px]">
              <h2 className="m-0 font-serif text-[21px] font-normal leading-[1.1]">Keep the roles clear.</h2>
              <p className="mb-2 mt-[6px] text-[13px] text-steel">Having a clear understanding helps you book with confidence.</p>
              <UnderLink href="/contact">Ask a question</UnderLink>
            </div>
          </div>
        </aside>
      </section>

      <section id="who" className="container-jn pt-[30px]">
        <H2>Who handles each part of your trip?</H2>
        <div className="mt-3">
          <FlowTable
            headers={["Your question", "Charter broker", "Aircraft operator"]}
            rows={[
              ["Aircraft options", "Sources and presents options", "Confirms operational suitability"],
              ["Booking coordination", "Coordinates proposal and arrangements", "Confirms the operating commitment"],
              ["Crew and aircraft", "Requests and communicates details", "Responsible for operational requirements"],
              ["Flight decisions", "Communicates updates", "Holds operational control"],
            ]}
          />
        </div>
        <Notice>Ask which role each company is acting in for your specific booking.</Notice>
      </section>

      <section id="confirm" className="container-jn pt-[30px]">
        <H2>Get the important details in writing.</H2>
        <div className="mt-[14px]">
          <NumberCols
            items={[
              { t: "Identify the carrier.", b: "Request its legal name, certificate information and proposed aircraft." },
              { t: "Clarify the broker’s role.", b: "Ask whether it acts as your agent, the carrier’s agent or an indirect air carrier." },
              { t: "Review costs and disclosures.", b: "Ask about total costs, separate charges and broker insurance disclosures." },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px]">
          <Link href="/guides/how-to-compare-private-jet-quotes" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            Compare charter quotes →
          </Link>
          <span aria-hidden="true" className="text-line">
            |
          </span>
          <Link href="/legal#part-295" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            Read legal &amp; agreement →
          </Link>
        </div>
      </section>

      <section id="sources" className="container-jn pt-[30px]">
        <Overline>Independent guidance</Overline>
        <H2>Go to the original sources.</H2>
        <SourceCards
          note="Independent references; no endorsement implied. U.S. rules may differ from other jurisdictions."
          sources={[
            { org: "FAA", title: "Verify charter authorization.", body: "Ask to see the operator’s certificate and confirm aircraft authorization.", link: "FAA charter guidance", url: GUIDE_AUTHORITIES.faa.url },
            { org: "U.S. DOT / eCFR", title: "Understand broker disclosures.", body: "Read the rules covering broker roles and customer disclosures.", link: "Read 14 CFR Part 295", url: GUIDE_AUTHORITIES.dot.url },
            { org: "The Air Charter Association", title: "Understand the broker’s work.", body: "Explore sourcing, due diligence and coordination responsibilities.", link: "Using a charter broker", url: GUIDE_AUTHORITIES.aca.url },
          ]}
        />
      </section>

      <section
        id="faqs"
        className="container-jn grid items-start gap-10 pt-[30px]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
      >
        <div>
          <Overline>Questions</Overline>
          <H2>Know who flies you.</H2>
          <p className="mt-2 text-[13px] text-steel">Clear answers to common questions about brokers, operators and your charter.</p>
        </div>
        <FaqList items={FAQ} name="broker-faq" />
      </section>

      <section className="container-jn pb-[30px] pt-[30px]">
        <Overline>JetNine planning guides</Overline>
        <H2>Keep planning with clarity.</H2>
        <RelatedCards
          items={[
            related("how-to-choose-a-charter-company", "Compare service and transparency."),
            related("private-jet-charter-safety-checklist", "Know what evidence to request.", "View safety checks"),
            related("how-to-compare-private-jet-quotes", "Review aircraft, services and terms.", "Compare quotes"),
            related("how-to-book-a-private-jet", "Follow the booking steps.", "Explore the process"),
          ]}
        />
      </section>

      <GuideBand
        title="Start with a clear trip brief."
        body="Share your route, dates and cabin needs."
        image="/images/light/page-30-hero.webp"
        action={
          <Link href="/quote/mission" className={BTN.onNavy}>
            Discuss your trip →
          </Link>
        }
      />
    </>
  );
}
