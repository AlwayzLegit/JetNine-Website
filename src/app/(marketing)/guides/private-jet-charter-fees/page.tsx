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

const guide = getLongGuide("private-jet-charter-fees");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const CHECKS = ["Total trip price", "Taxes and fees", "Weather-related costs", "Extras and approval process", "Change and cancellation terms"];

const FAQ: Faq[] = [
  {
    q: "Does an all-inclusive quote cover every possible cost?",
    a: "Ask for the written inclusions, exclusions and conditions. Weather, itinerary changes or optional extras may affect the final amount. A JetNine quote includes flight time, fuel, crew, landing, repositioning, the 7.5% FET, standard catering and a sedan transfer; premium catering, de-icing and international handling are itemized separately.",
  },
  {
    q: "Why can a one-way trip include repositioning?",
    a: "The aircraft may need to fly empty to collect you or return to base. Ask whether those legs are priced into the quote.",
  },
  {
    q: "Is catering always included?",
    a: "Not always. Ask what is standard, what counts as a special request, and how extras are billed.",
  },
  {
    q: "When might additional charges be billed?",
    a: "Typically after the trip, for items such as de-icing, extra waiting time or itinerary changes. Ask when and how they are invoiced.",
  },
];

export default function CharterFeesPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <SplitHero
        crumb="Charter fees"
        kicker="Know your trip cost."
        title={guide.title}
        subtitle="Understand what is included—and what may cost extra."
        description="Repositioning, de-icing, catering, parking and other charges explained, with the questions to ask before you book."
        image="/images/light/page-30-hero.webp"
        actions={
          <>
            <a href="#charges" className={BTN.navy}>
              Explore the fees <span aria-hidden="true">↓</span>
            </a>
            <ChecklistWindow label="Open cost checklist" className={BTN.outline} items={CHECKS} storageKey="charter-fees" />
          </>
        }
      />

      <BrokerNote linkLabel="Broker disclosure" />

      <section className="container-jn flex flex-wrap items-start gap-7 pt-[26px]">
        <div className="min-w-0 max-w-full flex-[1_1_150px] self-stretch">
          <TocNav
            items={[
              { label: "Trip total", href: "#total" },
              { label: "Common charges", href: "#charges" },
              { label: "Before you approve", href: "#approve" },
              { label: "Trusted sources", href: "#sources" },
              { label: "Questions", href: "#faqs" },
            ]}
          />
        </div>

        <div id="total" className="min-w-0 flex-[999_1_240px] border-l border-line pl-6 max-sm:border-l-0 max-sm:pl-0">
          <H2 size={34}>Start with the complete trip price.</H2>
          <p className="mt-[6px] text-[15px] text-steel">
            An hourly rate is only one part of a quote. Ask which charges are included, which are estimates, and which may
            be invoiced separately.
          </p>
          <div className="my-4">
            <NumberCols
              variant="big"
              items={[
                { t: "Included", b: "Covered by the quoted total." },
                { t: "Estimated", b: "May change under the agreed terms." },
                { t: "Additional", b: "Payable separately if applicable." },
              ]}
            />
          </div>
          <div className="relative aspect-[16/8.5] overflow-hidden bg-surface-2">
            <Image src="/images/light/leather-duffel-on-seat.webp" alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
            <span className="absolute bottom-2 left-[10px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
              Illustrative cabin imagery
            </span>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <div className="border border-line bg-white p-[18px]">
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1]">Before you approve.</h2>
            <MiniChecklist items={CHECKS} className="mt-3" />
            <ChecklistWindow
              label="Open full checklist →"
              className="mt-[14px] h-[38px] rounded-[2px] border-0 bg-navy px-[18px] text-[13px] font-bold text-white"
              items={CHECKS}
              storageKey="charter-fees"
            />
            <p className="mt-2 text-[12px] text-steel">A planning aid: confirm the details for your trip.</p>
            <div className="mt-3 border-t border-surface-2 pt-3">
              <UnderLink href="/guides/how-to-compare-private-jet-quotes" className="whitespace-nowrap">
                Compare charter quotes
              </UnderLink>
            </div>
          </div>
          <div className="border border-line bg-white p-[18px]">
            <h2 className="m-0 font-serif text-[21px] font-normal leading-[1.1]">On a JetNine quote.</h2>
            <p className="mb-0 mt-[6px] text-[13px] leading-[1.5] text-steel">
              Included: flight time, fuel, crew, landing, repositioning, 7.5% FET, standard catering and a sedan transfer.
              Itemized separately, before you accept: premium catering, de-icing and international handling.
            </p>
          </div>
        </aside>
      </section>

      <section id="charges" className="container-jn pt-[30px]">
        <H2>The charges to check.</H2>
        <p className="mt-1 text-[14px] text-steel">Items may be bundled or charged separately. Your written quote and agreement determine what applies.</p>
        <div className="mt-3">
          <FlowTable
            headers={["Charge", "What it covers", "Ask before booking"]}
            rows={[
              ["Repositioning", "Moving the aircraft before or after your passenger flight.", "Are positioning legs included?"],
              ["De-icing / anti-icing", "Treatment required by weather and aircraft conditions.", "How is it priced and billed?"],
              ["Catering", "Meals, drinks and special requests.", "What is standard? What costs extra?"],
              ["Landing & handling", "Airport use and ground services.", "Are fees at every stop covered?"],
              ["Parking & hangar", "Aircraft storage during your stay.", "What period does the quote cover?"],
              ["Crew & overnight", "Trip-related crew travel and accommodation.", "Can schedule changes add costs?"],
              ["Taxes & other fees", "Applicable taxes, fuel surcharges or permit fees.", "What applies to this itinerary?"],
              ["Changes & cancellation", "Costs governed by the booking terms.", "What deadlines and charges apply?"],
            ]}
          />
        </div>
        <Notice action={<UnderLink href={GUIDE_AUTHORITIES.winter.url} className="whitespace-nowrap">FAA winter guidance</UnderLink>}>
          De-icing is an operational safety decision. Ask how costs are handled; required treatment is not an optional upgrade.
        </Notice>
      </section>

      <section id="approve" className="container-jn pt-[30px]">
        <H2>Get the important details in writing.</H2>
        <div className="mt-[14px]">
          <NumberCols
            items={[
              { t: "One comparable total.", b: "Ask for the estimated total including applicable taxes and fees." },
              { t: "A clear list of exclusions.", b: "Confirm who invoices each extra and when it becomes payable." },
              { t: "A plan for changes.", b: "Ask how revised costs are communicated and optional extras approved." },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px]">
          <Link href="/cost-calculator" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            Cost calculator →
          </Link>
          <span aria-hidden="true" className="text-line">
            |
          </span>
          <Link href="/guides/how-to-compare-private-jet-quotes" className="whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
            Compare quotes →
          </Link>
          <span aria-hidden="true" className="text-line">
            |
          </span>
          <Link href="/legal#cancellation" className="underline underline-offset-[3px] hover:text-gold">
            Read legal &amp; agreement →
          </Link>
        </div>
      </section>

      <section id="sources" className="container-jn pt-[30px]">
        <Overline>Independent guidance</Overline>
        <H2>Go to the original sources.</H2>
        <SourceCards
          note="Independent references; no endorsement implied. Rules vary by jurisdiction."
          sources={[
            { org: "NBAA", title: "Questions to ask about pricing.", body: "Review catering, crew, airport fees and cancellation terms.", link: "Charter quote checklist", url: GUIDE_AUTHORITIES.nbaa.url },
            { org: "U.S. DOT / eCFR", title: "Understand cost disclosures.", body: "For covered U.S. broker bookings, request total costs and directly payable third-party fees or estimates.", link: "14 CFR 295.24", url: GUIDE_AUTHORITIES.dot.url },
            { org: "FAA", title: "Why de-icing matters.", body: "Understand the safety purpose of removing aircraft ice and snow.", link: "Winter operations guidance", url: GUIDE_AUTHORITIES.winter.url },
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
          <H2>Clear answers before you book.</H2>
          <p className="mt-2 text-[13px] text-steel">Answers to common questions about private jet charter fees and additional charges.</p>
        </div>
        <FaqList items={FAQ} name="fees-faq" />
      </section>

      <section className="container-jn pb-[30px] pt-[30px]">
        <Overline>JetNine planning guides</Overline>
        <H2>Explore related guides.</H2>
        <RelatedCards
          items={[
            related("how-to-compare-private-jet-quotes", "See what to compare and ask for in a quote."),
            related("private-jet-broker-vs-operator", "Understand who does what and how it affects your trip."),
            related("empty-legs-explained", "Learn how empty legs work and what to consider."),
            related("private-jet-charter-safety-checklist", "Key safety practices and what to look for."),
          ]}
        />
      </section>

      <GuideBand
        title="Plan with a clearer picture of cost."
        body="Share your route, dates and preferences."
        image="/images/light/page-29-hero.webp"
        action={
          <Link href="/quote/mission" className={BTN.onNavy}>
            Discuss your trip →
          </Link>
        }
      />
    </>
  );
}
