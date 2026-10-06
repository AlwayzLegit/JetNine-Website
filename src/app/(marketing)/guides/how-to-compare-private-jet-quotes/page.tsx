import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide, GUIDE_AUTHORITIES } from "@/lib/guides";
import { BleedHero } from "@/components/guide-long/hero";
import { MiniChecklist } from "@/components/guide-long/checklist";
import { WorksheetAside, WorksheetWindow } from "@/components/guide-long/worksheet";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import {
  AutoGrid,
  BTN,
  BrokerNote,
  CheckTable,
  ContinueStrip,
  H2,
  Icon,
  IconCard,
  Notice,
  Sub,
  SourceRows,
  TINT_BG,
  TripPrompt,
  UnderLink,
  type IconName,
} from "@/components/guide-long/ui";

const guide = getLongGuide("how-to-compare-private-jet-quotes");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const FAQ: Faq[] = [
  {
    q: "Is the lowest headline price the lowest total?",
    a: "Only compare after clarifying inclusions, possible extras and written terms. Record unresolved items before choosing.",
  },
  {
    q: "Does the same jet category mean the same cabin?",
    a: "No. Models in one category can differ in seating, baggage space, connectivity and lavatory. Confirm the proposed aircraft.",
  },
  {
    q: "What if the aircraft changes after I accept?",
    a: "Ask how substitutions are handled, how you will be notified, and which terms apply to a replacement aircraft.",
  },
];

const LEGEND: [string, string][] = [
  ["Included", "bg-navy border-navy"],
  ["Extra", "bg-gold border-gold"],
  ["Unconfirmed", "bg-steel-dim border-steel-dim"],
];

const COSTS: [string, string, IconName][] = [
  ["Taxes & airport fees", "What is covered in the written total?", "coins"],
  ["Catering & ground transport", "Which services are included or billed separately?", "cater"],
  ["Crew & overnight costs", "What assumptions apply to your itinerary?", "person"],
  ["Weather-related charges", "How are de-icing or other contingencies handled?", "weather"],
];

