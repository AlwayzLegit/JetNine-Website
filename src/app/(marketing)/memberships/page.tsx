import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { RATES, RATES_UPDATED } from "@/lib/rates";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { ProgramPicker } from "@/components/memberships/program-picker";
import { FaqAccordion } from "@/components/memberships/faq-accordion";
import { PROGRAMS } from "@/components/memberships/programs";
import { plainMission, plainRate, plainSample } from "@/components/memberships/rate-copy";

export const metadata: Metadata = pageMetadata({
  title: "Jet Card & Memberships — Locked Hourly Rates",
  description:
    "JetNine jet card and memberships: locked hourly rates, refundable deposits, no peak surcharges — or fly on-demand with no commitment at all.",
  path: "/memberships",
});

// Numbers here mirror src/lib/memberships.ts (deposit, call-out hours,
// rate-lock months, allowances, cardholder limits, empty-leg window).
const CARD_TIERS = [
  {
    badge: "Tier 01 · Base",
    name: "Card · 100",
    deposit: "$100k",
    items: [
      "Locked hourly rates for 24 months",
      "72-hour guaranteed call-out",
      "$2,500 catering allowance / year",
      "Standard empty-leg watchlist access",
      "One named cardholder",
    ],
    highlight: false,
  },
  {
    badge: "Tier 02 · Preferred",
    name: "Card · 250",
    deposit: "$250k",
    items: [
      "Locked hourly rates for 24 months",
      "48-hour guaranteed call-out",
      "$8,000 catering & ground allowance / year",
      "Priority empty-leg access — 30 min advance window",
      "Up to three named cardholders",
      "Direct dispatcher cell number",
    ],
    highlight: true,
  },
  {
    badge: "Tier 03 · Elite",
    name: "Card · 500",
    deposit: "$500k",
    items: [
      "Locked hourly rates for 36 months",
      "24-hour guaranteed call-out",
      "$20,000 catering & ground allowance / year",
      "First-look empty-leg access — 60 min advance window",
      "Unlimited named cardholders & dependents",
      "Annual safety briefing & aircraft selection consultation",
      "Path to Reserve qualification",
    ],
    highlight: false,
  },
];

const AVAILABILITY = [
  { title: "Substitute aircraft", sub: "Same category or one tier up, our cost.", val: "No charge" },
  { title: "Commercial first-class", sub: "If no aircraft is reachable, we book commercial.", val: "Our cost" },
  { title: "Hour credit", sub: "Failed call-out triggers a flight credit.", val: "+1 hour" },
  { title: "No questions asked", sub: "Triggered by missed window, regardless of cause.", val: "Always" },
];

const FAQ = [
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

const RATE_COLUMNS = ["Category", "Typical mission", "On-demand market", "Locked card rate"];

export default function MembershipsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from PROGRAMS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogJsonLd) }}
      />
      <PageHero
        eyebrow="Memberships · jet card · on-demand"
        title="Jet card, reserve, or on-demand: three ways to fly, no membership required."
        lead="Most charter brokers want you on a yearly retainer. We don't. The default is on-demand — pay per flight, locked pricing, zero commitment. The jet card and reserve programs exist because some clients want fixed hourly rates and guaranteed availability. Pick the one that fits your year."
        imageSrc="/images/hero/memberships.webp"
        imagePosition="58% center"
      />

      {/* Slider + the three program cards (#tiers) */}
      <ProgramPicker />

      {/* Hourly rates */}
      <section id="rates" className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Hourly rates</p>
        <h2 className="title-section max-w-[22ch]">JetNine Card rates, by category.</h2>
        <p className="mt-4 max-w-[62ch] text-[18px] text-bone-2">
          Locked for 24 months from card activation. Includes everything except FET (7.5%, federal)
          and private-terminal ramp fees. Compare to typical on-demand market rates — the savings
          are 12–18% on average, more during peak.
        </p>
        <div className="card mt-8 overflow-hidden">
          {/* tabIndex + role: keyboard users must be able to scroll this on phones. */}
          <div
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabIndex={0}
            role="region"
            aria-label="Locked card rate comparison"
          >
            <table className="table-jn min-w-[720px] [&_td]:px-6 [&_th]:px-6">
              <thead>
                <tr>
                  {RATE_COLUMNS.map((h, i) => (
                    <th key={h} scope="col" className={i === RATE_COLUMNS.length - 1 ? "text-right" : ""}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATES.map((r) => (
                  <tr key={r.category}>
                    <td className="font-serif text-[22px] leading-[1.2]">{r.category}</td>
                    <td className="text-bone-2">
                      {plainMission(r.mission)}
                      <span className="block text-[14px] text-steel">e.g. {plainSample(r.sample)}</span>
                    </td>
                    <td className="text-bone-2">{r.market}</td>
                    <td className="text-right text-[19px] font-medium">{plainRate(r.locked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-[14px] text-steel">Rates reviewed quarterly · updated {RATES_UPDATED}</p>
      </section>

      {/* Card tiers */}
      <section id="deposits" className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Card tiers</p>
        <h2 className="title-section max-w-[22ch]">Three deposit levels. Same locked rates, more perks.</h2>
        <p className="mt-4 max-w-[62ch] text-[18px] text-bone-2">
          Higher deposits earn faster call-out, larger annual allowances, and elevated empty-leg
          priority. The hourly rate is the same across tiers — what changes is the service envelope.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARD_TIERS.map((t) => (
            <article
              key={t.name}
              className={`card flex flex-col gap-4 p-8 max-md:p-6 ${t.highlight ? "card-selected" : ""}`}
            >
              <span className="text-[13px] font-semibold text-steel">{t.badge}</span>
              <h3 className="font-serif text-[28px] font-normal leading-[1.15]">{t.name}</h3>
              <div className="border-y border-line py-[18px]">
                <div className="font-serif text-[40px] font-light leading-none">{t.deposit}</div>
                <div className="mt-[6px] text-[14px] text-bone-2">Refundable deposit</div>
              </div>
              <ul className="flex flex-col gap-[10px] text-[15px]">
                {t.items.map((it) => (
                  <li key={it} className="grid grid-cols-[auto_1fr] gap-[10px]">
                    <span className="text-clearance" aria-hidden="true">✓</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Availability commitment */}
      <section className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">Availability commitment</p>
        <h2 className="title-section max-w-[22ch]">If we don&rsquo;t deliver, we make it right.</h2>
        <p className="mt-4 max-w-[64ch] text-[18px] text-bone-2">
          Guaranteed call-out is a commitment, not a marketing line. If we can&rsquo;t put an aircraft
          in the air for you within your tier&rsquo;s window, here&rsquo;s what happens.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {AVAILABILITY.map((a) => (
            <div
              key={a.title}
              className="card grid grid-cols-[1fr_auto] items-start gap-4 px-7 py-6 max-md:px-5"
            >
              <div>
                <h3 className="text-[20px] font-medium leading-[1.3]">{a.title}</h3>
                <p className="mt-1 text-[15px] text-bone-2">{a.sub}</p>
              </div>
              <span className="whitespace-nowrap text-[14px] font-semibold text-gold">{a.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-jn section-jn max-md:pt-20">
        <p className="eyebrow">FAQ</p>
        <h2 className="title-section max-w-[24ch]">The questions most card prospects ask.</h2>
        <FaqAccordion items={FAQ} className="mt-8 max-w-[820px]" />
      </section>

      <CtaBand
        title="Talk to dispatch. We'll model the right program for you."
        body="Annual hours, typical lanes, peak-day exposure — fifteen minutes on the phone and we'll show you which program saves you money in writing."
      />
    </>
  );
}
