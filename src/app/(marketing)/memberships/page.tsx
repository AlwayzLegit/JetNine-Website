import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Memberships",
  description:
    "Three ways to fly — on-demand, JetNine Card, or Reserve. None of them require a membership. Locked rates, refundable deposits, no peak surcharges.",
};

const ANCHORS = [
  { label: "Compare programs ↓", href: "#tiers" },
  { label: "Hourly rates ↓", href: "#rates" },
  { label: "Card tiers ↓", href: "#deposits" },
  { label: "FAQ ↓", href: "#faq" },
];

const PROGRAMS = [
  {
    badge: "PROGRAM 01",
    chip: null,
    name: "On-Demand",
    strap: "Pay per flight, no commitment. The default. The right choice for most.",
    price: "$0",
    priceSub: "No deposit, no annual fee, no minimum spend.",
    features: [
      "All-in pricing — every quote includes fuel, FET, repositioning, crew, catering, ground.",
      "Locked at acceptance — the number you accept is the number on the invoice.",
      "30-min quote turnaround with three to five specific airframes.",
      "Empty-leg watchlist included free; no SMS-alert fees.",
      "Best fit for under 25 flight hours per year.",
    ],
    cta: { label: "Request a quote", href: "/quote" },
    highlight: false,
  },
  {
    badge: "PROGRAM 02",
    chip: "Most chosen",
    name: "JetNine Card",
    strap: "Refundable deposit. Fixed hourly rate. No peak-day surcharges, ever.",
    price: "From $100k",
    priceSub:
      "Deposit is yours — applied against flights, refundable if unused after 24 months.",
    features: [
      "Fixed hourly rates by category, locked for 24 months from card activation.",
      "No peak-day pricing. Thanksgiving Wednesday at the same rate as a Tuesday in March.",
      "72-hour call-out — guaranteed availability with three days notice.",
      "Same dispatcher relationship; same vetting protocol.",
      "Best fit for 25–100 flight hours per year.",
    ],
    cta: { label: "See card tiers", href: "#deposits" },
    highlight: true,
  },
  {
    badge: "PROGRAM 03",
    chip: null,
    name: "Reserve",
    strap:
      "Guaranteed availability with as little as 8 hours notice. Dedicated dispatcher. White-glove.",
    price: "From $500k",
    priceSub: "Annual program review. By application — limited number of seats.",
    features: [
      "8-hour call-out — guaranteed airframe in the air, anywhere CONUS.",
      "Dedicated dispatcher assigned to your account; same person, every time.",
      "Priority access to the largest-cabin airframes during demand peaks.",
      "Annual catering & ground-transport allowance included.",
      "Best fit for 100+ flight hours per year, time-critical missions.",
    ],
    cta: { label: "Apply for Reserve", href: "/contact?subject=reserve" },
    highlight: false,
  },
];

const COMPARE_COLUMNS = ["JetNine on-demand", "JetNine Card", "Fractional", "Whole aircraft"];
const COMPARE_KICKERS = ["FLEX", "FIXED", "SHARES", "OWN"];
const COMPARE_ROWS: { label: string; cells: [string, string, string, string] }[] = [
  {
    label: "Annual commitment",
    cells: [
      "None / Pay per flight",
      "$100k+ deposit / Refundable, 24 mo",
      "$200k+ purchase / Plus $15–25k/mo mgmt",
      "$10–60M / Plus $1–3M/yr ops",
    ],
  },
  {
    label: "Hourly rate (midsize)",
    cells: [
      "~$4,400 / All-in, market rate",
      "$3,950 / Locked 24 mo",
      "$5,200 / Plus monthly",
      "$2,200 / Direct ops only",
    ],
  },
  {
    label: "Aircraft access",
    cells: ["~20,000 worldwide", "~20,000 worldwide", "~200 fleet", "1 (yours)"],
  },
  {
    label: "Call-out time",
    cells: ["2–24h notice", "72h guaranteed", "10–24h", "2h (your call)"],
  },
  {
    label: "Peak-day surcharge",
    cells: ["Market rate", "✓ None", "+25–40%", "✓ None"],
  },
  {
    label: "Aircraft category",
    cells: ["Per flight choice", "Per flight choice", "Locked to share", "Locked to airframe"],
  },
  {
    label: "Empty-leg access",
    cells: ["✓ Yes", "✓ Yes + watchlist priority", "— No", "— No"],
  },
  {
    label: "Best for",
    cells: ["Under 25h / year", "25–100h / year", "25–50h / year, fixed routes", "200h+ / year"],
  },
];

