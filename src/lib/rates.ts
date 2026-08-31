// Published hourly rate card — the single marketing source of truth for
// dollar figures shown on /memberships, /cost-calculator, and any future
// cost/route/city pages. Competitor audit showed Paramount's pages quoting
// contradictory hourly rates ($2,900 vs $2,300 for the same category);
// keeping the card in one module means no two JetNine pages can disagree.
// The quote wizard's indicative engine (quote-pricing.ts) quotes whole-trip
// ranges, not hourly rates, so the two never collide on a page.
export type RateRow = {
  category: string;
  mission: string;
  sample: string;
  /** On-demand market hourly range. */
  market: string;
  /** JetNine Card locked hourly rate. */
  locked: string;
  /** Numeric bounds of the market range, for structured data (USD/hr). */
  marketLowUsd: number;
  marketHighUsd: number;
  /** Numeric locked rate, for structured data (USD/hr). */
  lockedUsd: number;
};

export const RATES: RateRow[] = [
  {
    category: "Light",
    mission: "3–4 pax · 1,500 NM · regional hops",
    sample: "KVNY → KASE",
    market: "$3,200–3,600/hr",
    locked: "$2,950/HR",
    marketLowUsd: 3200,
    marketHighUsd: 3600,
    lockedUsd: 2950,
  },
  {
    category: "Midsize",
    mission: "5–6 pax · 2,500 NM · transcon",
    sample: "KVNY → KTEB",
    market: "$4,200–4,600/hr",
    locked: "$3,950/HR",
    marketLowUsd: 4200,
    marketHighUsd: 4600,
    lockedUsd: 3950,
  },
  {
    category: "Super-mid",
    mission: "6–8 pax · 3,500 NM · transcon nonstop",
    sample: "KSFO → KMIA",
    market: "$5,400–5,900/hr",
    locked: "$5,100/HR",
    marketLowUsd: 5400,
    marketHighUsd: 5900,
    lockedUsd: 5100,
  },
  {
    category: "Heavy",
    mission: "8–12 pax · 4,500 NM · transatlantic",
    sample: "KJFK → EGLL",
    market: "$7,800–8,400/hr",
    locked: "$7,400/HR",
    marketLowUsd: 7800,
    marketHighUsd: 8400,
    lockedUsd: 7400,
  },
  {
    category: "Ultra long range",
    mission: "12–16 pax · 6,500+ NM · transpacific",
    sample: "KLAX → RJTT",
    market: "$10,400–11,200/hr",
    locked: "$9,850/HR",
    marketLowUsd: 10400,
    marketHighUsd: 11200,
    lockedUsd: 9850,
  },
];
