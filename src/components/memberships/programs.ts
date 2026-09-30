// The three programs on /memberships. Shared by the page (JSON-LD offer
// catalog) and the client-side picker so the two can never drift.
// Thresholds mirror the copy: on-demand under 25 h, Card 25–100 h,
// Reserve over 100 h a year.

export type ProgramKey = "ondemand" | "card" | "reserve";

export type Program = {
  key: ProgramKey;
  badge: string;
  chip: string | null;
  name: string;
  strap: string;
  price: string;
  priceSub: string;
  features: string[];
  cta: { label: string; href: string };
};

export const PROGRAMS: Program[] = [
  {
    key: "ondemand",
    badge: "Program 01",
    chip: null,
    name: "On-Demand",
    strap: "Pay per flight, no commitment. The default. The right choice for most.",
    price: "$0",
    priceSub: "No deposit, no annual fee, no minimum spend.",
    features: [
      "All-in pricing — every quote includes fuel, FET, repositioning, crew, catering, ground.",
      "Locked at acceptance — the number you accept is the number on the invoice.",
      "30-min quote turnaround with three to five specific aircraft.",
      "Empty-leg watchlist included free; no SMS-alert fees.",
      "Best fit for under 25 flight hours per year.",
    ],
    cta: { label: "Request a quote", href: "/quote/mission" },
  },
  {
    key: "card",
    badge: "Program 02",
    chip: "Most chosen",
    name: "JetNine Card",
    strap: "Refundable deposit. Fixed hourly rate. No peak-day surcharges, ever.",
    price: "From $100k",
    priceSub: "Deposit is yours — applied against flights, refundable if unused after 24 months.",
    features: [
      "Fixed hourly rates by category, locked for 24 months from card activation.",
      "No peak-day pricing. Thanksgiving Wednesday at the same rate as a Tuesday in March.",
      "72-hour call-out — guaranteed availability with three days notice.",
      "Same dispatcher relationship; same vetting protocol.",
      "Best fit for 25–100 flight hours per year.",
    ],
    cta: { label: "See card tiers", href: "#deposits" },
  },
  {
    key: "reserve",
    badge: "Program 03",
    chip: null,
    name: "Reserve",
    strap:
      "Guaranteed availability with as little as 8 hours notice. Dedicated dispatcher. White-glove.",
    price: "From $500k",
    priceSub: "Annual program review. By application — limited number of seats.",
    features: [
      "8-hour call-out — guaranteed aircraft in the air, anywhere in the continental US.",
      "Dedicated dispatcher assigned to your account; same person, every time.",
      "Priority access to the largest-cabin aircraft during demand peaks.",
      "Annual catering & ground-transport allowance included.",
      "Best fit for 100+ flight hours per year, time-critical missions.",
    ],
    cta: { label: "Apply for Reserve", href: "/contact?subject=reserve" },
  },
];

export function pickProgram(hours: number): ProgramKey {
  if (hours < 25) return "ondemand";
  if (hours <= 100) return "card";
  return "reserve";
}

export const SUGGESTION: Record<ProgramKey, string> = {
  ondemand: "Stay on-demand — no deposit needed.",
  card: "The JetNine Card pays for itself in locked rates.",
  reserve: "Reserve — guaranteed call-out and a dedicated dispatcher.",
};
