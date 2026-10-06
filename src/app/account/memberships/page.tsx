import Link from "next/link";
import { and, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  memberships,
  reserveTransactions,
} from "@/db/schema/memberships";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatDay, USD } from "@/lib/request-page";
import {
  MEMBERSHIP_SPECS,
  type MembershipProgram,
} from "@/lib/memberships";
import { BuyMembershipButton } from "@/components/account/buy-membership-button";
import { TopUpForm } from "@/components/account/top-up-form";
import { MembershipActivity, type ActivityRow } from "@/components/account/membership-activity";
import { BTN_LINE, BTN_PRIMARY, Eyebrow, PANEL, PageHead, SectionTitle, UnderLink } from "@/components/account/panel";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ activated?: string; cancelled?: string; topup?: string }>;
};

const CARD_TIERS: MembershipProgram[] = ["card_100", "card_250", "card_500"];

const STATUS_SENTENCE: Record<string, string> = {
  active: "Active",
  paused: "Paused — waiting on payment",
  expired: "Expired",
  cancelled: "Cancelled",
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
      <>
        <PageHead
          title="Buy / top up"
          sub="Memberships unlock once your account is set up. Request a quote or talk to dispatch to get started."
        />
        <div className="mt-[22px] flex flex-wrap gap-2.5">
          <Link href="/quote" className={BTN_PRIMARY}>
            Request a quote <span aria-hidden="true">→</span>
          </Link>
          <Link href="/memberships" className={BTN_LINE}>
            See programs
          </Link>
        </div>
      </>
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

  const spec = active ? MEMBERSHIP_SPECS[active.program] : null;
  const activity: ActivityRow[] = ledger.map((row) => ({
    id: row.id,
    kind: row.kind,
    amountUsd: row.amountUsd,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
  }));

  return (
    <>
      <PageHead
        title="Buy / top up"
        sub={
          active && spec
            ? `You hold the ${spec.name}, active since ${formatDay(active.activatedOn) ?? active.activatedOn}. Add to your balance below.`
            : "Three card tiers, one locked hourly rate. Pick a deposit level and we'll open checkout — or keep flying on-demand with no commitment."
        }
      />

      {flash ? (
        <div
          role="status"
          className={[
            PANEL,
            "mt-[22px] px-6 py-4 text-[15px] leading-[1.5] text-bone",
            flash.kind === "cancelled" ? "" : "!border-gold",
          ].join(" ")}
        >
          {flash.kind === "activated"
            ? "Your membership is active. The deposit now sits in your reserve balance below, and we draw from it on each invoice."
            : flash.kind === "topup"
              ? "Top-up received. Stripe's confirmation is on its way to your inbox; the new balance shows here once the payment clears, usually within a few seconds."
              : "Purchase cancelled. Nothing was charged."}
        </div>
      ) : null}

      {active && spec ? (
        <>
          <section className={`${PANEL} mt-[22px] px-6 py-[22px] max-md:px-5`}>
            <Eyebrow>Reserve balance</Eyebrow>
            <div
              className={[
                "mt-2 font-serif text-[36px] leading-[1.1]",
                balanceUsd < 0 ? "text-danger" : "text-bone",
              ].join(" ")}
            >
              {USD.format(balanceUsd)}
            </div>
            <p className="mt-2 text-[14px] text-bone-2">
              <span className="text-success">{STATUS_SENTENCE[active.status] ?? "Active"}</span>
              {" · "}
              {spec.name} · rates locked for {spec.rateLockMonths} months · aircraft guaranteed with{" "}
              {spec.calloutHours} hours&rsquo; notice
            </p>
            <UnderLink href="/account/members" className="mt-3 inline-block">
              See what&rsquo;s included
            </UnderLink>
          </section>

          <div className="mt-4">
            <TopUpForm />
          </div>

          {ledger.length > 0 ? (
            <section className={`${PANEL} mt-4 px-6 py-5 max-md:px-5`}>
              <h2 className="font-serif text-[20px] font-normal text-bone">Recent activity</h2>
              <MembershipActivity rows={activity} />
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-6">
          <SectionTitle>JetNine Card</SectionTitle>
          <div className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
            {CARD_TIERS.map((p) => {
              const s = MEMBERSHIP_SPECS[p];
              const features = [
                `Aircraft guaranteed with ${s.calloutHours} hours' notice`,
                `Hourly rates locked for ${s.rateLockMonths} months`,
                `${USD.format(s.cateringAllowanceUsd)} catering${s.groundAllowanceUsd ? ` and ${USD.format(s.groundAllowanceUsd)} ground` : ""} allowance a year`,
                s.namedCardholdersLimit >= 999
                  ? "Unlimited named cardholders"
                  : `${s.namedCardholdersLimit} named ${s.namedCardholdersLimit === 1 ? "cardholder" : "cardholders"}`,
                `Empty legs ${s.emptyLegAdvanceMinutes} minutes before the public board`,
              ];
              return (
                <div key={p} className={`${PANEL} flex flex-col gap-4 px-5 py-5`}>
                  <div>
                    <h3 className="font-serif text-[22px] font-normal leading-[1.15] text-bone">{s.name}</h3>
                    <div className="mt-3 border-t border-line pt-3">
                      <div className="font-serif text-[34px] leading-none text-bone">
                        {USD.format(s.depositUsd)}
                      </div>
                      <p className="mt-1.5 text-[13px] text-steel">Refundable deposit</p>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2 border-t border-line pt-3 text-[14px] leading-[1.45] text-bone">
                    {features.map((f) => (
                      <li key={f} className="grid grid-cols-[auto_1fr] gap-2.5">
                        <span className="text-gold" aria-hidden="true">
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <BuyMembershipButton program={p} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle>Other ways to fly</SectionTitle>
        <div className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          <div className="on-navy bg-navy px-5 py-5">
            <h3 className="font-serif text-[22px] font-normal leading-[1.15] text-bone">Reserve</h3>
            <p className="mt-2 text-[14px] leading-[1.55] text-bone-2">
              A dedicated dispatcher, aircraft guaranteed with 8 to 12 hours&rsquo; notice and
              larger allowances. By application — a limited number of seats.
            </p>
            <Link href="/contact?subject=reserve" className="btn btn-on-navy btn-sm mt-3">
              Apply for Reserve →
            </Link>
          </div>
          <div className={`${PANEL} px-5 py-5`}>
            <h3 className="font-serif text-[22px] font-normal leading-[1.15] text-bone">On-demand</h3>
            <p className="mt-2 text-[14px] leading-[1.55] text-steel">
              No deposit, no commitment. Request a quote and pay per flight — the all-in price is
              locked when you accept.
            </p>
            <Link href="/quote" className={`${BTN_LINE} mt-3`}>
              Request a quote →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
