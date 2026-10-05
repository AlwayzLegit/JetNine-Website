import Image from "next/image";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { RATES, RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";
import { CtaBand } from "@/components/cta-band";
import { WindowButton } from "@/components/light/window";
import { FaqList } from "@/components/company/faq-list";
import { ProgramFit } from "@/components/memberships/program-fit";
import { CARD_TIERS, PROGRAMS } from "@/components/memberships/programs";
import { plainRate } from "@/components/memberships/rate-copy";
import {
  AvailabilityWindow,
  CardTiersWindow,
  ChangesWindow,
  CompareWindow,
  PricingWindow,
  RefundsWindow,
} from "@/components/memberships/windows";

export const metadata: Metadata = pageMetadata({
  title: "Jet Card & Memberships — Locked Hourly Rates",
  description:
    "JetNine jet card and memberships: locked hourly rates, refundable deposits, no peak surcharges — or fly on-demand with no commitment at all.",
  path: "/memberships",
});

// Light - Programs. Prices, tiers and rates come from programs.ts and
// src/lib/rates.ts (mirroring src/lib/memberships.ts) — the three tiers
// still await owner confirmation; no figure here is new.

const FAQ = [
  {
    q: "Do I need a membership?",
    a: "No. On-demand charter lets you book trip by trip with no deposit, no annual fee and no minimum spend. A prepaid program is optional.",
  },
  {
    q: "Is the deposit actually refundable?",
    a: "Yes, in plain terms. The deposit is held as a flight-credit balance. You can fly it down to zero, top it up, or — at any point in the 24-month locked-rate window — request a refund of the unused balance. We process refunds within ten business days, no penalties, no clawbacks. The only thing we don't refund is hours already flown.",
  },
  {
    q: "What happens if I run out of deposit balance mid-year?",
    a: "Top it up, in any amount, any time. Or roll back to on-demand for the rest of the year — your locked rate stays in place if you re-load before the 24-month rate window expires. We don't penalize over-flying or charge the higher market rate retroactively; the locked rate is the locked rate.",
  },
  {
    q: "Why is this cheaper than on-demand?",
    a: "Two reasons. First, the deposit gives us working capital to negotiate fleet-wide rate commitments with operators on your behalf — savings we pass through. Second, by knowing your annual flying volume in advance, we can place you on operators with capacity gaps, who give us better rates than spot-market lookups. The card is genuinely a discount, not a marketing wrapper.",
  },
  {
    q: "Are peak holidays really the same rate?",
    a: "Yes, with one nuance: the rate is the same, but availability isn't. Thanksgiving Wednesday and the days around the Super Bowl are genuinely capacity-constrained — even with the card, we can't manufacture aircraft that don't exist. Card holders get priority over on-demand bookings, and we recommend booking peak dates 60+ days out. Once confirmed, the rate is your locked rate. Period.",
  },
  {
    q: "Can I change tiers mid-year?",
    a: "Up only, any time — top up to a higher tier and the new perks kick in within 48 hours. Down requires written request 30 days before the next anniversary; we'll true up the deposit difference and refund the delta. Rates locked at the original tier carry over for the duration of the 24-month window.",
  },
  {
    q: "How does Reserve actually work?",
    a: "Reserve is built around a dedicated dispatcher and a pre-positioned operator pool — we maintain standing arrangements with three to five operators in key metros so that an 8-hour call-out is realistic, not aspirational. It's by application because the operator commitments are finite; we run roughly 40 Reserve seats at any time.",
  },
  {
    q: "Do I lose my locked rate if I don't fly enough?",
    a: "No minimum hours, no use-it-or-lose-it. The deposit sits there at the locked rate; if you fly five hours in a year, you fly five hours at the locked rate. The 24-month rate window is from card activation, not from minimum-hours benchmarks. The only way to lose the locked rate is to let the 24 months expire without re-loading.",
  },
];

// ItemList of Offer for the three programs. The Offer schema gives
// each program a discrete entity Google can attribute (and surface in
// price/feature comparisons), and wrapping them in an ItemList tells
// crawlers these are three sibling options of the same kind rather
// than three unrelated offers. Built from PROGRAMS so it can't drift.
const offerCatalogJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: PROGRAMS.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Offer",
      name: p.name,
      description: p.strap,
      category: "Private aviation charter program",
      price: p.price.replace(/[^0-9]/g, "") || "0",
      priceCurrency: "USD",
      eligibleCustomerType: "https://schema.org/Enduser",
      seller: { "@type": "Organization", name: "JetNine" },
    },
  })),
};

const TERMS = [
  { title: "Refunds & unused funds", heading: "Your unused balance.", body: <RefundsWindow /> },
  { title: "Availability & notice", heading: "Know the commitment.", body: <AvailabilityWindow /> },
  { title: "Changes & cancellations", heading: "When plans change.", body: <ChangesWindow /> },
];

const th = "px-[14px] py-[10px] text-left font-bold";
const td = "px-[14px] py-[10px]";

