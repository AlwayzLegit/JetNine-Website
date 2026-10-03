import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatUSD } from "@/lib/quote-pricing";
import { reportSummary } from "@/domain/reports/queries";
import { DeskHeader, NumberCard } from "@/components/admin/desk-ui";
import { PERIODS, parsePeriod } from "./period";

export const dynamic = "force-dynamic";

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

  const { requests: req, money, mostOverdue: overdue } = await reportSummary(period);

  const receivedDelta = req.received - req.receivedPrev;
  const bookedPct = req.received > 0 ? Math.round((req.booked / req.received) * 100) : null;
  const revenueDelta = money.invoiced - money.invoicedPrev;
  const marginPct = money.coveredInvoiced > 0 ? Math.round((money.trueMargin / money.coveredInvoiced) * 100) : null;

  const funnel = [
    { label: "Booked", value: req.booked, bar: "bg-success" },
    { label: "Options sent, no answer yet", value: req.waiting, bar: "bg-gold" },
    { label: "Client went elsewhere or cancelled", value: req.lost, bar: "bg-steel-dim" },
    { label: "Still open", value: req.open, bar: "bg-clearance" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const overdueName = overdue ? overdue.preferredName?.trim() || overdue.name || "A client" : null;
  const owedNote =
    money.outstandingCount === 0
      ? "Nothing outstanding"
      : overdue
        ? `${money.outstandingCount} invoice${money.outstandingCount === 1 ? "" : "s"} · ${overdueName}'s invoice is ${overdue.daysLate} day${overdue.daysLate === 1 ? "" : "s"} late`
        : `${money.outstandingCount} invoice${money.outstandingCount === 1 ? "" : "s"} outstanding, none late yet`;

  const marginNote =
    money.marginTotal === 0
      ? `No paid invoices ${meta.words}`
      : money.marginCovered === 0
        ? `Operator cost is not recorded on any of the ${money.marginTotal} paid trip${money.marginTotal === 1 ? "" : "s"} yet`
        : `about ${marginPct}% of invoiced · counts the ${money.marginCovered} of ${money.marginTotal} paid trip${money.marginTotal === 1 ? "" : "s"} with operator cost recorded`;

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
            <dd className="mt-1 text-[22px] text-bone">{formatUSD(money.trueMargin)}</dd>
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
