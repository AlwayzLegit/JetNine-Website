import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { getLongGuide, GUIDE_AUTHORITIES } from "@/lib/guides";
import { BleedHero } from "@/components/guide-long/hero";
import { ChecklistWindow } from "@/components/guide-long/checklist";
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
  Sub,
  SourceRows,
  TINT_BG,
  TINT_BORDER,
  TripPrompt,
  UnderLink,
  type IconName,
} from "@/components/guide-long/ui";

const guide = getLongGuide("empty-legs-explained");

export const metadata: Metadata = pageMetadata({
  title: guide.title,
  description: guide.description,
  path: guide.href,
  image: guide.image,
});

const CHECKS = ["Dates flexible enough", "Airports workable", "Total price reviewed", "Operator identified", "Backup travel considered"];

const FAQ: Faq[] = [
  {
    q: "Can an empty-leg flight be cancelled?",
    a: "Yes. Changes to the underlying trip or aircraft can affect the flight. Check the written terms and keep a backup plan. Empty legs carry stricter terms than on-demand charter; JetNine states them on the trip sheet.",
  },
  {
    q: "Is the return flight included?",
    a: "Usually not. An empty leg is normally one-way. Arrange and price the return separately.",
  },
  {
    q: "Will I automatically receive a replacement flight?",
    a: "Not necessarily. Ask what happens if the flight is cancelled and whether any alternative would be offered or priced separately.",
  },
];

const FEATS: [string, string, IconName][] = [
  ["Why it can cost less", "Selling unused positioning capacity can offset operating costs.", "coins"],
  ["What is constrained", "The available route and departure window follow the aircraft.", "cal"],
  ["What to plan separately", "Your return journey and a backup if plans change.", "plane"],
];

const VS: [string, string, string][] = [
  ["Schedule", "Fits an existing movement", "Requested around your itinerary"],
  ["Aircraft choice", "Limited to the available aircraft", "Sourced for your requirements"],
  ["Availability", "Can change with the underlying trip", "Subject to sourcing and confirmation"],
  ["Return travel", "Arrange separately", "Can be included in your request"],
];

const COST: [string, string, IconName][] = [
  ["Is the price for the whole aircraft?", "Confirm what is included and what might be extra.", "doc"],
  ["Which taxes, fees and services are included?", "Look for airport fees, handling, crew, catering and other charges.", "coins"],
  ["What might you pay if you need another option?", "Consider the cost and timing of a backup plan.", "person"],
];

