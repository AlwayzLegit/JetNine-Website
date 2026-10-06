import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide, GUIDE_AUTHORITIES } from "@/lib/guides";
import { BleedHero } from "@/components/guide-long/hero";
import { ChecklistWindow, MiniChecklist } from "@/components/guide-long/checklist";
import { NotesWindow } from "@/components/guide-long/windows";
import { FaqJsonLd, FaqList, type Faq } from "@/components/guide-long/faq";
import { GuideJsonLd } from "@/components/guide-long/jsonld";
import {
  AutoGrid,
  BTN,
  BrokerNote,
  CheckTable,
  ContinueStrip,
  H2,
  IconWell,
  Notice,
  StepRows,
  Sub,
  SourceRows,
  TINT_BG,
  TINT_BORDER,
  TripPrompt,
  UnderLink,
  WarnPanel,
} from "@/components/guide-long/ui";

const guide = getLongGuide("private-jet-charter-safety-checklist");

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter Safety Checklist — Before You Book",
  description: "Prepare for charter booking with a safety checklist covering the operating carrier, aircraft authorization, crew qualifications, insurance and substitution terms.",
  path: guide.href,
  image: guide.image,
});

const CHECKS = [
  "Carrier identity received",
  "Certificate requested",
  "Aircraft details received",
  "Crew questions answered",
  "Insurance evidence reviewed",
  "Change process understood",
];

const FAQ: Faq[] = [
  {
    q: "Does an aircraft registration prove charter authorization?",
    a: "Registration identifies the aircraft. Ask separately whether the operator is authorized to use it for your charter.",
  },
  {
    q: "What should I ask about the crew?",
    a: "Ask about crew qualifications, recent training, and how a crew substitution would be handled and communicated.",
  },
  {
    q: "How should I check an operator’s safety rating?",
    a: "Ask which program issued it, what was assessed, whether it is current, and whether it applies to the proposed operator.",
  },
];

const RATINGS = [
  { t: "ARGUS", b: "Check the exact rating, audit scope and current status.", link: "Explore ARGUS guidance", url: "https://www.argus.aero" },
  { t: "WYVERN", b: "Distinguish Registered status from Wingman certification.", link: "Read WYVERN standards", url: "https://www.wyvernltd.com" },
  { t: "IS-BAO", b: "A voluntary operating standard built around safety management.", link: "Explore IBAC guidance", url: "https://ibac.org/is-bao" },
];