export default function CompareQuotesPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <BleedHero
        crumb="Comparing charter quotes"
        title={guide.title}
        subtitle="Compare equivalent aircraft, included services and written terms."
        description="Start with the same trip. Clarify the complete cost. Resolve what is still unconfirmed."
        image="/images/light/notebook-sunset-window.webp"
        titleMax="18ch"
        actions={
          <>
            <WorksheetWindow
              label={
                <>
                  Open quote comparison <span aria-hidden="true">→</span>
                </>
              }
              className={BTN.bronze}
              storageKey="compare-quotes-worksheet"
            />
            <a href="#faqs" className={BTN.ghost}>
              What to check <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        tabs={[
          { label: "Compare like for like", href: "#checks" },
          { label: "Costs & extras", href: "#costs" },
          { label: "Booking terms", href: "#terms" },
          { label: "FAQs", href: "#faqs" },
          { label: "Sources", href: "#sources" },
        ]}
      />

      <BrokerNote />

      <section className="container-jn flex flex-wrap items-start gap-[22px] pt-[22px]">
        <div className="min-w-0 flex-[999_1_480px]">
          <div id="checks">
            <H2 size={34}>Put both quotes on the same basis.</H2>
            <Sub>Use this checklist to compare quotes for the same trip and understand what to match or clarify.</Sub>
            <div className="mt-3">
              <CheckTable
                headers={["Compare", "Details to match or clarify"]}
                rows={[
                  ["Itinerary", "Airports, dates, local times, stops and passenger count."],
                  ["Aircraft", "Model, actual seating, baggage capacity and cabin amenities."],
                  ["Operator", "Operating carrier, charter authorization and broker role."],
                  ["Services", "Catering, Wi-Fi, ground transport and special requests."],
                  ["Complete cost", "Total, taxes, fees, currency and charges paid separately."],
                  ["Written terms", "Quote expiry, payment, changes, cancellation and substitutions."],
                ]}
              />
            </div>
            <div className="mt-2">
              <UnderLink href={GUIDE_AUTHORITIES.nbaa.url}>NBAA: questions to include in your quote request</UnderLink>
            </div>
          </div>

          <div id="costs" className="mt-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <H2 size={34}>Mark every cost clearly.</H2>
                <Sub>Ask the provider to identify the status of each item.</Sub>
              </div>
              <div className="flex flex-wrap gap-2">
                {LEGEND.map(([t, c]) => (
                  <span key={t} className={`inline-flex h-7 items-center gap-2 rounded-[14px] border bg-white px-3 text-[13px] ${c.split(" ")[1]}`}>
                    <span className={`h-[10px] w-[10px] rounded-full ${c.split(" ")[0]}`} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <AutoGrid className="mt-3">
              {COSTS.map(([t, b, i]) => (
                <IconCard key={t} icon={i} title={t}>
                  {b}
                </IconCard>
              ))}
            </AutoGrid>
            <Notice tone="warn" className="mt-[10px]">
              An unconfirmed cost is not zero. Ask who pays it and how it is calculated. JetNine quotes are all-in; anything
              billed at cost, such as de-icing, is flagged on the quote.
            </Notice>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <WorksheetAside
            title="Your quote worksheet"
            body="Use this worksheet to keep track of details as you review and compare quotes."
            placeholders={["Quote A", "Quote B"]}
            checks={["Same trip requirements", "Aircraft differences noted", "Costs clarified", "Terms compared"]}
            button="Build my comparison →"
            buttonClass="h-10 cursor-pointer rounded-[2px] border-0 bg-gold text-[14px] font-bold text-white"
            note="Track differences and unanswered questions."
            storageKey="compare-quotes-worksheet"
          />
          <div className="on-navy bg-navy p-[18px] text-white">
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1] text-white">Need a line explained?</h2>
            <p className="mb-[14px] mt-[6px] text-[14px] text-navy-on-2">Ask what is included and when the price can change.</p>
            <Link href="/contact" className="flex h-10 w-full items-center justify-center rounded-[2px] bg-white text-[14px] font-bold text-navy hover:bg-surface-2 hover:text-navy">
              Ask JetNine →
            </Link>
          </div>
        </aside>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="aircraft">
            <H2 size={34}>Compare the aircraft behind the category.</H2>
            <Sub>Aircraft within the same category can vary. Confirm the details that matter.</Sub>
            <div className="mt-3 border border-line bg-white">
              {(
                [
                  ["Confirm the proposed model and layout.", "plane"],
                  ["Check baggage, connectivity and lavatory needs.", "bag"],
                  ["Ask what can be substituted and how you are notified.", "gear"],
                ] as [string, IconName][]
              ).map(([t, d], i) => (
                <div key={t} className={`flex items-center gap-[18px] px-4 py-[9px] ${i ? "border-t border-surface-2" : ""}`}>
                  <Icon name={d} size={20} />
                  <span className="text-[14px] text-bone-2">{t}</span>
                </div>
              ))}
            </div>
            <UnderLink href="/guides/private-jet-sizes-and-types" className="mt-2 inline-block whitespace-nowrap">
              Private jet sizes explained
            </UnderLink>
          </div>
          <div id="terms" className={`px-5 py-[18px] ${TINT_BG}`}>
            <H2 size={30}>Before you accept</H2>
            <p className="mt-1 text-[14px] text-steel">Review these key items in the written quote.</p>
            <MiniChecklist
              size={18}
              className="mt-[10px]"
              items={["Quote validity and availability", "Payment deadlines", "Cancellation and refund terms", "Replacement arrangements"]}
            />
            <UnderLink href="/legal#quotes-bookings" className="mt-[10px] inline-block whitespace-nowrap">
              Read booking terms
            </UnderLink>
          </div>
        </AutoGrid>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="faqs">
            <H2 size={30}>Questions that prevent surprises.</H2>
            <FaqList items={FAQ} name="quotes-faq" variant="disc" className="mt-[10px]" />
            <UnderLink href="/guides/private-jet-charter-safety-checklist" className="mt-2 inline-block whitespace-nowrap">
              Charter safety: what to verify
            </UnderLink>
          </div>
          <div id="sources">
            <H2 size={30}>Use the original guidance.</H2>
            <p className="mt-1 text-[13px] text-steel">Authoritative resources on charter quotes, operator requirements and costs.</p>
            <SourceRows
              note="U.S. guidance shown. Independent references; no endorsement implied."
              sources={[
                { org: "NBAA", label: "Aircraft, service and pricing questions", url: GUIDE_AUTHORITIES.nbaa.url },
                { org: "DOT rules · eCFR Part 295", label: "Broker disclosures and costs", url: GUIDE_AUTHORITIES.dot.url },
                { org: "FAA", label: "Verify operator authorization", url: GUIDE_AUTHORITIES.faa.url },
              ]}
            />
          </div>
        </AutoGrid>
      </section>

      <ContinueStrip
        links={[
          { label: "Choosing a charter company", href: "/guides/how-to-choose-a-charter-company" },
          { label: "Cost calculator", href: "/cost-calculator" },
          { label: "Aircraft sizes", href: "/guides/private-jet-sizes-and-types" },
          { label: "Legal & agreement", href: "/legal" },
        ]}
      />
      <TripPrompt
        title="Get a quote you can understand."
        body="Discuss your trip with our team and get help evaluating your options."
        action={
          <Link href="/quote/mission" className={BTN.bronze}>
            Discuss your trip →
          </Link>
        }
      />
    </>
  );
}
