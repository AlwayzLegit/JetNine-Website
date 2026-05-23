// Membership tier specs — one source of truth for pricing + terms.
// Marketing page reads these for the comparison table; purchase action
// reads them to size the Stripe Checkout; webhook reads them to stamp
// the membership row on activation. Keep numbers here in sync with the
// member-facing copy on /memberships.

export type MembershipProgram =
  | "on_demand"
  | "card_100"
  | "card_250"
  | "card_500"
  | "reserve_50"
  | "reserve_100"
  | "reserve_250"
  | "reserve_500_apply";

export type MembershipSpec = {
  program: MembershipProgram;
  // Human label, matches the marketing copy.
  name: string;
  // Deposit (whole USD).
  depositUsd: number;
  // Hours of advance notice we guarantee an airframe.
  calloutHours: number;
  // Months the hourly rate stays locked.
  rateLockMonths: number;
  // Annual catering (+ ground for higher tiers) allowance.
  cateringAllowanceUsd: number;
  groundAllowanceUsd: number;
  // Cap on named cardholders. Use a high sentinel (9999) for "unlimited".
  namedCardholdersLimit: number;
  // How many minutes before public listing the member sees an empty leg.
  emptyLegAdvanceMinutes: number;
  // Self-serve via Stripe Checkout — only the three Card tiers. Reserve
  // is by application; the UI links to /contact instead.
  selfServe: boolean;
  marketingHref: string;
};

export const MEMBERSHIP_SPECS: Record<MembershipProgram, MembershipSpec> = {
  on_demand: {
    program: "on_demand",
    name: "On-demand",
    depositUsd: 0,
    calloutHours: 0,
    rateLockMonths: 0,
    cateringAllowanceUsd: 0,
    groundAllowanceUsd: 0,
    namedCardholdersLimit: 1,
    emptyLegAdvanceMinutes: 0,
    selfServe: false,
    marketingHref: "/quote",
  },
  card_100: {
    program: "card_100",
    name: "Card · 100",
    depositUsd: 100_000,
    calloutHours: 72,
    rateLockMonths: 24,
    cateringAllowanceUsd: 2_500,
    groundAllowanceUsd: 0,
    namedCardholdersLimit: 1,
    emptyLegAdvanceMinutes: 30,
    selfServe: true,
    marketingHref: "/memberships#deposits",
  },
  card_250: {
    program: "card_250",
    name: "Card · 250",
    depositUsd: 250_000,
    calloutHours: 48,
    rateLockMonths: 24,
    cateringAllowanceUsd: 8_000,
    groundAllowanceUsd: 0,
    namedCardholdersLimit: 3,
    emptyLegAdvanceMinutes: 30,
    selfServe: true,
    marketingHref: "/memberships#deposits",
  },
  card_500: {
    program: "card_500",
    name: "Card · 500",
    depositUsd: 500_000,
    calloutHours: 24,
    rateLockMonths: 36,
    cateringAllowanceUsd: 20_000,
    groundAllowanceUsd: 0,
    namedCardholdersLimit: 9999,
    emptyLegAdvanceMinutes: 60,
    selfServe: true,
    marketingHref: "/memberships#deposits",
  },
  // Reserve tiers — by application only. Spec fields populated for
  // completeness in case ops creates the membership manually; selfServe
  // is false so the buy button never renders.
  reserve_50: {
    program: "reserve_50",
    name: "Reserve · 50",
    depositUsd: 50_000,
    calloutHours: 12,
    rateLockMonths: 12,
    cateringAllowanceUsd: 5_000,
    groundAllowanceUsd: 2_500,
    namedCardholdersLimit: 4,
    emptyLegAdvanceMinutes: 45,
    selfServe: false,
    marketingHref: "/contact?subject=reserve",
  },
  reserve_100: {
    program: "reserve_100",
    name: "Reserve · 100",
    depositUsd: 100_000,
    calloutHours: 10,
    rateLockMonths: 12,
    cateringAllowanceUsd: 10_000,
    groundAllowanceUsd: 5_000,
    namedCardholdersLimit: 6,
    emptyLegAdvanceMinutes: 45,
    selfServe: false,
    marketingHref: "/contact?subject=reserve",
  },
  reserve_250: {
    program: "reserve_250",
    name: "Reserve · 250",
    depositUsd: 250_000,
    calloutHours: 8,
    rateLockMonths: 12,
    cateringAllowanceUsd: 20_000,
    groundAllowanceUsd: 10_000,
    namedCardholdersLimit: 9999,
    emptyLegAdvanceMinutes: 60,
    selfServe: false,
    marketingHref: "/contact?subject=reserve",
  },
  reserve_500_apply: {
    program: "reserve_500_apply",
    name: "Reserve · 500",
    depositUsd: 500_000,
    calloutHours: 8,
    rateLockMonths: 12,
    cateringAllowanceUsd: 50_000,
    groundAllowanceUsd: 25_000,
    namedCardholdersLimit: 9999,
    emptyLegAdvanceMinutes: 60,
    selfServe: false,
    marketingHref: "/contact?subject=reserve",
  },
};

export function isMembershipProgram(s: string): s is MembershipProgram {
  return Object.prototype.hasOwnProperty.call(MEMBERSHIP_SPECS, s);
}

export function getMembershipSpec(program: MembershipProgram): MembershipSpec {
  return MEMBERSHIP_SPECS[program];
}

export const SELF_SERVE_PROGRAMS: MembershipProgram[] = (
  Object.values(MEMBERSHIP_SPECS) as MembershipSpec[]
)
  .filter((s) => s.selfServe)
  .map((s) => s.program);
