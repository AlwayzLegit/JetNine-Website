"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { RATES } from "@/lib/rates";
import { SITE } from "@/lib/constants";
import { CARD_TIERS, PROGRAMS, type CardTier } from "./programs";

// Window bodies for /memberships (jn-programs-windows.js). The prototype's
// "trip" / "Discuss …" forms are replaced by links: quotes go to
// /quote/mission, program conversations to /contact (Programs and cards)
// or the dispatch phone. Figures come from programs.ts / rates.ts.

const CONTACT_PROGRAMS = "/contact?subject=card";

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-[10px] font-serif text-[14px] leading-[1.45]">
      <span aria-hidden="true" className="text-gold">✓</span>
      {children}
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[10px] border border-line bg-surface-2 px-[14px] py-3 font-serif text-[13px] leading-[1.45]">
      <span aria-hidden="true" className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-gold font-sans text-[12px] font-bold text-gold">
        i
      </span>
      <span>{children}</span>
    </div>
  );
}

function Photo({ src, h }: { src: string; h: number }) {
  return (
    <div className="relative overflow-hidden bg-surface-2" style={{ height: h }}>
      <Image src={src} alt="" aria-hidden fill sizes="440px" className="object-cover" />
    </div>
  );
}

function Rows({ rows, cols = "1.6fr 1fr", right = false, boldLast = false, goldFirst = false }: { rows: string[][]; cols?: string; right?: boolean; boldLast?: boolean; goldFirst?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line bg-white">
      {rows.map((cells, i) => (
        <div
          key={i}
          className={`grid min-w-[420px] text-[13px] ${i ? "border-t border-line" : ""} ${boldLast && i === rows.length - 1 ? "bg-surface-2 font-bold" : ""}`}
          style={{ gridTemplateColumns: cols }}
        >
          {cells.map((c, j) => (
            <span key={j} className={`px-3 py-[9px] ${j ? "border-l border-line" : ""} ${j && right ? "text-right" : ""} ${!j && goldFirst ? "text-gold" : ""}`}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CompareWindow() {
  const [od, card, reserve] = PROGRAMS;
  return (
    <div>
      <div className="text-center">
        <h2 className="font-serif text-[30px] leading-[1.1]">Find your best fit.</h2>
        <p className="mt-[6px] font-serif text-[15px] text-steel">Compare how you pay, plan and book.</p>
      </div>
      <div className="mt-4 grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {[
          [od.name, "Pay per flight, with flexible booking and no program enrollment fee.", "/images/light/jet-midsize.webp"],
          [card.name, "Flight credits with tier-based notice and locked category rates.", "/images/light/cabin-supermid.webp"],
          [reserve.name, "Dedicated access and customized support for time-sensitive travel.", "/images/light/jet-twilight.webp"],
        ].map(([n, d, src]) => (
          <div key={n}>
            <Photo src={src} h={96} />
            <h3 className="mt-2 font-serif text-[20px]">{n}</h3>
            <p className="mt-[2px] text-[12px] leading-[1.4] text-steel">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-[14px]">
        <Rows
          cols=".8fr 1fr 1fr 1fr"
          goldFirst
          rows={[
            ["Funding", "Per trip", card.price, reserve.price],
            ["Pricing", "Trip quote", "Category rates", "Individual terms"],
            ["Planning", "Flexible booking", "Recurring trips", "Time-sensitive travel"],
            ["Notice", "Per-trip availability", "72 / 48 / 24 hours", "By agreement"],
          ]}
        />
      </div>
      <Link href={CONTACT_PROGRAMS} className="btn btn-primary mt-4 w-full">
        Discuss my travel →
      </Link>
    </div>
  );
}

export function CardTiersWindow({ initial = "card_250" }: { initial?: CardTier["key"] }) {
  const [key, setKey] = useState(initial);
  const t = CARD_TIERS.find((x) => x.key === key) ?? CARD_TIERS[1];
  return (
    <div>
      <div role="tablist" aria-label="Card tier" className="mt-3 grid grid-cols-3 border-b border-line">
        {CARD_TIERS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === key}
            onClick={() => setKey(x.key)}
            className={`h-9 cursor-pointer border-0 bg-transparent text-[13px] text-bone ${x.key === key ? "font-bold shadow-[inset_0_-2px_0_var(--gold)]" : ""}`}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div className="mt-[14px]">
        <Photo src="/images/light/cabin-supermid.webp" h={170} />
      </div>
      <h3 className="mt-[14px] font-serif text-[22px]">{t.name}</h3>
      <div className="font-serif text-[34px] leading-[1.05]">{t.deposit}</div>
      <p className="mt-[2px] font-serif text-[14px] text-steel">Refundable flight-credit deposit</p>
      <div className="mt-[14px] grid grid-cols-2 border-t border-line pt-3">
        <div>
          <div className="font-serif text-[22px]">{t.notice}</div>
          <div className="text-[12px] text-steel">guaranteed call-out</div>
        </div>
        <div className="border-l border-line pl-4">
          <div className="font-serif text-[22px]">{t.lock}</div>
          <div className="text-[12px] text-steel">rate lock</div>
        </div>
      </div>
      <ul className="mt-4 flex list-none flex-col gap-2 p-0">
        {t.items.map((i) => (
          <Check key={i}>{i}</Check>
        ))}
      </ul>
      <Link href={CONTACT_PROGRAMS} className="btn btn-primary mt-[18px] w-full">
        Discuss {t.name} →
      </Link>
      <p className="mt-[10px] text-[12px] text-steel">Full terms are set out in the card agreement.</p>
    </div>
  );
}

export function ReserveWindow() {
  const reserve = PROGRAMS[2];
  return (
    <div>
      <Photo src="/images/light/jet-twilight.webp" h={150} />
      <h2 className="mt-[18px] font-serif text-[24px] leading-[1.1]">Reserve, around your schedule.</h2>
      <p className="mt-[6px] font-serif text-[15px] text-steel">{reserve.strap}</p>
      <div className="mt-[10px] font-serif text-[32px]">{reserve.price}</div>
      <p className="font-serif text-[13px] text-steel">{reserve.priceSub}</p>
      <ul className="mt-[14px] flex list-none flex-col gap-2 p-0">
        {reserve.features.map((f) => (
          <Check key={f}>{f}</Check>
        ))}
      </ul>
      <Link href={reserve.cta.href} className="btn btn-primary mt-4 w-full">
        {reserve.cta.label} →
      </Link>
      <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary mt-2 w-full">
        Call {SITE.dispatchPhone}
      </a>
    </div>
  );
}

export function PricingWindow() {
  const rate = RATES[0].lockedUsd;
  const base = rate * 3;
  const tax = base * 0.075;
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return (
    <div>
      <div className="text-center">
        <p className="eyebrow !mb-[6px] !text-bone">Pricing clarity</p>
        <h2 className="font-serif text-[32px] leading-[1.1]">Understand your trip total.</h2>
        <span className="mt-[10px] inline-block rounded-full border border-gold bg-surface-2 px-[14px] py-[3px] font-serif text-[13px] text-gold">
          Illustrative calculation · not a quote
        </span>
      </div>
      <div className="mt-4">
        <Rows
          right
          boldLast
          rows={[
            [`3 billable hours × ${usd(rate).replace(".00", "")} (${RATES[0].category} card rate)`, usd(base)],
            ["7.5% federal excise tax on that base", usd(tax)],
            ["Subtotal shown", usd(base + tax)],
          ]}
        />
      </div>
      <div className="mt-[14px]">
        <Note>Not the complete trip total. Segment taxes, ramp fees and other charges may apply.</Note>
      </div>
      <div className="mt-4 border-t border-gold pt-[14px]">
        <h3 className="font-serif text-[18px]">Confirm in the written quote</h3>
        <ul className="mt-[10px] grid list-none gap-x-4 gap-y-2 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          {["Billable time & minimums", "Applicable taxes", "Fuel, crew & airport charges", "Catering & ground transport"].map((t) => (
            <Check key={t}>{t}</Check>
          ))}
        </ul>
      </div>
      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
        <Link href="/guides/private-jet-charter-cost" className="rule-link !text-[14px] !text-gold">
          Read pricing guidance →
        </Link>
        <Link href="/quote/mission" className="btn btn-primary btn-sm">
          Request a quote →
        </Link>
      </div>
    </div>
  );
}

const REFUNDS: [string, string][] = [
  ["Is the deposit actually refundable?", "Yes, in plain terms. The deposit is held as a flight-credit balance. You can fly it down to zero, top it up, or — at any point in the 24-month locked-rate window — request a refund of the unused balance. We process refunds within ten business days, no penalties, no clawbacks. The only thing we don't refund is hours already flown."],
  ["What happens if I run out of balance mid-year?", "Top it up, in any amount, any time. Or roll back to on-demand for the rest of the year — your locked rate stays in place if you re-load before the 24-month rate window expires."],
  ["Do I lose my locked rate if I don't fly enough?", "No minimum hours, no use-it-or-lose-it. The 24-month rate window runs from card activation. The only way to lose the locked rate is to let it expire without re-loading."],
  ["How is my balance protected?", "Ask how funds are held and what happens if the program ends; the card agreement sets this out. Do not assume escrow or insurance."],
];

function Accordion({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map(([q, a], i) => (
        <div key={q} className="mt-2 border border-line bg-white">
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? -1 : i)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-[14px] py-[11px] text-left font-serif text-[15px] text-bone"
          >
            <span>{q}</span>
            <span aria-hidden="true" className="text-[18px] text-gold">{open === i ? "−" : "+"}</span>
          </button>
          {open === i ? <p className="mx-[14px] mb-3 bg-surface-2 px-3 py-[10px] font-serif text-[13px] leading-[1.5] text-steel">{a}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function RefundsWindow() {
  return (
    <div>
      <p className="mt-[6px] font-serif text-[15px] text-steel">Review the written refund terms before funding a card.</p>
      <Accordion items={REFUNDS} />
      <div className="mt-3">
        <Note>A prepaid balance is not automatically escrowed or insured.</Note>
      </div>
      <Link href={CONTACT_PROGRAMS} className="btn btn-primary mt-4 w-full">
        Request program terms →
      </Link>
    </div>
  );
}

const AVAILABILITY = [
  ["Substitute aircraft", "Same category or one tier up, our cost.", "No charge"],
  ["Commercial first-class", "If no aircraft is reachable, we book commercial.", "Our cost"],
  ["Hour credit", "Failed call-out triggers a flight credit.", "+1 hour"],
  ["No questions asked", "Triggered by missed window, regardless of cause.", "Always"],
];

export function AvailabilityWindow() {
  return (
    <div>
      <Photo src="/images/light/jet-midsize.webp" h={150} />
      <h3 className="mb-[6px] mt-[18px] font-serif text-[16px]">Guaranteed call-out</h3>
      <Rows
        cols="1fr 1fr"
        rows={[
          ...CARD_TIERS.map((t) => [t.name, t.notice]),
          ["Reserve", "8 hours"],
        ]}
      />
      <h3 className="mb-2 mt-4 font-serif text-[16px]">If we don&rsquo;t deliver, we make it right</h3>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {AVAILABILITY.map(([t, s, v]) => (
          <li key={t} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line pb-[10px] last:border-b-0">
            <span>
              <span className="block font-serif text-[15px]">{t}</span>
              <span className="text-[13px] text-steel">{s}</span>
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-gold">{v}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Note>Peak dates are capacity-constrained — book them 60+ days out. Once confirmed, the rate is your locked rate.</Note>
      </div>
    </div>
  );
}

const CHANGES: [string, string][] = [
  ["Change an itinerary", "Confirm the deadline, any revised trip price and the approval needed before a change is made."],
  ["Cancel a flight", "Check the cancellation schedule that applies to your card or charter agreement, and how charges are deducted."],
  ["Change tiers", "Up only, any time — top up to a higher tier and the new perks kick in within 48 hours. Down requires a written request 30 days before the next anniversary; we true up the deposit difference and refund the delta."],
  ["Weather and disruption", "Understand who decides a delay or diversion, and how rebooking or refunds are handled."],
];

export function ChangesWindow() {
  return (
    <div>
      <Accordion items={CHANGES} />
      <div className="mt-3">
        <Note>Cancellation charges and refund remedies follow the applicable agreement.</Note>
      </div>
      <Link href="/legal#cancellation" className="btn btn-primary mt-4 w-full">
        Read cancellation &amp; changes terms
      </Link>
    </div>
  );
}
