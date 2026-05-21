import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { reserveTransactions } from "@/db/schema/memberships";
import { trips } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

const PROGRAM_LABEL: Record<string, string> = {
  on_demand: "On-demand",
  card_100: "JetNine Card · 100",
  card_250: "JetNine Card · 250",
  card_500: "JetNine Card · 500",
  reserve_50: "Reserve · 50",
  reserve_100: "Reserve · 100",
  reserve_250: "Reserve · 250",
  reserve_500_apply: "Reserve · 500 (by application)",
};

const TX_KIND_LABEL: Record<string, string> = {
  top_up: "Top-up",
  charter_draw: "Charter draw",
  credit_accrual: "Cashback",
  refund: "Refund",
  adjustment: "Adjustment",
};

const TX_KIND_TONE: Record<string, string> = {
  top_up: "text-[var(--success)]",
  credit_accrual: "text-clearance",
  refund: "text-[var(--success)]",
  charter_draw: "text-bone-2",
  adjustment: "text-[var(--warn)]",
};

const STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  paused: "border-[var(--warn)] text-[var(--warn)]",
  expired: "border-steel text-steel",
  cancelled: "border-[var(--error)] text-[var(--error)]",
};

export default async function AccountMembersPage() {
  await requireUser("/account/members");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <section className="container-jn py-12">
        <p className="caption mb-4">— Account · membership</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          On-demand by default.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.55] text-bone-2">
          You don&rsquo;t need a membership to fly with JetNine. The card and reserve programs
          are optional — pay-as-you-fly works for most clients. Start a quote at{" "}
          <Link href="/quote" className="text-clearance">/quote</Link> or read the{" "}
          <Link href="/memberships" className="text-clearance">membership comparison</Link>.
        </p>
      </section>
    );
  }

  const programs = await db
    .select()
    .from(memberships)
    .where(eq(memberships.memberId, member.id))
    .orderBy(desc(memberships.activatedOn));

  const active = programs.find((p) => p.status === "active") ?? null;

  // Live balance: signed sum from the ledger.
  const [balanceRow] = await db
    .select({
      balance: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int`,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, member.id));
  const balance = balanceRow?.balance ?? 0;

  // Lifetime cashback only.
  const [cashbackRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int`,
    })
    .from(reserveTransactions)
    .where(
      sql`${reserveTransactions.memberId} = ${member.id} and ${reserveTransactions.kind} = 'credit_accrual'`,
    );
  const lifetimeCashback = cashbackRow?.total ?? 0;

  // Recent ledger (last 25).
  const ledger = await db
    .select({
      id: reserveTransactions.id,
      kind: reserveTransactions.kind,
      amountUsd: reserveTransactions.amountUsd,
      description: reserveTransactions.description,
      occurredAt: reserveTransactions.occurredAt,
      tripId: reserveTransactions.tripId,
      tripCode: trips.tripCode,
      invoiceId: reserveTransactions.invoiceId,
      invoiceCode: invoices.invoiceCode,
    })
    .from(reserveTransactions)
    .leftJoin(trips, eq(trips.id, reserveTransactions.tripId))
    .leftJoin(invoices, eq(invoices.id, reserveTransactions.invoiceId))
    .where(eq(reserveTransactions.memberId, member.id))
    .orderBy(desc(reserveTransactions.occurredAt))
    .limit(25);

  return (
    <section className="container-jn py-12">
      <header className="mb-10 border-b border-ink-3 pb-6">
        <p className="caption mb-3">— Account · membership</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          {active ? PROGRAM_LABEL[active.program] : "On-demand"}
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
          {active
            ? `Activated ${active.activatedOn}. ${active.calloutHours}-hour guaranteed callout. ${active.rateLockMonths}-month rate lock${active.cashbackPct && active.cashbackPct !== "0" ? ` · ${active.cashbackPct}% cashback` : ""}.`
            : "Pay-as-you-fly. No commitments. Upgrade to a card or reserve program anytime."}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Balance card */}
          {active ? (
            <section className="rounded-[4px] border border-clearance bg-[rgba(232,226,210,0.04)] p-8">
              <p className="caption mb-3">— Deposit balance</p>
              <div
                className="font-serif text-[64px] font-light leading-none tracking-tight text-bone"
                style={{ letterSpacing: "-0.02em" }}
              >
                {formatUSD(balance)}
              </div>
              <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.6] text-bone-2">
                Available to draw against future charters at your locked rate. Refundable within
                the 24-month rate window — no use-it-or-lose-it.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-ink-3 pt-5 text-[11px]">
                <div>
                  <div className="font-mono uppercase tracking-[0.14em] text-steel">— DEPOSIT</div>
                  <div className="mt-1 font-mono tracking-[0.04em] text-bone">
                    {formatUSD(active.depositUsd)}
                  </div>
                </div>
                <div>
                  <div className="font-mono uppercase tracking-[0.14em] text-steel">
                    — LIFETIME CASHBACK
                  </div>
                  <div className="mt-1 font-mono tracking-[0.04em] text-clearance">
                    {formatUSD(lifetimeCashback)}
                  </div>
                </div>
                <div>
                  <div className="font-mono uppercase tracking-[0.14em] text-steel">— CALLOUT</div>
                  <div className="mt-1 font-mono tracking-[0.04em] text-bone">
                    {active.calloutHours}h
                  </div>
                </div>
                <div>
                  <div className="font-mono uppercase tracking-[0.14em] text-steel">
                    — RATE LOCK
                  </div>
                  <div className="mt-1 font-mono tracking-[0.04em] text-bone">
                    {active.rateLockMonths} mo · expires{" "}
                    {active.expiresOn ?? "—"}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
              <p className="caption mb-3">— No program enrolled</p>
              <p className="text-[15px] leading-[1.55] text-bone-2">
                You&rsquo;re flying on-demand. If you fly 25+ hours a year, the JetNine Card pays
                for itself in locked rates and avoided peak pricing. Talk to dispatch about the
                math.
              </p>
              <Link href="/memberships" className="btn btn-primary btn-sm mt-6">
                See programs <span className="arrow">→</span>
              </Link>
            </section>
          )}

          {/* Recent ledger */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="caption">— Recent activity</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                {ledger.length} of last 25
              </span>
            </div>
            {ledger.length === 0 ? (
              <p className="text-[13px] leading-[1.55] text-bone-2">
                No ledger activity yet. Top-ups, charter draws, and cashback accruals all show up
                here.
              </p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {ledger.map((tx) => (
                  <li
                    key={tx.id}
                    className="grid grid-cols-[80px_1fr_auto] items-baseline gap-4 py-4"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                      {tx.occurredAt.toISOString().slice(0, 10)}
                    </span>
                    <div>
                      <div
                        className={[
                          "font-mono text-[11px] uppercase tracking-[0.14em]",
                          TX_KIND_TONE[tx.kind] ?? "text-bone-2",
                        ].join(" ")}
                      >
                        — {TX_KIND_LABEL[tx.kind] ?? tx.kind}
                      </div>
                      <div className="mt-1 text-[13px] leading-[1.45] text-bone">
                        {tx.description ??
                          (tx.tripCode
                            ? `Trip ${tx.tripCode}`
                            : tx.invoiceCode
                              ? `Invoice ${tx.invoiceCode}`
                              : "—")}
                      </div>
                    </div>
                    <span
                      className={[
                        "font-mono text-[14px] tracking-[0.04em]",
                        tx.amountUsd >= 0 ? "text-[var(--success)]" : "text-bone",
                      ].join(" ")}
                    >
                      {tx.amountUsd >= 0 ? "+" : ""}
                      {formatUSD(tx.amountUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column — program detail + history */}
        <div className="flex flex-col gap-6">
          {active ? (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <h2 className="caption mb-4">— Program details</h2>
              <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-3 text-[12px]">
                <Row k="— Cashback">
                  <span className="font-mono tracking-[0.04em] text-clearance">
                    {active.cashbackPct}%
                  </span>
                </Row>
                <Row k="— Catering allowance">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {active.cateringAllowanceUsd
                      ? `${formatUSD(active.cateringAllowanceUsd)} / yr`
                      : "—"}
                  </span>
                </Row>
                <Row k="— Ground allowance">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {active.groundAllowanceUsd
                      ? `${formatUSD(active.groundAllowanceUsd)} / yr`
                      : "—"}
                  </span>
                </Row>
                <Row k="— Named cardholders">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {active.namedCardholdersLimit === 99
                      ? "Unlimited"
                      : active.namedCardholdersLimit}
                  </span>
                </Row>
                <Row k="— Empty-leg early access">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {active.emptyLegAdvanceMinutes} min before public board
                  </span>
                </Row>
                <Row k="— Auto-renew">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {active.autoRenew ? "On" : "Off"}
                  </span>
                </Row>
              </dl>
            </section>
          ) : null}

          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Program history</h2>
            {programs.length === 0 ? (
              <p className="text-[13px] leading-[1.55] text-bone-2">
                No program history. Dispatch enrolls you on the membership of your choice.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {programs.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-[3px] border border-ink-3 bg-ink p-4"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-[16px] text-bone">
                        {PROGRAM_LABEL[p.program] ?? p.program}
                      </span>
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                          STATUS_CLASS[p.status] ?? "border-ink-3 text-bone-2",
                        ].join(" ")}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {p.activatedOn} → {p.expiresOn ?? "open"} · {formatUSD(p.depositUsd)} deposit
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{k}</dt>
      <dd>{children}</dd>
    </>
  );
}