export default function MembershipsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from PROGRAMS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogJsonLd) }}
      />

      {/* Hero: photo band with a paper card */}
      <section className="relative flex min-h-[420px] items-center bg-navy">
        <Image
          src="/images/light/page-05-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "78% center" }}
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,35,46,.45)_0%,rgba(18,35,46,.1)_50%,rgba(18,35,46,0)_100%)]" />
        <div className="container-jn relative w-full py-10">
          <div className="max-w-[560px] border border-line bg-[rgba(247,245,240,.96)] px-[30px] pb-[30px] pt-7 max-sm:px-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-bone">
              On-Demand <span className="text-gold">•</span> JetNine Card <span className="text-gold">•</span> Reserve
            </p>
            <h1 className="mt-2 font-serif text-[clamp(34px,9vw,58px)] font-normal leading-[1.02] tracking-[-0.01em]">
              Private aviation.
              <br />
              On your terms.
            </h1>
            <p className="mt-3 font-serif text-[22px] leading-[1.3]">
              Three ways to fly. One clear comparison.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <WindowButton label="Compare programs →" className="btn btn-primary btn-sm !h-[42px] !font-bold" variant="modal">
                <CompareWindow />
              </WindowButton>
              <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary btn-sm !h-[42px] !border-bone !font-bold">
                Speak with an advisor
              </a>
            </div>
          </div>
        </div>
      </section>

      <ProgramFit />

      {/* Rates */}
      <section id="rates" className="mt-9 grid scroll-mt-[var(--header-h)] border-y border-line bg-white [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="relative min-h-[420px] bg-surface-2 max-md:min-h-[260px]">
          <Image src="/images/light/chair-at-sunset.webp" alt="" aria-hidden fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
        </div>
        <div className="px-10 pb-8 pt-9 max-sm:px-4">
          <h2 className="font-serif text-[clamp(32px,7vw,40px)] leading-[1.1]">Know the whole trip price.</h2>
          <p className="mt-2 max-w-[52ch] font-serif text-[17px] text-steel">
            An hourly rate is a starting point. Compare billable time, taxes, fees and the same itinerary.
          </p>
          <div className="mt-[18px] max-w-[600px] overflow-x-auto border border-line" tabIndex={0} role="region" aria-label="JetNine Card rates by category">
            <table className="w-full min-w-[320px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th scope="col" className={th}>Aircraft category</th>
                  <th scope="col" className={`${th} border-l border-line`}>On-demand market</th>
                  <th scope="col" className={`${th} border-l border-line`}>Card rate / hour</th>
                </tr>
              </thead>
              <tbody>
                {RATES.map((r) => (
                  <tr key={r.category} className="border-b border-line last:border-b-0">
                    <td className={td}>{r.category}</td>
                    <td className={`${td} border-l border-line text-steel`}>{plainRate(r.market)}</td>
                    <td className={`${td} border-l border-line font-bold`}>{plainRate(r.locked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-[10px] max-w-[60ch] text-[12px] text-steel">
            Locked for 24 months from card activation. Includes everything except FET (7.5%, federal) and
            private-terminal ramp fees. Rates reviewed quarterly · updated {RATES_UPDATED}.
          </p>
          <WindowButton
            label="See what your quote should include →"
            className="mt-3 cursor-pointer border-0 border-b border-gold bg-transparent p-0 pb-[2px] font-serif text-[16px] text-gold"
          >
            <PricingWindow />
          </WindowButton>
        </div>
      </section>

      {/* Tiers */}
      <section id="deposits" className="container-jn scroll-mt-[var(--header-h)] pt-9">
        <h2 className="font-serif text-[clamp(32px,7vw,40px)] leading-[1.1]">The right level of service.</h2>
        <div className="mt-[18px] overflow-x-auto border border-line bg-white" tabIndex={0} role="region" aria-label="JetNine Card tiers">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[13px]">
                <th scope="col" className={th}>Tier</th>
                <th scope="col" className={`${th} border-l border-line`}>Refundable deposit</th>
                <th scope="col" className={`${th} border-l border-line`}>Call-out notice</th>
                <th scope="col" className={`${th} border-l border-line`}>Rate lock</th>
                <th scope="col" className={`${th} border-l border-line`}>Details</th>
              </tr>
            </thead>
            <tbody>
              {CARD_TIERS.map((t) => (
                <tr key={t.key} className="border-b border-line last:border-b-0">
                  <td className={td}>{t.name}</td>
                  <td className={`${td} border-l border-line`}>{t.deposit}</td>
                  <td className={`${td} border-l border-line`}>{t.notice}</td>
                  <td className={`${td} border-l border-line`}>{t.lock}</td>
                  <td className="border-l border-line px-[14px] py-1">
                    <WindowButton
                      label="View benefits →"
                      className="min-h-9 border-0 bg-transparent p-0 text-left text-[14px] text-gold underline decoration-line underline-offset-4"
                      title="JetNine Card"
                      variant="drawer"
                    >
                      <CardTiersWindow initial={t.key} />
                    </WindowButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-steel">
          Higher deposits earn faster call-out, larger annual allowances and elevated empty-leg priority. The hourly
          rate is the same across tiers. Availability and refund conditions apply as defined in the agreement.
        </p>
        <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {TERMS.map((t) => (
            <WindowButton
              key={t.title}
              label={
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{t.title}</span>
                  <span aria-hidden="true" className="text-[20px] text-gold">+</span>
                </span>
              }
              className="flex min-h-[48px] w-full items-center border border-line bg-white px-4 py-3 text-left font-serif text-[16px] text-bone hover:border-gold"
              title={t.heading}
              variant="drawer"
            >
              {t.body}
            </WindowButton>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-jn grid scroll-mt-[var(--header-h)] items-start gap-10 pb-9 pt-9 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <h2 className="font-serif text-[clamp(32px,7vw,40px)] leading-[1.1]">A few good questions.</h2>
          <div aria-hidden className="mt-[14px] h-[2px] w-8 bg-gold" />
        </div>
        <FaqList items={FAQ} tone="serif" joined />
      </section>

      <CtaBand
        className="!mt-0"
        imageSrc="/images/light/wing-clouds.webp"
        imagePosition="right center"
        title="Build the right plan for your year."
        body="Start with your routes, hours and notice requirements."
        primary={{ label: "Request a program comparison", href: "/contact?subject=card" }}
        secondary={{ label: `Call ${SITE.dispatchPhone}`, href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
