import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide, GUIDE_AUTHORITIES } from "@/lib/guides";
import { BleedHero } from "@/components/guide-long/hero";
import { ChecklistWindow } from "@/components/guide-long/checklist";
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
  IconCard,
  StepRows,
  Sub,
  SourceRows,
  TripPrompt,
  UnderLink,
  WarnPanel,
} from "@/components/guide-long/ui";

const guide = getLongGuide("how-to-choose-a-charter-company");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const CHECKS = ["Provider role clear", "Operating carrier disclosed", "Aircraft fit reviewed", "Comparable total received", "Terms and contact confirmed"];

const FAQ: Faq[] = [
  {
    q: "Does a safety rating guarantee a safe flight?",
    a: "No. Ask what was assessed, whether the rating is current, and how it applies to the operator proposed for your trip.",
  },
  {
    q: "What should a complete charter quote show?",
    a: "The aircraft, operator, itinerary, total price, included services, possible extra charges, and change and cancellation terms.",
  },
  {
    q: "What happens if the aircraft or operator changes?",
    a: "Ask how substitutions are handled, who will tell you, and whether revised details and terms will be confirmed in writing.",
  },
];

export default function ChooseCompanyPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <BleedHero
        crumb="Choosing a charter company"
        title={guide.title}
        subtitle="Compare service, transparency and reliability before you book."
        description="Know who operates your flight. Understand the total price. Get the important details in writing."
        image="/images/light/lounge-conversation-wheelchair.webp"
        titleMax="16ch"
        actions={
          <>
            <ChecklistWindow
              label={
                <>
                  Open comparison checklist <span aria-hidden="true">→</span>
                </>
              }
              className={BTN.bronze}
              items={CHECKS}
              storageKey="choose-company"
            />
            <a href="#faqs" className={BTN.ghost}>
              Questions to ask <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        tabs={[
          { label: "Key checks", href: "#checks" },
          { label: "Broker or operator?", href: "#roles" },
          { label: "Compare quotes", href: "#compare" },
          { label: "Warning signs", href: "#warnings" },
          { label: "FAQs", href: "#faqs" },
        ]}
      />

      <BrokerNote />

      <section className="container-jn flex flex-wrap items-start gap-[22px] pt-[22px]">
        <div className="min-w-0 flex-[999_1_480px]">
          <div id="checks">
            <H2 size={34}>Six checks before you choose.</H2>
            <Sub>Use this checklist to ask the right questions and compare providers on the details that matter.</Sub>
            <div className="mt-3">
              <CheckTable
                headers={["Check", "What to request"]}
                rows={[
                  ["Who operates the flight?", "Carrier identity, certificate and broker role."],
                  ["What supports safety claims?", "Current operator evidence and insurance details."],
                  ["Does the aircraft fit?", "Specific aircraft, cabin layout, baggage and crew information."],
                  ["Is the price clear?", "Written total, inclusions and possible additional charges."],
                  ["What if plans change?", "Cancellation, refund and replacement-aircraft terms."],
                  ["Who will support you?", "Named contact, contact hours and escalation process."],
                ]}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-10 gap-y-1">
              <UnderLink href={GUIDE_AUTHORITIES.faa.url} className="whitespace-nowrap">FAA: verify charter authorization</UnderLink>
              <UnderLink href={GUIDE_AUTHORITIES.nbaa.url} className="whitespace-nowrap">NBAA: charter questions</UnderLink>
            </div>
          </div>

          <div id="roles" className="mt-7">
            <H2 size={34}>Understand who does what.</H2>
            <Sub>Charter involves different roles. Know the difference and confirm each before you book.</Sub>
            <AutoGrid className="mt-3">
              <IconCard icon="broker" title="Charter broker">
                Arranges the charter and coordinates with the operating carrier. Ask which role the broker is acting in.
              </IconCard>
              <IconCard icon="plane" title="Aircraft operator">
                Operates the aircraft and holds operational control. Verify the proposed carrier.
              </IconCard>
            </AutoGrid>
            <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
              <UnderLink href="/guides/private-jet-broker-vs-operator" className="whitespace-nowrap">Broker vs. operator, explained</UnderLink>
              <UnderLink href="/legal#part-295" className="whitespace-nowrap">Broker disclosure &amp; booking terms</UnderLink>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <WorksheetAside
            title="Compare providers"
            body="Use this worksheet to keep track of what you’ve confirmed with each company."
            placeholders={["Provider A", "Provider B", "Provider C"]}
            checks={["Operator identified", "Quote understood", "Terms reviewed", "Support explained"]}
            button="Open comparison worksheet →"
            buttonClass="h-10 cursor-pointer rounded-[2px] border-0 bg-navy text-[14px] font-bold text-white"
            note="A decision aid, not a safety certification."
            storageKey="choose-company-worksheet"
          />
          <div className="on-navy bg-navy p-[18px] text-white">
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1] text-white">A question about your quote?</h2>
            <p className="mb-[14px] mt-[6px] text-[14px] text-navy-on-2">Ask what is included and what still needs confirming.</p>
            <Link href="/contact" className="flex h-10 w-full items-center justify-center rounded-[2px] bg-white text-[14px] font-bold text-navy hover:bg-surface-2 hover:text-navy">
              Ask JetNine →
            </Link>
          </div>
        </aside>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="compare">
            <H2 size={34}>Compare the same trip.</H2>
            <Sub>Get an accurate comparison by keeping key details consistent.</Sub>
            <div className="mt-3">
              <StepRows
                rows={[
                  ["Same requirements", "Route, dates, passengers, bags and cabin needs."],
                  ["Same price basis", "Compare the total and possible extras."],
                  ["Same written terms", "Review changes, cancellations and substitutions."],
                ]}
              />
            </div>
            <WorksheetWindow
              label="Build my comparison →"
              className="mt-3 h-10 rounded-[2px] border border-gold bg-white px-[22px] text-[14px] text-bone"
              cols={["Provider A", "Provider B", "Provider C"]}
              storageKey="choose-company-worksheet"
            />
          </div>
          <WarnPanel
            id="warnings"
            title="Pause and ask more if…"
            items={["The operator is unclear.", "Authorization evidence is withheld.", "Important charges or terms remain unexplained."]}
            link={{ label: "FAA charter warning signs", href: GUIDE_AUTHORITIES.faa.url }}
          />
        </AutoGrid>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="faqs">
            <H2 size={30}>Questions worth asking.</H2>
            <FaqList items={FAQ} name="company-faq" variant="disc" className="mt-[10px]" />
          </div>
          <div id="sources">
            <H2 size={30}>Check the original guidance.</H2>
            <p className="mt-1 text-[13px] text-steel">See authoritative resources for charter requirements and consumer guidance.</p>
            <SourceRows
              note="U.S. guidance. Requirements vary by jurisdiction. Independent references; no endorsement implied."
              sources={[
                { org: "FAA", label: "Verify charter legitimacy", url: GUIDE_AUTHORITIES.faa.url },
                { org: "NBAA", label: "Questions for charter providers", url: GUIDE_AUTHORITIES.nbaa.url },
                { org: "eCFR · Part 295", label: "Broker roles and disclosures", url: GUIDE_AUTHORITIES.dot.url },
              ]}
            />
          </div>
        </AutoGrid>
      </section>

      <ContinueStrip
        links={[
          { label: "Charter safety", href: "/guides/private-jet-charter-safety-checklist" },
          { label: "Aircraft sizes", href: "/guides/private-jet-sizes-and-types" },
          { label: "Cost calculator", href: "/cost-calculator" },
          { label: "Legal & agreement", href: "/legal" },
        ]}
      />
      <TripPrompt
        title="Get clear answers before you commit."
        body="Discuss your plans with our team and get help evaluating your options."
        action={
          <Link href="/quote/mission" className={BTN.navy}>
            Discuss your trip →
          </Link>
        }
      />
    </>
  );
}
