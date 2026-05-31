import Link from "next/link";
import { and, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  memberships,
  reserveTransactions,
} from "@/db/schema/memberships";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatUSD } from "@/lib/quote-pricing";
import {
  MEMBERSHIP_SPECS,
  type MembershipProgram,
} from "@/lib/memberships";
import { BuyMembershipButton } from "@/components/account/buy-membership-button";
import { TopUpForm } from "@/components/account/top-up-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ activated?: string; cancelled?: string; topup?: string }>;
};

const CARD_TIERS: MembershipProgram[] = ["card_100", "card_250", "card_500"];

const STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  paused: "border-[var(--warn)] text-[var(--warn)]",
  expired: "border-bone-2 text-bone-2",
  cancelled: "border-steel text-steel",
};

export default async function AccountMembershipsPage({ searchParams }: Props) {
  await requireUser("/account/memberships");
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const flash = sp.activated
    ? { kind: "activated" as const }
    : sp.topup
      ? { kind: "topup" as const }
      : sp.cancelled
        ? { kind: "cancelled" as const }
        : null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <section className="container-jn py-12">
        <p className="caption mb-4">— Account · memberships</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          Nothing on file yet.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.55] text-bone-2">
          Memberships unlock once your account is provisioned. Submit a quote at{" "}
          <Link href="/quote" className="text-clearance">/quote</Link> or talk to dispatch.
        </p>
      </section>
    );
  }

  const [active] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.memberId, member.id), eq(memberships.status, "active")))
    .orderBy(desc(memberships.activatedOn))
    .limit(1);

  // Balance = signed sum of the ledger. Positive = available; negative
  // would indicate over-draft (shouldn't happen, but we surface it).
  let balanceUsd = 0;
  let ledger: Array<{
    id: string;
    kind: string;
    amountUsd: number;
    description: string | null;
    occurredAt: Date;
  }> = [];
  if (active) {
    // Balance + ledger touch the same table but with independent
    // aggregations — fire both queries concurrently to save one
    // round-trip on every page render (~20-40 ms p50).
    const [balanceRow, ledgerRows] = await Promise.all([
      db
        .select({ total: sum(reserveTransactions.amountUsd) })
        .from(reserveTransactions)
        .where(eq(reserveTransactions.memberId, member.id)),
      db
        .select({
          id: reserveTransactions.id,
          kind: reserveTransactions.kind,
          amountUsd: reserveTransactions.amountUsd,
          description: reserveTransactions.description,
          occurredAt: reserveTransactions.occurredAt,
        })
        .from(reserveTransactions)
        .where(eq(reserveTransactions.memberId, member.id))
        .orderBy(desc(reserveTransactions.occurredAt))
        .limit(12),
    ]);
    balanceUsd = Number(balanceRow[0]?.total ?? 0);
    ledger = ledgerRows;
  }

  return (
    <section className="container-jn py-12">
      {flash ? (
        <div
          className={[
            "mb-8 rounded-[3px] border px-5 py-4 font-mono text-[12px] tracking-[0.04em]",
            flash.kind === "activated" || flash.kind === "topup"
              ? "border-[var(--success)] bg-[rgba(78,159,107,0.08)] text-[var(--success)]"
              : "border-[var(--warn)] bg-[rgba(192,148,73,0.08)] text-[var(--warn)]",
          ].join(" ")}
        >
          {flash.kind === "activated"
            ? "— Membership activated. The deposit is sitting in your reserve balance below; we'll draw from it on each invoice."
            : flash.kind === "topup"
              ? "— Top-up received. Stripe confirmation hits your inbox; the new balance lands here once the webhook clears (usually a few seconds)."
              : "— Purchase cancelled. Nothing was charged."}
        </div>
      ) : null}

      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Account · memberships</p>
          <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
            {active ? MEMBERSHIP_SPECS[active.program].name : "On-demand."}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            {active
              ? `Activated ${active.activatedOn}. Locked hourly rates for ${MEMBERSHIP_SPECS[active.program].rateLockMonths} months. ${MEMBERSHIP_SPECS[active.program].calloutHours}-hour guaranteed call-out.`
              : "No card or reserve on file. You can fly on-demand with no commitment, or activate a Card below."}
          </p>
        </div>
        {active ? (
          <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
            <div className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                RESERVE BALANCE
              </dt>
              <dd
                className={[
                  "mt-1 font-serif text-[26px] font-light leading-none",
                  balanceUsd < 0 ? "text-[var(--error)]" : "text-bone",
                ].join(" ")}
              >
                {formatUSD(balanceUsd)}
              </dd>
            </div>
            <div className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                STATUS
              </dt>
              <dd>
                <span
                  className={[
                    "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] mt-2",
                    STATUS_CLASS[active.status] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {active.status}
                </span>
              </dd>
            </div>
          </dl>
        ) : null}
      </header>

      {active && ledger.length > 0 ? (
        <section className="mb-14">
          <p className="caption mb-3">— Reserve ledger</p>
          <ul className="overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 divide-y divide-ink-3">
            {ledger.map((row) => {
              const positive = row.amountUsd >= 0;
              const KIND_LABEL: Record<string, string> = {
                top_up: "Activation deposit",
                charter_draw: "Charter draw",
                credit_accrual: "Credit accrual",
                refund: "Refund",
                adjustment: "Adjustment",
              };
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5"
                >
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone">
                      {KIND_LABEL[row.kind] ?? row.kind}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-steel">
                      {row.description ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={[
                        "font-mono text-[14px] tracking-[0.02em]",
                        positive ? "text-[var(--success)]" : "text-bone",
                      ].join(" ")}
                    >
                      {positive ? "+" : "−"}
                      {formatUSD(Math.abs(row.amountUsd))}
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.04em] text-steel">
                      {row.occurredAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!active ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CARD_TIERS.map((p) => {
            const s = MEMBERSHIP_SPECS[p];
            return (
              <div
                key={p}
                className="flex flex-col gap-5 rounded-[4px] border border-ink-3 bg-ink-2 p-6"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — {s.name}
                  </p>
                  <p
                    className="mt-3 font-serif text-[32px] font-light leading-none tracking-tight text-bone"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {formatUSD(s.depositUsd)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                    refundable deposit
                  </p>
                </div>
                <ul className="flex flex-col gap-2 text-[13px] leading-[1.4] text-bone-2">
                  <li>{s.calloutHours}-hour guaranteed call-out</li>
                  <li>Locked rates {s.rateLockMonths} months</li>
                  <li>
                    {formatUSD(s.cateringAllowanceUsd)} catering
                    {s.groundAllowanceUsd ? ` + ${formatUSD(s.groundAllowanceUsd)} ground` : ""} / yr
                  </li>
                  <li>
                    {s.namedCardholdersLimit >= 999
                      ? "Unlimited"
                      : s.namedCardholdersLimit}{" "}
                    named cardholder{s.namedCardholdersLimit === 1 ? "" : "s"}
                  </li>
                  <li>
                    Empty-leg advance · {s.emptyLegAdvanceMinutes} min
                  </li>
                </ul>
                <BuyMembershipButton program={p} />
              </div>
            );
          })}
        </div>
      ) : null}

      {active ? <TopUpForm /> : null}

      <section className="mt-14">
        <p className="caption mb-3">— Other ways to fly</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[3px] border border-ink-3 bg-ink p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
              Reserve · 50 / 100 / 250 / 500
            </p>
            <p className="mt-2 text-[13px] leading-[1.55] text-bone-2">
              Dedicated dispatcher, 8-to-12-hour call-out, larger allowances. By
              application — limited seats.
            </p>
            <Link
              href="/contact?subject=reserve"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-clearance hover:text-bone"
            >
              Apply for Reserve →
            </Link>
          </div>
          <div className="rounded-[3px] border border-ink-3 bg-ink p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
              On-demand
            </p>
            <p className="mt-2 text-[13px] leading-[1.55] text-bone-2">
              No deposit, no commitment. Submit a quote and pay per flight. All-in
              pricing locked at acceptance.
            </p>
            <Link
              href="/quote"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-clearance hover:text-bone"
            >
              Request a quote →
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