const RATES = [
  {
    category: "Light",
    mission: "3–4 pax · 1,500 NM · regional hops",
    sample: "KVNY → KASE",
    market: "$3,200–3,600/hr",
    locked: "$2,950/HR",
  },
  {
    category: "Midsize",
    mission: "5–6 pax · 2,500 NM · transcon",
    sample: "KVNY → KTEB",
    market: "$4,200–4,600/hr",
    locked: "$3,950/HR",
  },
  {
    category: "Super-mid",
    mission: "6–8 pax · 3,500 NM · transcon nonstop",
    sample: "KSFO → KMIA",
    market: "$5,400–5,900/hr",
    locked: "$5,100/HR",
  },
  {
    category: "Heavy",
    mission: "8–12 pax · 4,500 NM · transatlantic",
    sample: "KJFK → EGLL",
    market: "$7,800–8,400/hr",
    locked: "$7,400/HR",
  },
  {
    category: "Ultra long range",
    mission: "12–16 pax · 6,500+ NM · transpacific",
    sample: "KLAX → RJTT",
    market: "$10,400–11,200/hr",
    locked: "$9,850/HR",
  },
];

const CARD_TIERS = [
  {
    badge: "TIER 01 · BASE",
    name: "Card · 100",
    deposit: "$100k",
    depositSub: "Refundable deposit",
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
    badge: "TIER 02 · PREFERRED",
    name: "Card · 250",
    deposit: "$250k",
    depositSub: "Refundable deposit",
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
    badge: "TIER 03 · ELITE",
    name: "Card · 500",
    deposit: "$500k",
    depositSub: "Refundable deposit",
    items: [
      "Locked hourly rates for 36 months",
      "24-hour guaranteed call-out",
      "$20,000 catering & ground allowance / year",
      "First-look empty-leg access — 60 min advance window",
      "Unlimited named cardholders & dependents",
      "Annual safety briefing & airframe selection consultation",
      "Path to Reserve qualification",
    ],
    highlight: false,
  },
];

const AVAILABILITY = [
  {
    num: "01",
    title: "Substitute aircraft",
    sub: "Same category or one tier up, our cost.",
    val: "No charge",
  },
  {
    num: "02",
    title: "Commercial first-class",
    sub: "If no airframe is reachable, we book commercial.",
    val: "Our cost",
  },
  {
    num: "03",
    title: "Hour credit",
    sub: "Failed call-out triggers a flight credit.",
    val: "+1 hour",
  },
  {
    num: "04",
    title: "No questions asked",
    sub: "Triggered by missed window, regardless of cause.",
    val: "Always",
  },
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
    a: "Two reasons. First, the deposit gives us working capital to negotiate fleet-wide rate commitments with operators on your behalf — savings we pass through. Second, by knowing your annual flying volume in advance, we can place you on operators with capacity gaps, who give us better rates than spot-market lookups. The card is genuinely a discount, not a marketing wrapper. The math is in the comparison table above.",
  },
  {
    q: "Are peak holidays really the same rate?",
    a: "Yes, with one nuance: the rate is the same, but availability isn't. Thanksgiving Wednesday and the days around the Super Bowl are genuinely capacity-constrained — even with the card, we can't manufacture airframes that don't exist. Card holders get priority over on-demand bookings, and we recommend booking peak dates 60+ days out. Once confirmed, the rate is your locked rate. Period.",
  },
  {
    q: "Can I change tiers mid-year?",
    a: "Up only, any time — top up to a higher tier and the new perks kick in within 48 hours. Down requires written request 30 days before the next anniversary; we'll true up the deposit difference and refund the delta. Rates locked at the original tier carry over for the duration of the 24-month window.",
  },
  {
    q: "How does Reserve actually work?",
    a: "Reserve is built around a dedicated dispatcher and a pre-positioned operator pool — we maintain standing arrangements with three to five operators in key metros so that an 8-hour call-out is realistic, not aspirational. It's by application because the operator commitments are finite; we run roughly 40 Reserve seats at any time. If you fly 100+ hours a year and need same-day or next-day flexibility, ask about it on your next call.",
  },
  {
    q: "Do I lose my locked rate if I don't fly enough?",
    a: "No minimum hours, no use-it-or-lose-it. The deposit sits there at the locked rate; if you fly five hours in a year, you fly five hours at the locked rate. The 24-month rate window is from card activation, not from minimum-hours benchmarks. The only way to lose the locked rate is to let the 24 months expire without re-loading.",
  },
];

