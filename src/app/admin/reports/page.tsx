import { sql } from "drizzle-orm";
import { db } from "@/db";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

type Row<T extends object> = T;

async function getCounts() {
  const [counts] = await db.execute<
    Row<{
      quotes_total: number;
      quotes_open: number;
      quotes_converted: number;
      quotes_past_sla: number;
      trips_total: number;
      trips_active: number;
      trips_completed: number;
      members_total: number;
      operators_active: number;
      operators_suspended: number;
      aircraft_available: number;
      aircraft_aog: number;
    }>
  >(sql`
    select
      (select count(*)::int from public.quotes)                                            as quotes_total,
      (select count(*)::int from public.quotes
        where status in ('submitted','triaged','sourcing','options_sent','held'))          as quotes_open,
      (select count(*)::int from public.quotes where status = 'converted')                 as quotes_converted,
      (select count(*)::int from public.quotes
        where status in ('submitted','triaged','sourcing','options_sent','held')
          and sla_deadline_at < now())                                                     as quotes_past_sla,
      (select count(*)::int from public.trips)                                             as trips_total,
      (select count(*)::int from public.trips
        where status in ('confirmed','crew_briefed','boarding','airborne'))                as trips_active,
      (select count(*)::int from public.trips where status = 'completed')                  as trips_completed,
      (select count(*)::int from public.members where status = 'active')                   as members_total,
      (select count(*)::int from public.operators where status = 'active')                 as operators_active,
      (select count(*)::int from public.operators where status in ('hold','suspended'))    as operators_suspended,
      (select count(*)::int from public.aircraft where status = 'available')               as aircraft_available,
      (select count(*)::int from public.aircraft where status = 'aog')                     as aircraft_aog
  `);
  return counts;
}

async function getRevenue() {
  const [row] = await db.execute<
    Row<{
      revenue_30: number;
      revenue_ytd: number;
      outstanding: number;
      margin_30: number;
    }>
  >(sql`
    select
      coalesce(sum(case when issued_on >= current_date - interval '30 days'
                        and status in ('paid','due','overdue')
                  then total_usd else 0 end), 0)::int as revenue_30,
      coalesce(sum(case when extract(year from issued_on) = extract(year from current_date)
                        and status in ('paid','due','overdue')
                  then total_usd else 0 end), 0)::int as revenue_ytd,
      coalesce(sum(case when status in ('due','overdue') then total_usd else 0 end), 0)::int as outstanding,
      coalesce(sum(case when issued_on >= current_date - interval '30 days'
                        and status = 'paid'
                  then total_usd - coalesce(fet_usd,0) - coalesce(segment_fee_usd,0)
                  else 0 end), 0)::int as margin_30
    from public.invoices
  `);
  return row;
}

async function getQuoteFunnel() {
  const rows = await db.execute<Row<{ status: string; n: number }>>(sql`
    select status, count(*)::int as n
    from public.quotes
    group by status
    order by case status
      when 'submitted' then 1
      when 'triaged' then 2
      when 'sourcing' then 3
      when 'options_sent' then 4
      when 'held' then 5
      when 'accepted' then 6
      when 'converted' then 7
      when 'declined' then 8
      when 'expired' then 9
      when 'cancelled' then 10
      else 11
    end
  `);
  return rows;
}

export default async function ReportsPage() {
  const [counts, revenue, funnel] = await Promise.all([
    getCounts(),
    getRevenue(),
    getQuoteFunnel(),
  ]);

  const funnelMax = funnel.reduce((max, r) => (r.n > max ? r.n : max), 0) || 1;

  return (
    <div className="container-jn py-10">
      <header className="mb-10">
        <p className="caption mb-3">— Admin · reports</p>
        <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
          The desk at a glance.
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
          Snapshot pulled live from the database — quote funnel, trip activity, revenue, supply
          health. Refreshes on every load. Detailed cohort + retention reports land later.
        </p>
      </header>

      {/* KPI grid */}
      <section className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { lbl: "QUOTES (TOTAL)", val: counts.quotes_total },
          { lbl: "QUOTES OPEN", val: counts.quotes_open, accent: counts.quotes_open > 0 },
          {
            lbl: "PAST SLA",
            val: counts.quotes_past_sla,
            danger: counts.quotes_past_sla > 0,
          },
          { lbl: "CONVERTED", val: counts.quotes_converted, success: counts.quotes_converted > 0 },
          { lbl: "TRIPS (TOTAL)", val: counts.trips_total },
          { lbl: "TRIPS ACTIVE", val: counts.trips_active },
          { lbl: "TRIPS COMPLETED", val: counts.trips_completed },
          { lbl: "MEMBERS ACTIVE", val: counts.members_total },
          { lbl: "OPERATORS ACTIVE", val: counts.operators_active },
          {
            lbl: "OPS SUSPENDED",
            val: counts.operators_suspended,
            danger: counts.operators_suspended > 0,
          },
          { lbl: "FLEET AVAILABLE", val: counts.aircraft_available },
          { lbl: "FLEET AOG", val: counts.aircraft_aog, danger: counts.aircraft_aog > 0 },
        ].map((k) => (
          <div
            key={k.lbl}
            className="rounded-[4px] border border-ink-3 bg-ink-2 p-5"
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel">{k.lbl}</div>
            <div
              className={[
                "mt-3 font-serif text-[36px] font-light leading-none tracking-tight",
                k.danger
                  ? "text-[var(--error)]"
                  : k.success
                    ? "text-[var(--success)]"
                    : k.accent
                      ? "text-clearance"
                      : "text-bone",
              ].join(" ")}
              style={{ letterSpacing: "-0.02em" }}
            >
              {k.val}
            </div>
          </div>
        ))}
      </section>

      {/* Revenue */}
      <section className="mb-12 rounded-[4px] border border-ink-3 bg-ink-2 p-8">
        <h2 className="caption mb-6">— Revenue</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
          {[
            ["30-day issued", revenue.revenue_30],
            ["YTD issued", revenue.revenue_ytd],
            ["Outstanding", revenue.outstanding],
            ["30-day margin", revenue.margin_30],
          ].map(([lbl, val]) => (
            <div key={String(lbl)}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — {lbl}
              </dt>
              <dd
                className={[
                  "mt-3 font-serif text-[36px] font-light leading-none tracking-tight",
                  lbl === "Outstanding" && Number(val) > 0
                    ? "text-[var(--warn)]"
                    : "text-bone",
                ].join(" ")}
                style={{ letterSpacing: "-0.02em" }}
              >
                {Number(val) ? formatUSD(Number(val)) : "$0"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
          — Revenue counts invoices in paid/due/overdue status. Margin excludes FET + segment fees
          (those pass through to the IRS).
        </p>
      </section>

      {/* Quote funnel */}
      <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
        <h2 className="caption mb-6">— Quote funnel</h2>
        {funnel.length === 0 ? (
          <p className="text-[14px] text-bone-2">No quotes recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {funnel.map((row) => {
              const widthPct = Math.max(2, (row.n / funnelMax) * 100);
              return (
                <li
                  key={row.status}
                  className="grid grid-cols-[160px_1fr_auto] items-center gap-4"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
                    — {row.status.replace(/_/g, " ")}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-3">
                    <div
                      className="h-full rounded-full bg-clearance"
                      style={{ width: `${widthPct}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="font-mono text-[12px] tracking-[0.04em] text-bone">{row.n}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
