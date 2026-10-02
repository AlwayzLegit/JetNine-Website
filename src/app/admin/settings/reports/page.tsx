import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatUSD } from "@/lib/quote-pricing";
import { DeskHeader, NumberCard } from "@/components/admin/desk-ui";
import { NOT_SMOKE, PERIODS, parsePeriod, periodBounds, type PeriodKey } from "./period";

export const dynamic = "force-dynamic";

type Row<T extends object> = T;

// ─── Queries ────────────────────────────────────────────────────────────

async function getRequests(period: PeriodKey) {
  const { start, prevStart } = periodBounds(period);
  const [row] = await db.execute<
    Row<{
      received: number;
      received_prev: number;
      booked: number;
      waiting: number;
      lost: number;
      open: number;
    }>
  >(sql`
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
  return row;
}

async function getMoney(period: PeriodKey) {
  const { start, prevStart } = periodBounds(period);
  // True margin subtracts operator cost (from the trip) on top of the FET +
  // segment pass-throughs. Operator cost only lands on trips converted with a
  // chosen sourced option, so it's summed over the cost-known cohort only, and
  // margin_covered/margin_total report coverage for an honest caveat.
  const [row] = await db.execute<
    Row<{
      invoiced: number;
      invoiced_prev: number;
      outstanding: number;
      outstanding_count: number;
      true_margin: number;
      covered_invoiced: number;
      margin_covered: number;
      margin_total: number;
    }>
  >(sql`
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
  return row;
}

async function getMostOverdue() {
  const [row] = await db.execute<Row<{ name: string | null; preferred_name: string | null; days_late: number }>>(sql`
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
  return row ?? null;
}

// ─── Page ───────────────────────────────────────────────────────────────

type Props = { searchParams: Promise<{ period?: string }> };

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function signedUsd(n: number): string {
  return n < 0 ? `−${formatUSD(-n)}` : `+${formatUSD(n)}`;
}

export default async function ReportsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const meta = PERIODS.find((p) => p.key === period)!;

  const [req, money, overdue] = await Promise.all([getRequests(period), getMoney(period), getMostOverdue()]);

  const receivedDelta = req.received - req.received_prev;
  const bookedPct = req.received > 0 ? Math.round((req.booked / req.received) * 100) : null;
  const revenueDelta = money.invoiced - money.invoiced_prev;
  const marginPct = money.covered_invoiced > 0 ? Math.round((money.true_margin / money.covered_invoiced) * 100) : null;

  const funnel = [
    { label: "Booked", value: req.booked, bar: "bg-success" },
    { label: "Options sent, no answer yet", value: req.waiting, bar: "bg-gold" },
    { label: "Client went elsewhere or cancelled", value: req.lost, bar: "bg-steel-dim" },
    { label: "Still open", value: req.open, bar: "bg-clearance" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const overdueName = overdue ? overdue.preferred_name?.trim() || overdue.name || "A client" : null;
  const owedNote =
    money.outstanding_count === 0
      ? "Nothing outstanding"
      : overdue
        ? `${money.outstanding_count} invoice${money.outstanding_count === 1 ? "" : "s"} · ${overdueName}'s invoice is ${overdue.days_late} day${overdue.days_late === 1 ? "" : "s"} late`
        : `${money.outstanding_count} invoice${money.outstanding_count === 1 ? "" : "s"} outstanding, none late yet`;

  const marginNote =
    money.margin_total === 0
      ? `No paid invoices ${meta.words}`
      : money.margin_covered === 0
        ? `Operator cost is not recorded on any of the ${money.margin_total} paid trip${money.margin_total === 1 ? "" : "s"} yet`
        : `about ${marginPct}% of invoiced · counts the ${money.margin_covered} of ${money.margin_total} paid trip${money.margin_total === 1 ? "" : "s"} with operator cost recorded`;

  return (
    <div>
      <DeskHeader
        title="Reports"
        lead="How the desk did. Updated live."
        actions={
          <div className="segmented" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/settings/reports?period=${p.key}`}
                aria-current={p.key === period ? "page" : undefined}
                className="inline-flex items-center"
              >
                {p.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <NumberCard
          label="Requests received"
          value={req.received}
          note={meta.prevWords ? `${signed(receivedDelta)} ${meta.prevWords}` : "since Jan 1"}
          noteTone={meta.prevWords && receivedDelta > 0 ? "success" : "steel"}
        />
        <NumberCard
          label="Flights booked"
          value={req.booked}
          note={bookedPct === null ? `No requests ${meta.words}` : `${bookedPct}% of requests`}
          noteTone="bone"
        />
        <NumberCard
          label="Revenue"
          value={formatUSD(money.invoiced)}
          note={meta.prevWords ? `${signedUsd(revenueDelta)} ${meta.prevWords}` : "since Jan 1"}
          noteTone={meta.prevWords && revenueDelta > 0 ? "success" : "steel"}
        />
      </div>

      <section className="card mt-6 p-6 md:px-7">
        <h2 className="text-[17px] font-medium text-bone">Where requests ended up</h2>
        <p className="mt-1 text-[14px] text-steel">
          {req.received} request{req.received === 1 ? "" : "s"} {meta.words}
        </p>
        <ul className="mt-5 flex flex-col gap-3.5">
          {funnel.map((f) => (
            <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 text-[15px] md:grid-cols-[200px_minmax(0,1fr)_60px] md:gap-4">
              <span className="text-bone">{f.label}</span>
              <div className="col-span-2 h-2.5 overflow-hidden rounded-pill bg-surface-2 md:col-span-1">
                <div
                  className={`h-full rounded-pill ${f.bar}`}
                  style={{ width: `${Math.max(2, Math.round((f.value / funnelMax) * 100))}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="row-start-1 text-right text-bone md:row-auto">{f.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-6 p-6 md:px-7">
        <h2 className="text-[17px] font-medium text-bone">Money</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-[15px] md:grid-cols-3">
          <div>
            <dt className="text-[14px] text-steel">Invoiced</dt>
            <dd className="mt-1 text-[22px] text-bone">{formatUSD(money.invoiced)}</dd>
          </div>
          <div>
            <dt className="text-[14px] text-steel">Still owed to us</dt>
            <dd className="mt-1 text-[22px] text-gold">{formatUSD(money.outstanding)}</dd>
            <dd className="mt-0.5 text-[14px] text-steel">{owedNote}</dd>
          </div>
          <div>
            <dt className="text-[14px] text-steel">Kept after operator &amp; taxes</dt>
            <dd className="mt-1 text-[22px] text-bone">{formatUSD(money.true_margin)}</dd>
            <dd className="mt-0.5 text-[14px] text-steel">{marginNote}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-4 text-[14px] text-steel">
        Need the full breakdown?{" "}
        <a href={`/admin/settings/reports/export?period=${period}`} className="text-link">
          Download this period as a spreadsheet
        </a>
        .
      </p>
    </div>
  );
}
