import Link from "next/link";
import { SITE } from "@/lib/constants";
import { USD, formatDay } from "@/lib/request-page";

// Right-column cards of the account overview (Account.dc.html): Membership,
// Invoices, Your dispatcher. Each one renders its own empty state so the
// page can hand it a null when a query failed.

export const PROGRAM_WORDS: Record<string, string> = {
  on_demand: "On-demand",
  card_100: "JetNine Card · 100",
  card_250: "JetNine Card · 250",
  card_500: "JetNine Card · 500",
  reserve_50: "Reserve · 50",
  reserve_100: "Reserve · 100",
  reserve_250: "Reserve · 250",
  reserve_500_apply: "Reserve · 500",
};

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function renewWords(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : MONTH_FMT.format(d);
}

export type MembershipSummary = {
  program: string;
  /** Live deposit balance from the reserve ledger, in dollars. */
  balanceUsd: number;
  depositUsd: number;
  nextRenewalDate: string | null;
  expiresOn: string | null;
  autoRenew: boolean;
};

export function MembershipCard({ membership }: { membership: MembershipSummary | null }) {
  if (!membership) {
    return (
      <div className="card p-6">
        <div className="label-jn text-[13px]">Membership</div>
        <div className="mt-2 text-[20px] font-medium text-bone">On-demand · no membership</div>
        <p className="mt-2 text-[14px] leading-[1.5] text-bone-2">
          Pay as you fly. A card or reserve program locks your rate and guarantees an aircraft.
        </p>
        <Link href="/memberships" className="text-link mt-3 inline-block text-[15px]">
          See programs
        </Link>
      </div>
    );
  }
  const pct = membership.depositUsd > 0 ? Math.max(0, Math.min(100, Math.round((membership.balanceUsd / membership.depositUsd) * 100))) : 0;
  const renews = membership.autoRenew
    ? renewWords(membership.nextRenewalDate ?? membership.expiresOn)
    : null;
  const expires = !renews ? renewWords(membership.expiresOn) : null;
  return (
    <div className="card p-6">
      <div className="label-jn text-[13px]">Membership</div>
      <div className="mt-2 text-[20px] font-medium text-bone">
        {PROGRAM_WORDS[membership.program] ?? membership.program}
      </div>
      <div className="mt-3.5 flex items-baseline justify-between text-[15px]">
        <span className="text-bone">{USD.format(membership.balanceUsd)} left</span>
        <span className="text-steel">of {USD.format(membership.depositUsd)}</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Deposit remaining"
      >
        <div className="h-full bg-clearance" style={{ width: `${pct}%` }} />
      </div>
      {renews ? (
        <div className="mt-2 text-[14px] text-steel">Renews {renews}</div>
      ) : expires ? (
        <div className="mt-2 text-[14px] text-steel">Rate locked until {expires}</div>
      ) : null}
      <Link href="/account/memberships" className="btn btn-secondary mt-4 w-full">
        Buy / top up
      </Link>
    </div>
  );
}

export type InvoiceSummary = {
  dueCount: number;
  dueTotalUsd: number;
  lastPaid: { totalUsd: number | null; paidOn: string | null } | null;
};

export function InvoicesCard({ summary }: { summary: InvoiceSummary | null }) {
  const s = summary ?? { dueCount: 0, dueTotalUsd: 0, lastPaid: null };
  const lastPaid = s.lastPaid
    ? [s.lastPaid.totalUsd != null ? USD.format(s.lastPaid.totalUsd) : null, formatDay(s.lastPaid.paidOn)?.replace(/^\w+, /, "")]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <div className="card p-6">
      <div className="label-jn text-[13px]">Invoices</div>
      <div className="mt-2 text-[17px] font-medium text-bone">
        {s.dueCount === 0
          ? "Nothing outstanding"
          : `${s.dueCount} invoice${s.dueCount === 1 ? "" : "s"} due · ${USD.format(s.dueTotalUsd)}`}
      </div>
      {lastPaid ? <div className="mt-1 text-[14px] text-bone-2">Last paid: {lastPaid}</div> : null}
      <Link href="/account/invoices" className="text-link mt-3 inline-block text-[15px]">
        All invoices
      </Link>
    </div>
  );
}

export type Dispatcher = { displayName: string; directLineE164: string | null } | null;

export function DispatcherCard({ dispatcher, subject }: { dispatcher: Dispatcher; subject?: string }) {
  const name = dispatcher?.displayName ?? "JetNine dispatch";
  const initial = name.trim().charAt(0).toUpperCase() || "J";
  const phone = dispatcher?.directLineE164 ?? SITE.dispatchPhoneE164;
  const mail = subject ? `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}` : `mailto:${SITE.email}`;
  return (
    <div className="card p-6">
      <div className="label-jn text-[13px]">Your dispatcher</div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-2 font-semibold text-clearance">
          {initial}
        </span>
        <div>
          <div className="text-[17px] font-medium text-bone">{name}</div>
          <div className="text-[14px] text-success">Dispatch open</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a href={`tel:${phone}`} className="btn btn-secondary px-0">
          Call
        </a>
        <a href={`sms:${SITE.dispatchPhoneE164}`} className="btn btn-secondary px-0">
          Text
        </a>
        <a href={mail} className="btn btn-secondary px-0">
          Email
        </a>
      </div>
    </div>
  );
}
