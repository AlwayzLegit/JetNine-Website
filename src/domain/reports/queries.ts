import { sql } from "drizzle-orm";
import { db } from "@/db";
import { NOT_SMOKE } from "@/domain/common";
import { periodBounds, type PeriodKey } from "@/app/admin/settings/reports/period";

/**
 * Settings › Reports: how the desk did over a period. Shared by the admin
 * page and GET /api/v1/reports/summary. Money figures are owner-only; the
 * caller enforces that.
 */

export type ReportRequests = {
  received: number;
  receivedPrev: number;
  booked: number;
  waiting: number;
  lost: number;
  open: number;
};

export type ReportMoney = {
  invoiced: number;
  invoicedPrev: number;
  outstanding: number;
  outstandingCount: number;
  trueMargin: number;
  coveredInvoiced: number;
  marginCovered: number;
  marginTotal: number;
};

export type MostOverdue = { name: string | null; preferredName: string | null; daysLate: number };

export type ReportSummary = {
  period: PeriodKey;
  requests: ReportRequests;
  money: ReportMoney;
  mostOverdue: MostOverdue | null;
};

export async function getRequests(period: PeriodKey): Promise<ReportRequests> {
  const { start, prevStart } = periodBounds(period);
  const [row] = await db.execute<{
    received: number;
    received_prev: number;
    booked: number;
    waiting: number;
    lost: number;
    open: number;
  }>(sql`
    select
      count(*) filter (where received_at >= ${start})::int                                              as received,
      count(*) filter (where received_at >= ${prevStart} and received_at < ${start})::int               as received_prev,
      count(*) filter (where received_at >= ${start} and status in ('accepted','converted'))::int       as booked,
      count(*) filter (where received_at >= ${start} and status in ('options_sent','held'))::int        as waiting,
      count(*) filter (where received_at >= ${start}
                        and status in ('declined','expired','cancelled'))::int                           as lost,
      count(*) filter (where received_at >= ${start}
                        and status in ('submitted','triaged','sourcing'))::int                           as open
    from public.quotes
    where ${NOT_SMOKE}
  `);
  return {
    received: row.received,
    receivedPrev: row.received_prev,
    booked: row.booked,
    waiting: row.waiting,
    lost: row.lost,
    open: row.open,
  };
}

export async function getMoney(period: PeriodKey): Promise<ReportMoney> {
  const { start, prevStart } = periodBounds(period);
  // True margin subtracts operator cost (from the trip) on top of the FET +
  // segment pass-throughs. Operator cost only lands on trips converted with a
  // chosen sourced option, so it's summed over the cost-known cohort only, and
  // margin_covered/margin_total report coverage for an honest caveat.
  //
  // No smoke filter here: smoke quotes are written as 'cancelled' (see
  // src/app/quote/actions.ts) so they never become trips or invoices, and
  // invoices without a trip (or trips without a quote) carry nothing to
  // match against.
  const [row] = await db.execute<{
    invoiced: number;
    invoiced_prev: number;
    outstanding: number;
    outstanding_count: number;
    true_margin: number;
    covered_invoiced: number;
    margin_covered: number;
    margin_total: number;
  }>(sql`
    select
      coalesce(sum(case when i.issued_on >= ${start}
                        and i.status in ('paid','due','overdue')
                  then i.total_usd else 0 end), 0)::int as invoiced,
      coalesce(sum(case when i.issued_on >= ${prevStart} and i.issued_on < ${start}
                        and i.status in ('paid','due','overdue')
                  then i.total_usd else 0 end), 0)::int as invoiced_prev,
      coalesce(sum(case when i.status in ('due','overdue') then i.total_usd else 0 end), 0)::int as outstanding,
      count(*) filter (where i.status in ('due','overdue'))::int as outstanding_count,
      coalesce(sum(case when i.issued_on >= ${start}
                        and i.status = 'paid' and t.operator_cost_usd is not null
                  then i.total_usd - coalesce(i.fet_usd,0) - coalesce(i.segment_fee_usd,0) - t.operator_cost_usd
                  else 0 end), 0)::int as true_margin,
      coalesce(sum(case when i.issued_on >= ${start}
                        and i.status = 'paid' and t.operator_cost_usd is not null
                  then i.total_usd else 0 end), 0)::int as covered_invoiced,
      count(*) filter (where i.issued_on >= ${start}
                        and i.status = 'paid' and t.operator_cost_usd is not null)::int as margin_covered,
      count(*) filter (where i.issued_on >= ${start}
                        and i.status = 'paid')::int as margin_total
    from public.invoices i
    left join public.trips t on t.id = i.trip_id
  `);
  return {
    invoiced: row.invoiced,
    invoicedPrev: row.invoiced_prev,
    outstanding: row.outstanding,
    outstandingCount: row.outstanding_count,
    trueMargin: row.true_margin,
    coveredInvoiced: row.covered_invoiced,
    marginCovered: row.margin_covered,
    marginTotal: row.margin_total,
  };
}

export async function getMostOverdue(): Promise<MostOverdue | null> {
  const [row] = await db.execute<{ name: string | null; preferred_name: string | null; days_late: number }>(sql`
    select
      nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') as name,
      m.preferred_name,
      (current_date - i.due_on)::int as days_late
    from public.invoices i
    join public.members m on m.id = i.member_id
    join public.users u on u.id = m.user_id
    where i.status in ('due','overdue') and i.due_on is not null and i.due_on < current_date
    order by i.due_on asc
    limit 1
  `);
  return row ? { name: row.name, preferredName: row.preferred_name, daysLate: row.days_late } : null;
}

export async function reportSummary(period: PeriodKey): Promise<ReportSummary> {
  const [requests, money, mostOverdue] = await Promise.all([getRequests(period), getMoney(period), getMostOverdue()]);
  return { period, requests, money, mostOverdue };
}
