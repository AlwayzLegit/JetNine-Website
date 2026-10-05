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
import { BTN_LINE, BTN_PRIMARY, PANEL, PageHead, UnderLink } from "@/components/account/panel";

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
        <PageHead
          title="On-demand"
          sub="You don’t need a membership to fly with JetNine. Pay per flight, no commitment."
        />
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
      <PageHead title={title} sub={sentence} />

      {active && spec ? (
        <div className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className={`${PANEL} px-6 py-[22px] max-md:px-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-serif text-[36px] leading-[1.1] text-bone">{USD.format(balance)} left</span>
              <span className="text-[14px] text-steel">
                of {USD.format(active.depositUsd)} · {spec.name}
              </span>
            </div>
            <div
              className="mt-2.5 h-2 bg-surface-2"
              role="progressbar"
              aria-label="Reserve balance"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <dl className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3 text-[14px]">
              <div>
                <dt className="text-[12px] text-steel">Term</dt>
                <dd className="mt-0.5 text-bone">{renewal}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-steel">Booking notice</dt>
                <dd className="mt-0.5 text-bone">{active.calloutHours} hours</dd>
              </div>
              <div>
                <dt className="text-[12px] text-steel">Catering allowance</dt>
                <dd className="mt-0.5 text-bone">
                  {active.cateringAllowanceUsd ? `${USD.format(active.cateringAllowanceUsd)} a year` : "None"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.55] text-steel">
              Drawn against future flights at your locked rate. Refundable within the rate window
              — nothing expires if you fly less than planned.
            </p>

            <h2 className="mt-5 font-serif text-[20px] font-normal text-bone">Recent activity</h2>
            <MembershipActivity rows={activity} />
          </section>

          <div className="flex flex-col gap-3">
            <div className="on-navy bg-navy px-5 py-5">
              <div className="font-serif text-[22px] leading-[1.15] text-bone">Add to your balance</div>
              <p className="mt-2 text-[13px] leading-[1.5] text-bone-2">
                Top up at your locked {spec.name} rate. Same call-out window — the balance just lasts longer.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/account/memberships" className="btn btn-on-navy btn-sm">
                  Buy / top up <span aria-hidden="true">→</span>
                </Link>
                <Link href="/quote/mission" className="btn btn-secondary btn-sm">
                  Request a quote
                </Link>
              </div>
            </div>

            <section className={`${PANEL} px-5 py-[18px]`}>
              <div className="text-[14px] font-bold text-bone">What&rsquo;s included</div>
              <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-[1.5]">
                <dt className="text-steel">Program</dt>
                <dd className="text-bone">{spec.name}</dd>
                <dt className="text-steel">Call-out</dt>
                <dd className="text-bone">Aircraft guaranteed with {active.calloutHours} hours&rsquo; notice</dd>
                <dt className="text-steel">Rate lock</dt>
                <dd className="text-bone">
                  {active.rateLockMonths} months
                  {active.expiresOn ? ` · ends ${longDate(active.expiresOn)}` : ""}
                </dd>
                <dt className="text-steel">Cashback</dt>
                <dd className="text-bone">
                  {active.cashbackPct && Number(active.cashbackPct) > 0
                    ? `${Number(active.cashbackPct)}% · ${USD.format(lifetimeCashback)} earned so far`
                    : "None on this program"}
                </dd>
                <dt className="text-steel">Catering</dt>
                <dd className="text-bone">
                  {active.cateringAllowanceUsd
                    ? `${USD.format(active.cateringAllowanceUsd)} allowance a year`
                    : "No allowance"}
                </dd>
                <dt className="text-steel">Ground</dt>
                <dd className="text-bone">
                  {active.groundAllowanceUsd
                    ? `${USD.format(active.groundAllowanceUsd)} allowance a year`
                    : "Booked at cost"}
                </dd>
                <dt className="text-steel">Cardholders</dt>
                <dd className="text-bone">
                  {active.namedCardholdersLimit >= 99
                    ? "Unlimited named cardholders"
                    : `${active.namedCardholdersLimit} named ${active.namedCardholdersLimit === 1 ? "cardholder" : "cardholders"}`}
                </dd>
                <dt className="text-steel">Empty legs</dt>
                <dd className="text-bone">{active.emptyLegAdvanceMinutes} minutes before the public board</dd>
                <dt className="text-steel">Auto-renew</dt>
                <dd className="text-bone">{active.autoRenew ? "On" : "Off"}</dd>
              </dl>
            </section>

            <TermsCard />
            <HistoryCard programs={programs} />
          </div>
        </div>
      ) : (
        <>
          <OnDemandCard memberWithoutProgram />
          {ledger.length > 0 ? (
            <section className={`${PANEL} mt-5 px-6 py-5 max-md:px-5`}>
              <h2 className="font-serif text-[20px] font-normal text-bone">Activity</h2>
              <MembershipActivity rows={activity} />
            </section>
          ) : null}
          {programs.length > 0 ? (
            <div className="mt-5">
              <HistoryCard programs={programs} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/** "Your terms" links (Light - Account membership aside). */
function TermsCard() {
  return (
    <section className={`${PANEL} px-[18px] py-4`}>
      <div className="text-[14px] font-bold text-bone">Your terms</div>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
        <li>
          <UnderLink href="/memberships#deposits">Deposits and refunds</UnderLink>
        </li>
        <li>
          <UnderLink href="/memberships#rates">Locked rates</UnderLink>
        </li>
        <li>
          <UnderLink href="/memberships#faq">Changes and cancellation</UnderLink>
        </li>
      </ul>
      <p className="mt-2.5 text-[12px] text-steel">The signed agreement governs; this page is a summary.</p>
    </section>
  );
}

/**
 * The on-demand explanation. Shown to signed-in users without a member
 * profile and to members without an active program.
 */
function OnDemandCard({ memberWithoutProgram = false }: { memberWithoutProgram?: boolean }) {
  return (
    <section className={`${PANEL} mt-[22px] max-w-[720px] px-6 py-[22px] max-md:px-5`}>
      <h2 className="font-serif text-[24px] font-normal leading-[1.15] text-bone">You&rsquo;re flying on-demand.</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.55] text-steel">
        Every quote is all-in and locked at acceptance, with no deposit and no annual fee. If you
        fly 25 hours a year or more, the JetNine Card usually pays for itself in locked rates and
        avoided peak pricing — dispatch can run the numbers for you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link href="/memberships" className={BTN_PRIMARY}>
          See programs <span aria-hidden="true">→</span>
        </Link>
        {memberWithoutProgram ? (
          <Link href="/account/memberships" className={BTN_LINE}>
            Buy the card
          </Link>
        ) : null}
        <Link href="/quote/mission" className={BTN_LINE}>
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
    <section className={PANEL}>
      <div className="px-[18px] pt-4 text-[14px] font-bold text-bone">History</div>
      {programs.length === 0 ? (
        <p className="px-[18px] pb-4 pt-2 text-[13px] text-steel">
          No programs yet. Dispatch enrols you on the one you choose.
        </p>
      ) : (
        <ul className="mt-2">
          {programs.map((p) => (
            <li key={p.id} className="border-t border-line px-[18px] py-3 text-[13px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-bone">{MEMBERSHIP_SPECS[p.program]?.name ?? "Program"}</span>
                <span className={p.status === "active" ? "text-success" : "text-steel"}>
                  {STATUS_SENTENCE[p.status] ?? p.status}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-steel">
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