export default function SafetyChecklistPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <BleedHero
        crumb="Charter safety"
        title={guide.title}
        titleMax="17ch"
        subtitle="Know the operator. Check the evidence. Ask about your specific flight."
        image="/images/light/ground-service-golden-hour.webp"
        actions={
          <>
            <ChecklistWindow
              label={
                <>
                  Open verification checklist <span aria-hidden="true">→</span>
                </>
              }
              className={BTN.bronze}
              items={CHECKS}
              storageKey="safety-guide"
            />
            <a href="#faqs" className={BTN.ghost}>
              Questions to ask <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        tabs={[
          { label: "Operator checks", href: "#checks" },
          { label: "Ratings explained", href: "#ratings" },
          { label: "Changes", href: "#changes" },
          { label: "FAQs", href: "#faqs" },
          { label: "Sources", href: "#sources" },
        ]}
      />

      <BrokerNote />

      <section className="container-jn flex flex-wrap items-start gap-[22px] pt-[22px]">
        <div id="checks" className="min-w-0 flex-[999_1_480px]">
          <H2 size={34}>Six questions before you book.</H2>
          <Sub>Use these questions to confirm the key details about your proposed flight.</Sub>
          <div className="mt-3">
            <CheckTable
              headers={["Ask", "Request or confirm"]}
              rows={[
                ["Who operates my flight?", "Legal carrier name and operating certificate."],
                ["Is this aircraft authorized?", "Proposed model, tail number and charter authorization."],
                ["Who will fly the aircraft?", "Crew qualifications, recent training and substitution policy."],
                ["What insurance applies?", "Current evidence, limits, exclusions and whose policy it is."],
                ["How are risks managed?", "Ask about safety management and emergency response processes."],
                ["What happens if details change?", "Notification, replacement details and applicable booking terms."],
              ]}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-10 gap-y-1">
            <UnderLink href={GUIDE_AUTHORITIES.faa.url} className="whitespace-nowrap">Start with FAA operator guidance</UnderLink>
            <UnderLink href="/safety/operator-vetting" className="whitespace-nowrap">How JetNine vets operators</UnderLink>
          </div>
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <div className={`border p-[18px] ${TINT_BG} ${TINT_BORDER}`}>
            <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1]">Your flight checklist</h2>
            <p className="mb-3 mt-[6px] text-[13px] text-steel">Use this list to keep track of what you’ve confirmed for your proposed trip.</p>
            <MiniChecklist
              size={18}
              items={["Carrier identified", "Aircraft details received", "Crew questions answered", "Insurance reviewed", "Changes explained"]}
            />
            <ChecklistWindow
              label="Open full checklist →"
              className="mt-4 h-10 w-full rounded-[2px] border-0 bg-gold text-[14px] font-bold text-white"
              items={CHECKS}
              storageKey="safety-guide"
            />
            <p className="mt-2 text-[12px] text-steel">A planning aid. Operational decisions remain with the operator.</p>
          </div>
          <div className="on-navy bg-navy p-[18px] text-white">
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1] text-white">Need help asking?</h2>
            <p className="mb-[14px] mt-[6px] text-[14px] text-navy-on-2">Keep the questions tied to your proposed trip.</p>
            <Link href="/contact" className="flex h-10 w-full items-center justify-center rounded-[2px] bg-white text-[14px] font-bold text-navy hover:bg-surface-2 hover:text-navy">
              Ask a safety question →
            </Link>
          </div>
        </aside>
      </section>

      <section id="ratings" className="container-jn pt-7">
        <H2 size={34}>Understand what a rating tells you.</H2>
        <Sub>These independent programs provide useful information, but each is different.</Sub>
        <AutoGrid min={180} className="mt-3">
          {RATINGS.map((r) => (
            <div key={r.t} className="grid grid-cols-[52px_minmax(0,1fr)] gap-4 border border-line bg-white px-[18px] py-4">
              <IconWell name="doc" />
              <div className="min-w-0">
                <div className="font-serif text-[20px]">{r.t}</div>
                <p className="mb-[6px] mt-1 text-[13px] leading-[1.5] text-steel">{r.b}</p>
                <UnderLink href={r.url} className="whitespace-nowrap">{r.link}</UnderLink>
              </div>
            </div>
          ))}
        </AutoGrid>
        <Notice className="mt-[10px]" action={<UnderLink href="/safety/ratings-explained" className="whitespace-nowrap">Ratings explained</UnderLink>}>
          Ratings provide context. They do not guarantee a safe flight.
        </Notice>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="changes">
            <H2 size={34}>If the aircraft or operator changes…</H2>
            <Sub>Follow these steps to reassess the details and your options.</Sub>
            <div className="mt-3">
              <StepRows
                rows={[
                  ["Confirm the replacement", "Ask for the carrier, aircraft and crew details."],
                  ["Recheck the evidence", "Review authorization and supporting information."],
                  ["Review your choices", "Check substitution, cancellation and refund terms."],
                ]}
              />
            </div>
            <NotesWindow
              drawer
              label="Open replacement checklist →"
              className="mt-3 h-10 rounded-[2px] border border-gold bg-white px-[22px] text-[14px] text-bone"
              title="If your flight details change."
              items={[
                "Identify the replacement operating carrier.",
                "Confirm the proposed aircraft and supporting evidence.",
                "Request any revised price, terms and contact details.",
                "Ask about your options in writing; do not assume identical terms.",
              ]}
              source={GUIDE_AUTHORITIES.nbaa}
            />
          </div>
          <WarnPanel
            id="warnings"
            title="Warning signs to question."
            sub="Be cautious if you encounter any of the following."
            items={[
              "Refusal to show charter authorization",
              "Evasive answers about the operator",
              "Pressure to accept operational control you do not understand.",
            ]}
            link={{ label: "FAA warning signs", href: GUIDE_AUTHORITIES.faa.url }}
          />
        </AutoGrid>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="faqs">
            <H2 size={30}>Clear answers before you commit.</H2>
            <FaqList items={FAQ} name="safety-faq" variant="disc" className="mt-[10px]" />
          </div>
          <div id="sources">
            <H2 size={30}>Start with the original guidance.</H2>
            <p className="mt-1 text-[13px] text-steel">Authoritative resources for charter requirements and consumer guidance.</p>
            <SourceRows
              stacked
              note="U.S. guidance shown. Other jurisdictions may have different requirements. Independent references; no endorsement implied."
              sources={[
                { org: "FAA · Charter legitimacy", label: "Operator authorization and warning signs", url: GUIDE_AUTHORITIES.faa.url },
                { org: "NBAA · Charter questions", label: "Aircraft, crew and substitution questions", url: GUIDE_AUTHORITIES.nbaa.url },
              ]}
            />
          </div>
        </AutoGrid>
      </section>

      <ContinueStrip
        links={[
          { label: "Choosing a charter company", href: "/guides/how-to-choose-a-charter-company" },
          { label: "Aircraft sizes", href: "/guides/private-jet-sizes-and-types" },
          { label: "Safety overview", href: "/safety" },
          { label: "Legal & agreement", href: "/legal" },
        ]}
      />
      <TripPrompt
        title="Get the details for your proposed flight."
        body="Discuss your plans with our team and get help evaluating your options."
        action={
          <Link href="/quote/mission" className={BTN.navy}>
            Discuss your flight →
          </Link>
        }
      />
    </>
  );
}
