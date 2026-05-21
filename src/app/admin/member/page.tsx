import Link from "next/link";
import { asc, count, eq, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { trips } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  on_demand: "On-demand",
  card_100: "Card · 100",
  card_250: "Card · 250",
  card_500: "Card · 500",
  reserve_50: "Reserve · 50",
  reserve_100: "Reserve · 100",
  reserve_250: "Reserve · 250",
  reserve_500_apply: "Reserve · 500 (apply)",
};

const STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  paused: "border-[var(--warn)] text-[var(--warn)]",
  closed: "border-steel text-steel",
};

export default async function AdminMembersPage() {
  // Single join with grouped aggregates for trip count + lifetime revenue.
  const rows = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      tier: members.tier,
      status: members.status,
      memberSince: members.memberSince,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
      tripCount: sql<number>`(
        select count(*)::int from public.trips t where t.member_id = ${members.id}
      )`,
      lifetimeUsd: sql<number>`(
        select coalesce(sum(i.total_usd), 0)::int from public.invoices i
        where i.member_id = ${members.id} and i.status in ('paid','due','overdue')
      )`,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(200);

  const totals = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    flying: rows.filter((r) => r.tier !== "on_demand" && r.status === "active").length,
    lifetimeRevenue: rows.reduce((sum, r) => sum + (r.lifetimeUsd ?? 0), 0),
  };

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · members</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            {totals.total} members on file.
          </h1>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
            Sorted by last name. Click into a row for the 360° view — preferences, lanes,
            companions, transactions (lands with Phase A.2 + C.3).
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["TOTAL", String(totals.total)],
            ["ACTIVE", String(totals.active)],
            ["CARD / RESERVE", String(totals.flying)],
            ["LIFETIME REV", formatUSD(totals.lifetimeRevenue)],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{lbl}</dt>
              <dd className="mt-1 font-serif text-[26px] font-light leading-none text-bone">
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— No members yet</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">
            The roster is empty.
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">
            Members appear here when someone signs in with magic-link auth and a member profile is
            created. The bootstrap admin GUC handles the first user; ops creates the rest.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-3">
                {["Member", "Code", "Tier", "Status", "Trips", "Lifetime", "Since", ""].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email;
                return (
                  <tr key={m.id} className="border-b border-ink-3 transition-colors hover:bg-ink">
                    <td className="px-5 py-5">
                      <div className="text-[14px] text-bone">{name}</div>
                      <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                        {m.email}
                      </div>
                    </td>
                    <td className="px-5 py-5 font-mono text-[11px] tracking-[0.04em] text-clearance">
                      {m.memberCode}
                    </td>
                    <td className="px-5 py-5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone">
                      {TIER_LABEL[m.tier] ?? m.tier}
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={[
                          "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                          STATUS_CLASS[m.status] ?? "border-ink-3 text-bone-2",
                        ].join(" ")}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-bone">
                      {m.tripCount}
                    </td>
                    <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-bone">
                      {m.lifetimeUsd ? formatUSD(m.lifetimeUsd) : "—"}
                    </td>
                    <td className="px-5 py-5 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {m.memberSince ? String(m.memberSince) : "—"}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <Link
                        href={`/admin/member/${m.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