export default function EmptyLegsExplainedPage() {
  return (
    <>
      <GuideJsonLd title={guide.title} description={guide.description} path={guide.href} crumb={guide.navTitle} datePublished="2026-10-05" />
      <FaqJsonLd items={FAQ} />

      <BleedHero
        crumb="Empty legs"
        title={guide.title}
        titleMax="20ch"
        subtitle="Potential savings. Limited flexibility. Know the trade-offs."
        description="An empty leg is a repositioning flight that may be offered for charter. It depends on an aircraft’s existing movements."
        image="/images/light/twin-engine-jet-golden-hour.webp"
        bleedWidth="50%"
        fade="linear-gradient(90deg,rgba(247,245,240,1) 0%,rgba(247,245,240,.97) 52%,rgba(247,245,240,.4) 66%,rgba(247,245,240,0) 82%)"
        actions={
          <>
            <Link href="/empty-legs" className={BTN.bronze}>
              Browse empty legs <span aria-hidden="true">→</span>
            </Link>
            <a href="#compare" className={BTN.ghost}>
              Is it right for my trip? <span aria-hidden="true">↓</span>
            </a>
          </>
        }
        tabs={[
          { label: "How it works", href: "#how" },
          { label: "Savings", href: "#savings" },
          { label: "Availability", href: "#availability" },
          { label: "Before booking", href: "#before" },
          { label: "FAQs", href: "#faqs" },
        ]}
      />

      <BrokerNote linkLabel="Broker disclosure" />

      <section id="how" className="container-jn pt-3">
        <AutoGrid min={180}>
          {FEATS.map(([t, b, d]) => (
            <div key={t} className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-4 border border-line bg-white px-[18px] py-[14px]">
              <IconWell name={d} />
              <div>
                <div className="font-serif text-[19px] leading-[1.2]">{t}</div>
                <p className="mt-1 text-[13px] leading-[1.45] text-steel">{b}</p>
              </div>
            </div>
          ))}
        </AutoGrid>
      </section>

      <section className="container-jn flex flex-wrap items-start gap-[22px] pt-[22px]">
        <div className="min-w-0 flex-[999_1_480px]">
          <div id="compare">
            <H2 size={34}>Empty leg or on-demand charter?</H2>
            <Sub>Both options can be a great way to fly. They work differently.</Sub>
            <div className="mt-3 overflow-x-auto border border-line bg-white" role="region" aria-label="Empty leg compared with on-demand charter" tabIndex={0}>
              <table className="w-full min-w-[480px] border-collapse text-[14px]">
                <thead>
                  <tr className="bg-surface-2 font-serif text-[15px]">
                    {["Consideration", "Empty leg", "On-demand charter"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2 text-left font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VS.map(([k, a, b]) => (
                    <tr key={k} className="border-t border-surface-2">
                      <th scope="row" className="px-4 py-2 text-left font-serif text-[16px] font-normal">
                        {k}
                      </th>
                      <td className="px-4 py-2 text-bone-2">{a}</td>
                      <td className="px-4 py-2 text-bone-2">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-[6px] text-[13px] text-steel">Neither option removes weather or operational disruption.</p>
          </div>

          <div id="savings" className="mt-[26px]">
            <H2 size={34}>Compare the complete trip cost.</H2>
            <Sub>Check the written price, extras, return travel and backup arrangements.</Sub>
            <div className="mt-3 flex flex-col gap-[6px]">
              {COST.map(([t, b, d]) => (
                <div key={t} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-4 border border-line bg-white px-4 py-[10px]">
                  <IconWell name={d} size={44} />
                  <div>
                    <div className="font-serif text-[17px]">{t}</div>
                    <div className="text-[13px] text-steel">{b}</div>
                  </div>
                </div>
              ))}
            </div>
            <UnderLink href="/guides/how-to-compare-private-jet-quotes" className="mt-2 inline-block whitespace-nowrap">
              How to compare charter quotes
            </UnderLink>
          </div>
        </div>

        <aside id="availability" className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          <div className="bg-navy p-[18px] text-white">
            <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-white">Find a possible match.</h2>
            <p className="mb-[14px] mt-[6px] text-[13px] text-navy-on-2">
              The live board lists current empty-leg flights. Add your routes to the watchlist and we text you when one fits.
            </p>
            <Link href="/empty-legs" className="flex h-10 w-full items-center justify-center rounded-[2px] bg-gold text-[14px] font-bold text-white hover:text-white hover:brightness-110">
              Browse empty-leg options →
            </Link>
            <Link href="/empty-legs#watchlist" className="mt-2 flex h-10 w-full items-center justify-center rounded-[2px] border border-[rgba(255,255,255,0.6)] text-[14px] font-bold text-white hover:text-white">
              Set a route watchlist
            </Link>
            <p className="mt-2 text-[12px] text-navy-on-2">Listings require confirmation. No match is guaranteed.</p>
          </div>
          <div className={`border p-[18px] ${TINT_BG} ${TINT_BORDER}`}>
            <h2 className="m-0 font-serif text-[24px] font-normal leading-[1.1]">When timing is fixed.</h2>
            <p className="mb-[14px] mt-[6px] text-[14px] text-steel">Compare on-demand options and decide how you would handle a disruption.</p>
            <Link href="/contact" className="flex h-10 w-full items-center justify-center rounded-[2px] border border-bone bg-white text-[14px] font-bold text-bone hover:text-gold">
              Discuss alternatives →
            </Link>
          </div>
        </aside>
      </section>

      <section className="container-jn pt-7">
        <AutoGrid gap="gap-[22px]" className="items-start">
          <div id="before">
            <H2 size={34}>Six checks before you commit.</H2>
            <Sub>Use this checklist to confirm the details and ask the right questions.</Sub>
            <div className="mt-3">
              <CheckTable
                compact
                headers={["Confirm", "Ask for"]}
                rows={[
                  ["Actual availability", "Current status and when the offer expires."],
                  ["Route & timing", "Exact airports and permitted departure window."],
                  ["Aircraft & operator", "Carrier identity, authorization and cabin suitability."],
                  ["Complete price", "Total, inclusions and possible extra charges."],
                  ["Cancellation & changes", "Written refund, substitution and rebooking terms."],
                  ["Your backup plan", "Return transport and an alternative if needed."],
                ]}
              />
            </div>
            <ChecklistWindow
              label="Open empty-leg booking checklist →"
              className="mt-2 border-0 bg-transparent p-0 text-[13px] text-bone underline underline-offset-[3px] hover:text-gold"
              items={CHECKS}
              storageKey="empty-legs-guide"
            />
          </div>
          <div>
            <div id="faqs">
              <H2 size={30}>Questions before booking.</H2>
              <FaqList items={FAQ} name="legs-faq" variant="disc" className="mt-[10px]" />
            </div>
            <div id="sources" className="mt-[22px]">
              <H2 size={30}>Read the original guidance.</H2>
              <p className="mt-1 text-[13px] text-steel">Helpful information from independent sources.</p>
              <SourceRows
                note="U.S. guidance shown. Independent references; no endorsement implied."
                sources={[
                  { org: "FAA", label: "Verify charter authorization", url: GUIDE_AUTHORITIES.faa.url },
                  { org: "NBAA", label: "Compare costs and terms", url: GUIDE_AUTHORITIES.nbaa.url },
                  { org: "DOT rules · eCFR", label: "Broker disclosures", url: GUIDE_AUTHORITIES.dot.url },
                  { org: "Air Charter Association", label: "Using a charter broker", url: GUIDE_AUTHORITIES.aca.url },
                ]}
              />
            </div>
          </div>
        </AutoGrid>
      </section>

      <ContinueStrip
        label="Continue planning."
        links={[
          { label: "Empty-leg listings", href: "/empty-legs" },
          { label: "Compare charter quotes", href: "/guides/how-to-compare-private-jet-quotes" },
          { label: "Charter safety", href: "/guides/private-jet-charter-safety-checklist" },
          { label: "Legal & agreement", href: "/legal#cancellation" },
        ]}
      />
      <TripPrompt
        icon="flex"
        title="Tell us where you can be flexible."
        body="Share your plans and we can help you explore suitable options."
        action={
          <Link href="/quote/mission" className={BTN.bronze}>
            Discuss my route →
          </Link>
        }
      />
    </>
  );
}
