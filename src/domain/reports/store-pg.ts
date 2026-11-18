import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emptyLegs } from "@/db/schema/empty-legs";
import { invoices } from "@/db/schema/invoices";
import { quotes } from "@/db/schema/quotes";
import { NOT_SMOKE, isoParam } from "@/domain/common";
import { OPEN_REQUEST_STATUSES } from "@/lib/desk-status";
import { periodBounds } from "@/app/admin/settings/reports/period";
import type { FlightRow, ReportStore, SummaryRequestRow } from "./store";

// The Postgres side of the report store (OPS-163): the queries of the desk's counts, the
// Reports page and the morning summary, moved here as they were. Nothing about them changes
// on Postgres: the windows still come from current_date and date_trunc (periodBounds), so
// the dates the interface passes are not read here.

export function pgReportStore(): ReportStore {
  return {
    async submittedCount() {
      const [row] = await db
        .select({ n: count() })
        .from(quotes)
        .where(and(eq(quotes.status, "submitted"), NOT_SMOKE));
      return row?.n ?? 0;
    },

    async quoteStageCounts(since14, now) {
      const nowIso = isoParam(now);
      const [q] = await db
        .select({
          needsReply: sql<number>`count(*) filter (where ${quotes.status} = 'submitted')::int`,
          working: sql<number>`count(*) filter (where ${quotes.status} in ('triaged', 'sourcing'))::int`,
          optionsOut: sql<number>`count(*) filter (where ${quotes.status} in ('options_sent', 'held'))::int`,
          bookedLast14Days: sql<number>`count(*) filter (
            where ${quotes.status} in ('accepted', 'converted')
              and coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${isoParam(since14)}::timestamptz
          )::int`,
          overdueReplies: sql<number>`count(*) filter (
            where ${quotes.status} = 'submitted' and ${quotes.slaDeadlineAt} < ${nowIso}::timestamptz
          )::int`,
        })
        .from(quotes)
        .where(NOT_SMOKE);
      return {
        needsReply: q?.needsReply ?? 0,
        working: q?.working ?? 0,
        optionsOut: q?.optionsOut ?? 0,
        bookedLast14Days: q?.bookedLast14Days ?? 0,
        overdueReplies: q?.overdueReplies ?? 0,
      };
    },

    async overdueInvoiceCount() {
      const [row] = await db.select({ n: count() }).from(invoices).where(eq(invoices.status, "overdue"));
      return row?.n ?? 0;
    },

    async liveEmptyLegCount() {
      const [row] = await db.select({ n: count() }).from(emptyLegs).where(eq(emptyLegs.status, "live"));
      return row?.n ?? 0;
    },

    async requestCounts(period) {
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
    },

    async moneySummary(period) {
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
    },

    async mostOverdue() {
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
    },

    async flightsOn(day) {
      const rows = await db.execute<FlightRow>(sql`
        select t.id as trip_id, t.status, t.pax_count,
               l.from_city, l.from_name, l.from_iata, l.to_city, l.to_name, l.to_iata, l.depart_time,
               nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') as client_name,
               a.make_model as aircraft
        from public.trip_legs l
        join public.trips t on t.id = l.trip_id
        join public.members m on m.id = t.member_id
        join public.users u on u.id = m.user_id
        left join public.aircraft a on a.id = t.aircraft_id
        where l.depart_date = ${day}::date
          and t.status not in ('cancelled_wx', 'cancelled_other')
        order by l.depart_time asc nulls last, l.leg_number asc
        limit 40
      `);
      return [...rows];
    },

    async openRequestsForSummary() {
      const rows = await db.execute<SummaryRequestRow>(sql`
        select q.id, q.status, q.received_at, q.sla_deadline_at, q.pax_count,
               l.from_city, l.from_name, l.from_iata, l.to_city, l.to_name, l.to_iata,
               nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '') as client_name
        from public.quotes q
        left join public.quote_legs l on l.quote_id = q.id and l.leg_number = 1
        where q.status in (${sql.join(OPEN_REQUEST_STATUSES.map((s) => sql`${s}`), sql`, `)})
          and not (
            q.contact_snapshot->>'firstName' ilike '[SMOKE]%'
            or q.contact_snapshot->>'email' ilike 'smoke+%'
          )
        order by q.sla_deadline_at asc
        limit 40
      `);
      return [...rows];
    },
  };
}
