import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema/memberships";
import { reserveTransactions } from "@/db/schema/memberships";
import { trips } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { MEMBERSHIP_SPECS, type MembershipProgram } from "@/lib/memberships";
import { formatDay, USD } from "@/lib/request-page";
import { MembershipActivity, type ActivityRow } from "@/components/account/membership-activity";

export const dynamic = "force-dynamic";

/** "JetNine Card" / "Reserve" / "On-demand" — the family, for the title. */
function programFamily(program: MembershipProgram): string {
  if (program.startsWith("card_")) return "JetNine Card";
  if (program.startsWith("reserve_")) return "Reserve";
  return "On-demand";
}

const STATUS_SENTENCE: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  expired: "Expired",
  cancelled: "Cancelled",
};

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Aug 2, 2025" from a YYYY-MM-DD date. */
function longDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : LONG_DATE.format(d);
}

export default async function AccountMembersPage() {
  await requireUser("/account/members");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <>
        <h1 className="title-app text-bone">On-demand</h1>
        <p className="mt-2.5 max-w-[60ch] text-[17px] text-bone-2">
          You don&rsquo;t need a membership to fly with JetNine. Pay per flight, no commitment.
        </p>
        <OnDemandCard />
      </>
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

  const spec = active ? MEMBERSHIP_SPECS[active.program] : null;
  const title = active ? programFamily(active.program) : "On-demand";

  const cashback =
    active && active.cashbackPct && active.cashbackPct !== "0" && active.cashbackPct !== "0.00"
      ? ` ${Number(active.cashbackPct)}% cashback on every flight.`
      : "";
  const sentence = active
    ? `${spec?.name ?? title}, active since ${formatDay(active.activatedOn) ?? active.activatedOn}. Aircraft guaranteed with ${active.calloutHours} hours' notice; your hourly rates are locked for ${active.rateLockMonths} months.${cashback}`
    : "Pay per flight, no commitment. Add a card or reserve program whenever it starts to make sense.";

  const pct =
    active && active.depositUsd > 0
      ? Math.max(0, Math.min(100, Math.round((balance / active.depositUsd) * 100)))
      : 0;

  const renewal = active
    ? active.nextRenewalDate
      ? `Renews ${longDate(active.nextRenewalDate)}`
      : active.expiresOn
        ? `Rate lock ends ${longDate(active.expiresOn)}`
        : "No renewal date set"
    : null;

  const activity: ActivityRow[] = ledger.map((tx) => ({
    id: tx.id,
    kind: tx.kind,
    amountUsd: tx.amountUsd,
    description: tx.description,
    occurredAt: tx.occurredAt.toISOString(),
    tripId: tx.tripId,
  }));

  return (
    <>
      <h1 className="title-app text-bone">{title}</h1>
      <p className="mt-2.5 max-w-[64ch] text-[17px] text-bone-2">{sentence}</p>

      {active && spec ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-4">
            {/* Balance */}
            <section className="card card-pad">
              <h2 className="label-jn text-[13px]">Balance</h2>
              <div className="mt-2 font-serif text-[40px] font-light leading-none text-bone">
                {USD.format(balance)}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
                <span className="text-bone">Reserve dollars left</span>
                <span className="text-steel">of {USD.format(active.depositUsd)} deposited</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-2"
                role="progressbar"
                aria-label="Reserve balance"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="h-full bg-clearance" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[14px] text-steel">{renewal}</p>
              <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.55] text-bone-2">
                Drawn against future flights at your locked rate. Refundable within the rate window
                — nothing expires if you fly less than planned.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="/account/memberships" className="btn btn-secondary">
                  Buy / top up
                </Link>
                <Link href="/quote/mission" className="btn btn-secondary">
                  Request a quote
                </Link>
              </div>
            </section>

            {/* Activity */}
            <section>
              <h2 className="label-jn text-[13px]">Activity</h2>
              <MembershipActivity rows={activity} />
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="card card-pad">
              <h2 className="label-jn text-[13px]">What&rsquo;s included</h2>
              <dl className="dl-jn mt-4">
                <dt>Program</dt>
                <dd>{spec.name}</dd>
                <dt>Call-out</dt>
                <dd>Aircraft guaranteed with {active.calloutHours} hours&rsquo; notice</dd>
                <dt>Rate lock</dt>
                <dd>
                  {active.rateLockMonths} months
                  {active.expiresOn ? ` · ends ${longDate(active.expiresOn)}` : ""}
                </dd>
                <dt>Cashback</dt>
                <dd>
                  {active.cashbackPct && Number(active.cashbackPct) > 0
                    ? `${Number(active.cashbackPct)}% · ${USD.format(lifetimeCashback)} earned so far`
                    : "None on this program"}
                </dd>
                <dt>Catering</dt>
                <dd>
                  {active.cateringAllowanceUsd
                    ? `${USD.format(active.cateringAllowanceUsd)} allowance a year`
                    : "No allowance"}
                </dd>
                <dt>Ground</dt>
                <dd>
                  {active.groundAllowanceUsd
                    ? `${USD.format(active.groundAllowanceUsd)} allowance a year`
                    : "Booked at cost"}
                </dd>
                <dt>Cardholders</dt>
                <dd>
                  {active.namedCardholdersLimit >= 99
                    ? "Unlimited named cardholders"
                    : `${active.namedCardholdersLimit} named ${active.namedCardholdersLimit === 1 ? "cardholder" : "cardholders"}`}
                </dd>
                <dt>Empty legs</dt>
                <dd>{active.emptyLegAdvanceMinutes} minutes before the public board</dd>
                <dt>Auto-renew</dt>
                <dd>{active.autoRenew ? "On" : "Off"}</dd>
              </dl>
            </section>

            <HistoryCard programs={programs} />
          </div>
        </div>
      ) : (
        <>
          <OnDemandCard memberWithoutProgram />
          {ledger.length > 0 ? (
            <section className="mt-8">
              <h2 className="label-jn text-[13px]">Activity</h2>
              <MembershipActivity rows={activity} />
            </section>
          ) : null}
          {programs.length > 0 ? (
            <div className="mt-8">
              <HistoryCard programs={programs} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * The on-demand explanation. Shown to signed-in users without a member
 * profile and to members without an active program.
 */
function OnDemandCard({ memberWithoutProgram = false }: { memberWithoutProgram?: boolean }) {
  return (
    <section className="card card-pad mt-8 max-w-[720px]">
      <h2 className="title-card-sm text-bone">You&rsquo;re flying on-demand.</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.55] text-bone-2">
        Every quote is all-in and locked at acceptance, with no deposit and no annual fee. If you
        fly 25 hours a year or more, the JetNine Card usually pays for itself in locked rates and
        avoided peak pricing — dispatch can run the numbers for you.
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href="/memberships" className="btn btn-primary">
          See programs <span aria-hidden="true">→</span>
        </Link>
        {memberWithoutProgram ? (
          <Link href="/account/memberships" className="btn btn-secondary">
            Buy the card
          </Link>
        ) : null}
        <Link href="/quote/mission" className="btn btn-secondary">
          Request a quote
        </Link>
      </div>
    </section>
  );
}

function HistoryCard({
  programs,
}: {
  programs: Array<{
    id: string;
    program: MembershipProgram;
    status: string;
    activatedOn: string;
    expiresOn: string | null;
    depositUsd: number;
  }>;
}) {
  return (
    <section className="card">
      <h2 className="label-jn px-7 pt-6 text-[13px]">History</h2>
      {programs.length === 0 ? (
        <p className="px-7 pb-6 pt-2 text-[15px] text-bone-2">
          No programs yet. Dispatch enrols you on the one you choose.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-faint">
          {programs.map((p) => (
            <li key={p.id} className="px-7 py-4 text-[15px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium text-bone">{MEMBERSHIP_SPECS[p.program]?.name ?? "Program"}</span>
                <span className={p.status === "active" ? "text-success" : "text-steel"}>
                  {STATUS_SENTENCE[p.status] ?? p.status}
                </span>
              </div>
              <div className="mt-0.5 text-[14px] text-bone-2">
                {longDate(p.activatedOn)}
                {p.expiresOn ? ` to ${longDate(p.expiresOn)}` : " onwards"} · {USD.format(p.depositUsd)}{" "}
                deposit
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