export default function MembershipsPage() {
  return (
    <>
      <PageHeader
        kicker="Memberships · jet card · on-demand"
        title="Three ways to fly. None of them require a membership."
        lead="Most charter brokers want you on a yearly retainer. We don't. The default is on-demand — pay per flight, locked pricing, zero commitment. The jet card and reserve programs exist because some clients want fixed hourly rates and guaranteed availability. Pick the one that fits your year."
      />

      {/* Anchor row */}
      <section className="border-b border-ink-3 py-6">
        <div className="container-jn flex flex-wrap gap-x-10 gap-y-3">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
            >
              {a.label}
            </a>
          ))}
        </div>
      </section>

      {/* ─── B1. Three Programs ─── */}
      <section id="tiers" className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Pick by how often you actually fly</p>
            </Reveal>
            <Reveal as="p" stagger={1} className="max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
              Under 25 hours a year? Stay on-demand. 25–100 hours? The jet card pays for itself in
              locked rates and avoided peak pricing. Over 100? Reserve gives you a guaranteed call-out
              window and a dedicated dispatcher.
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROGRAMS.map((p, i) => (
              <Reveal
                key={p.name}
                stagger={(i as 0 | 1 | 2)}
                className={[
                  "flex flex-col gap-6 rounded-[4px] border bg-ink-2 p-10 transition-all duration-200 ease-out-quint",
                  p.highlight
                    ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]"
                    : "border-ink-3 hover:border-[rgba(232,226,210,0.3)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                    — {p.badge}
                  </span>
                  {p.chip ? (
                    <span className="rounded-[2px] bg-clearance px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink">
                      {p.chip}
                    </span>
                  ) : null}
                </div>
                <h3 className="font-serif text-[32px] font-normal leading-[1.1] tracking-tight text-bone">
                  {p.name}
                </h3>
                <p className="text-[15px] leading-[1.55] text-bone-2">{p.strap}</p>
                <div className="border-t border-ink-3 pt-6">
                  <div className="font-serif text-[36px] font-light leading-none tracking-tight text-bone">
                    {p.price}
                  </div>
                  <p className="mt-2 max-w-[34ch] font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                    {p.priceSub}
                  </p>
                </div>
                <ul className="flex flex-col gap-3 border-t border-ink-3 pt-6">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[14px] leading-[1.55] text-bone"
                    >
                      <span className="text-clearance">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.cta.href}
                  className={[
                    "mt-auto inline-flex items-center justify-center gap-2",
                    p.highlight ? "btn btn-primary btn-lg" : "btn btn-secondary btn-lg",
                  ].join(" ")}
                >
                  {p.cta.label} <span className="arrow">→</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── B2. Compare table ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16">
            <Reveal>
              <p className="caption mb-6">— Honest comparison</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              JetNine vs. fractional vs. owning your own.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
              We&rsquo;re not the right answer for every flyer — if you fly 150+ hours a year on the
              same two routes, fractional or whole-aircraft will be cheaper. For everyone else,
              here&rsquo;s how the math works out.
            </Reveal>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b border-ink-3 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2"></th>
                  {COMPARE_COLUMNS.map((c, i) => (
                    <th
                      key={c}
                      className="border-b border-ink-3 px-6 py-5 align-bottom"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                          {COMPARE_KICKERS[i]}
                        </span>
                        <span className="font-serif text-[18px] font-normal tracking-tight text-bone">
                          {c}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-ink-3">
                    <td className="px-6 py-5 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                      {r.label}
                    </td>
                    {r.cells.map((cell, i) => (
                      <td
                        key={i}
                        className="px-6 py-5 align-top font-mono text-[12px] leading-[1.5] tracking-[0.02em] text-bone"
                      >
                        {cell.split(" / ").map((line, idx) => (
                          <span key={idx} className={idx === 0 ? "block text-bone" : "block text-bone-2"}>
                            {line}
                          </span>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── B3. Hourly rates ─── */}
      <section id="rates" className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Hourly rates</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                JetNine Card rates, by category.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                Locked for 24 months from card activation. Includes everything except FET (7.5%,
                federal) and FBO ramp fees. Compare to typical on-demand market rates — the savings
                are 12–18% on average, more during peak.
              </Reveal>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  {["Category", "Typical mission", "Sample lane", "On-demand market", "Locked card"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={[
                          "border-b border-ink-3 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2",
                          i === 4 ? "text-right" : "",
                        ].join(" ")}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {RATES.map((r) => (
                  <tr key={r.category} className="border-b border-ink-3 transition-colors hover:bg-ink-2">
                    <td className="px-6 py-6 font-serif text-[22px] font-normal text-bone">
                      {r.category}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                      {r.mission}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.06em] text-clearance">
                      {r.sample}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2">
                      {r.market}
                    </td>
                    <td className="px-6 py-6 text-right font-mono text-[14px] font-medium tracking-[0.04em] text-bone">
                      {r.locked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── B4. Card tiers ─── */}
      <section id="deposits" className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Card tiers</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                Three deposit levels. Same locked rates, more perks.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                Higher deposits earn faster call-out, larger annual allowances, and elevated empty-leg
                priority. The hourly rate is the same across tiers — what changes is the service envelope.
              </Reveal>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CARD_TIERS.map((t, i) => (
              <Reveal
                key={t.name}
                stagger={(i as 0 | 1 | 2)}
                className={[
                  "flex flex-col gap-5 rounded-[4px] border bg-ink-2 p-10 transition-all duration-200 ease-out-quint",
                  t.highlight
                    ? "border-clearance shadow-[0_0_0_1px_var(--clearance)]"
                    : "border-ink-3 hover:border-[rgba(232,226,210,0.3)]",
                ].join(" ")}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                  — {t.badge}
                </span>
                <h3 className="font-serif text-[28px] font-normal leading-[1.15] tracking-tight text-bone">
                  {t.name}
                </h3>
                <div className="border-y border-ink-3 py-5">
                  <div className="font-serif text-[36px] font-light leading-none tracking-tight text-bone">
                    {t.deposit}
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                    {t.depositSub}
                  </p>
                </div>
                <ul className="flex flex-col gap-3">
                  {t.items.map((it) => (
                    <li
                      key={it}
                      className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[14px] leading-[1.55] text-bone"
                    >
                      <span className="text-clearance">—</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── B5. Availability commitment ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Availability commitment</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
              If we don&rsquo;t deliver, we make it right.
            </Reveal>
          </div>
          <Reveal as="p" className="mb-16 max-w-[64ch] text-[18px] leading-[1.6] text-bone-2">
            Guaranteed call-out is a commitment, not a marketing line. If we can&rsquo;t put an airframe
            in the air for you within your tier&rsquo;s window, here&rsquo;s what happens.
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {AVAILABILITY.map((a, i) => (
              <Reveal
                key={a.num}
                stagger={(i % 2) as 0 | 1}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-6 rounded-[4px] border border-ink-3 bg-ink-2 px-8 py-7"
              >
                <span className="font-mono text-[36px] font-light leading-none text-clearance">
                  {a.num}
                </span>
                <div>
                  <h3 className="font-serif text-[20px] font-normal leading-[1.2] tracking-tight text-bone">
                    {a.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.55] text-bone-2">{a.sub}</p>
                </div>
                <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-clearance">
                  {a.val}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── B6. FAQ ─── */}
      <section id="faq" className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— FAQ</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              The questions most card prospects ask.
            </Reveal>
          </div>
          <div className="mx-auto max-w-[78ch] divide-y divide-ink-3 border-y border-ink-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer items-start justify-between gap-6 list-none">
                  <h3 className="font-serif text-[20px] font-normal leading-[1.3] tracking-tight text-bone transition-colors group-hover:text-clearance">
                    <span className="mr-3 font-mono text-[11px] tracking-[0.14em] text-clearance">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {f.q}
                  </h3>
                  <span className="font-mono text-[14px] text-clearance transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-[72ch] pl-9 text-[15px] leading-[1.7] text-bone-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="Talk to dispatch. We'll model the right program for you."
        body="Annual hours, typical lanes, peak-day exposure — fifteen minutes on the phone and we'll show you which program saves you money in writing."
        primary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
        secondary={{ label: "Request a quote", href: "/quote" }}
      />
    </>
  );
}
