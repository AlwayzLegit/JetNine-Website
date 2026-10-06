import Link from "next/link";
import { SITE } from "@/lib/constants";
import { USD, formatDay } from "@/lib/request-page";
import { Eyebrow, PANEL, UnderLink } from "./panel";

// Overview cards of the member account (Light - Account): JetNine Card
// balance, payments, your dispatcher. Each one renders its own empty
// state so the page can hand it a null when a query failed.

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

const CARD = `${PANEL} px-5 py-[18px]`;

function CardHead({ label, href, linkText }: { label: string; href: string; linkText: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Eyebrow>{label}</Eyebrow>
      <UnderLink href={href}>{linkText}</UnderLink>
    </div>
  );
}

export function MembershipCard({ membership }: { membership: MembershipSummary | null }) {
  if (!membership) {
    return (
      <section className={CARD}>
        <CardHead label="Membership" href="/memberships" linkText="See programs" />
        <div className="mt-2 font-serif text-[21px] leading-[1.15] text-bone">On-demand · no membership</div>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-steel">
          Pay as you fly. A card or reserve program locks your rate and guarantees an aircraft.
        </p>
      </section>
    );
  }
  const pct = membership.depositUsd > 0 ? Math.max(0, Math.min(100, Math.round((membership.balanceUsd / membership.depositUsd) * 100))) : 0;
  const renews = membership.autoRenew
    ? renewWords(membership.nextRenewalDate ?? membership.expiresOn)
    : null;
  const expires = !renews ? renewWords(membership.expiresOn) : null;
  return (
    <section className={CARD}>
      <CardHead label={PROGRAM_WORDS[membership.program] ?? membership.program} href="/account/members" linkText="Manage" />
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-serif text-[28px] leading-[1.15] text-bone">{USD.format(membership.balanceUsd)} left</span>
        <span className="text-[13px] text-steel">of {USD.format(membership.depositUsd)}</span>
      </div>
      <div
        className="mt-2 h-1.5 bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Deposit remaining"
      >
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-steel">
        <span>{renews ? `Renews ${renews}` : expires ? `Rate lock until ${expires}` : "Rate locked"}</span>
        <Link href="/account/memberships" className="underline underline-offset-[3px] transition-colors hover:text-gold">
          Buy / top up
        </Link>
      </div>
    </section>
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
    <section className={CARD}>
      <CardHead label="Invoices" href="/account/invoices" linkText="All invoices" />
      <div className="mt-2 font-serif text-[21px] leading-[1.15] text-bone">
        {s.dueCount === 0
          ? "Nothing outstanding"
          : `${s.dueCount} invoice${s.dueCount === 1 ? "" : "s"} due · ${USD.format(s.dueTotalUsd)}`}
      </div>
      {lastPaid ? <div className="mt-1 text-[14px] text-steel">Last paid: {lastPaid}</div> : null}
      {s.dueCount > 0 ? (
        <div className="mt-3 flex items-center gap-2.5 bg-surface-2 px-3 py-2.5 text-[13px] text-bone">
          <span className="text-gold" aria-hidden="true">
            ●
          </span>
          <Link href="/account/invoices" className="underline underline-offset-[3px] hover:text-gold">
            Pay online with a card
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export type Dispatcher = { displayName: string; directLineE164: string | null } | null;

export function DispatcherCard({ dispatcher, subject }: { dispatcher: Dispatcher; subject?: string }) {
  const name = dispatcher?.displayName ?? "JetNine dispatch";
  const initial = name.trim().charAt(0).toUpperCase() || "J";
  const phone = dispatcher?.directLineE164 ?? SITE.dispatchPhoneE164;
  const mail = subject ? `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}` : `mailto:${SITE.email}`;
  const btn =
    "flex h-[34px] items-center justify-center border border-line bg-surface text-[13px] text-bone transition-colors hover:text-gold";
  return (
    <section className={CARD}>
      <Eyebrow>Your dispatcher</Eyebrow>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 font-serif text-gold">
          {initial}
        </span>
        <div>
          <div className="text-[14px] font-bold text-bone">{name}</div>
          <div className="text-[12px] text-success">Dispatch open</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <a href={`tel:${phone}`} className={btn}>
          Call
        </a>
        <a href={`sms:${SITE.dispatchPhoneE164}`} className={btn}>
          Text
        </a>
        <a href={mail} className={btn}>
          Email
        </a>
      </div>
    </section>
  );
}
