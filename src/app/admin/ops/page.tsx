import Link from "next/link";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { trips } from "@/db/schema/trips";
import { ScheduleBlockForm } from "@/components/admin/schedule-block-form";

export const dynamic = "force-dynamic";

const HORIZON_DAYS = 14;

// Color theme by block kind.
const KIND: Record<
  string,
  { label: string; cls: string }
> = {
  trip: { label: "Trip", cls: "bg-clearance text-ink" },
  maintenance: { label: "Maintenance", cls: "bg-[var(--warn)] text-ink" },
  repositioning: { label: "Reposition", cls: "bg-bone-2 text-ink" },
  crew_rest: { label: "Crew rest", cls: "bg-steel text-ink" },
  owner: { label: "Owner", cls: "bg-[#C9A961] text-ink" },
  hold: {
    label: "Soft hold",
    cls: "bg-transparent border border-dashed border-clearance text-clearance",
  },
  unavailable: { label: "Unavailable", cls: "bg-[var(--error)] text-bone" },
};

// Truncate a Date to the start of its UTC day. The planner is grid-based so
// we don't show sub-day blocks; everything snaps to the day column.
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function fmtDay(d: Date): { dow: string; mday: string } {
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    mday: d.toLocaleDateString("en-US", { day: "2-digit", timeZone: "UTC" }),
  };
}

export default async function AdminOpsPage() {
  const today = startOfUtcDay(new Date());
  const horizonEnd = addDays(today, HORIZON_DAYS);

  // ── Pull fleet ──
  const fleet = await db
    .select({
      id: aircraft.id,
      tailNumber: aircraft.tailNumber,
      makeModel: aircraft.makeModel,
      category: aircraft.category,
      seats: aircraft.seats,
      status: aircraft.status,
      operatorName: operators.name,
      isPreferred: operators.isPreferred,
    })
    .from(aircraft)
    .innerJoin(operators, eq(operators.id, aircraft.operatorId))
    .orderBy(asc(aircraft.category), asc(aircraft.tailNumber));

  // ── Pull schedule blocks that overlap the horizon ──
  const blocks = await db
    .select({
      id: aircraftScheduleBlocks.id,
      aircraftId: aircraftScheduleBlocks.aircraftId,
      kind: aircraftScheduleBlocks.kind,
      startAt: aircraftScheduleBlocks.startAt,
      endAt: aircraftScheduleBlocks.endAt,
      relatedTripId: aircraftScheduleBlocks.relatedTripId,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
      notes: aircraftScheduleBlocks.notes,
      tripCode: trips.tripCode,
    })
    .from(aircraftScheduleBlocks)
    .leftJoin(trips, eq(trips.id, aircraftScheduleBlocks.relatedTripId))
    .where(
      and(
        lt(aircraftScheduleBlocks.startAt, horizonEnd),
        gt(aircraftScheduleBlocks.endAt, today),
      ),
    )
    .orderBy(asc(aircraftScheduleBlocks.aircraftId), asc(aircraftScheduleBlocks.startAt));

  // Group blocks per aircraft.
  const blocksByTail = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const arr = blocksByTail.get(b.aircraftId) ?? [];
    arr.push(b);
    blocksByTail.set(b.aircraftId, arr);
  }

  const dayHeaders = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  // Quick utilization line — % of (tail × day) cells with at least one block.
  const totalCells = fleet.length * HORIZON_DAYS;
  let busyCells = 0;
  for (const ac of fleet) {
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const dayStart = addDays(today, i);
      const dayEnd = addDays(today, i + 1);
      const hit = (blocksByTail.get(ac.id) ?? []).some(
        (b) => b.startAt < dayEnd && b.endAt > dayStart,
      );
      if (hit) busyCells++;
    }
  }
  const utilization = totalCells > 0 ? Math.round((busyCells / totalCells) * 100) : 0;

  return (
    <div className="container-jn py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <p className="caption mb-3">— Admin · live ops</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Fleet planner · next {HORIZON_DAYS} days.
          </h1>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
            Every tail in the network across a rolling 14-day window. Trips mirror in from{" "}
            <code className="font-mono text-[12px] text-clearance">trips</code> via the sync
            trigger; manual blocks (maintenance, owner-private, unavailable) get authored from the
            aircraft detail. Soft holds appear with a dashed border.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-right">
          {[
            ["FLEET", String(fleet.length)],
            ["BLOCKS", String(blocks.length)],
            ["UTIL", `${utilization}%`],
            ["WINDOW", `${HORIZON_DAYS}d`],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                {lbl}
              </dt>
              <dd className="mt-1 font-serif text-[26px] font-light leading-none text-bone">
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Legend + manual-block authoring */}
      <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em]">
          {Object.entries(KIND).map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              <span
                className={[
                  "inline-block h-3 w-5 rounded-[2px]",
                  v.cls,
                ].join(" ")}
              />
              <span className="text-bone-2">{v.label}</span>
            </span>
          ))}
        </div>
        <ScheduleBlockForm
          aircraftOptions={fleet.map((f) => ({
            id: f.id,
            tailNumber: f.tailNumber,
            makeModel: f.makeModel,
            category: f.category,
          }))}
        />
      </section>

      {fleet.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— No aircraft yet</p>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">
            Seed the operators + aircraft tables, or onboard partners via /admin/operators.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
          <div
            className="grid min-w-[1280px]"
            style={{
              gridTemplateColumns: `260px repeat(${HORIZON_DAYS}, minmax(0, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="sticky left-0 z-10 bg-ink-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Tail · operator
            </div>
            {dayHeaders.map((d) => {
              const { dow, mday } = fmtDay(d);
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={d.toISOString()}
                  className={[
                    "border-l border-ink-3 px-2 py-3 text-center font-mono",
                    isToday ? "bg-ink text-clearance" : "text-bone-2",
                  ].join(" ")}
                >
                  <div className="text-[10px] uppercase tracking-[0.14em]">{dow}</div>
                  <div className="mt-0.5 text-[13px] tracking-[0.04em] text-bone">{mday}</div>
                </div>
              );
            })}

            {/* Aircraft rows */}
            {fleet.map((ac) => {
              const rowBlocks = blocksByTail.get(ac.id) ?? [];
              return (
                <FleetRow
                  key={ac.id}
                  aircraftId={ac.id}
                  tailNumber={ac.tailNumber}
                  category={ac.category}
                  seats={ac.seats}
                  makeModel={ac.makeModel}
                  operatorName={ac.operatorName}
                  isPreferred={ac.isPreferred}
                  acStatus={ac.status}
                  today={today}
                  blocks={rowBlocks}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FleetRow({
  aircraftId,
  tailNumber,
  category,
  seats,
  makeModel,
  operatorName,
  isPreferred,
  acStatus,
  today,
  blocks,
}: {
  aircraftId: string;
  tailNumber: string;
  category: string;
  seats: number;
  makeModel: string;
  operatorName: string;
  isPreferred: boolean;
  acStatus: string;
  today: Date;
  blocks: {
    id: string;
    kind: string;
    startAt: Date;
    endAt: Date;
    relatedTripId: string | null;
    notes: string | null;
    tripCode: string | null;
  }[];
}) {
  // Each block spans a contiguous range of day columns. Clamp to window.
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const dayStart = addDays(today, i);
    const dayEnd = addDays(today, i + 1);

    // Find the first block that owns this cell — only render at its start
    // column so the gridColumn span covers multiple days.
    const block = blocks.find((b) => {
      const overlaps = b.startAt < dayEnd && b.endAt > dayStart;
      if (!overlaps) return false;
      // Only render at the first day where this block overlaps the window.
      const firstOverlap = Math.max(
        0,
        Math.floor((startOfUtcDay(b.startAt).getTime() - today.getTime()) / 86_400_000),
      );
      return firstOverlap === i;
    });

    if (block) {
      const startCol = i;
      const lastOverlap = Math.min(
        HORIZON_DAYS - 1,
        Math.floor((startOfUtcDay(block.endAt).getTime() - today.getTime()) / 86_400_000),
      );
      const span = Math.max(1, lastOverlap - startCol + 1);
      const theme = KIND[block.kind] ?? { label: block.kind, cls: "bg-bone-2 text-ink" };
      const href = block.relatedTripId ? `/admin/trip/${block.relatedTripId}` : null;
      const label = block.tripCode ?? block.notes ?? theme.label;

      const inner = (
        <span
          className={[
            "block h-7 truncate rounded-[2px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
            theme.cls,
          ].join(" ")}
          title={`${theme.label} · ${block.startAt.toISOString().slice(0, 16).replace("T", " ")} → ${block.endAt
            .toISOString()
            .slice(0, 16)
            .replace("T", " ")}`}
        >
          {label}
        </span>
      );

      cells.push(
        <div
          key={`${aircraftId}-${i}`}
          className="border-l border-ink-3 px-1 py-2"
          style={{ gridColumn: `span ${span} / span ${span}` }}
        >
          {href ? (
            <Link href={href} className="block hover:opacity-80">
              {inner}
            </Link>
          ) : (
            inner
          )}
        </div>,
      );
      // Skip the spanned cells.
      i += span - 1;
      continue;
    }

    cells.push(
      <div
        key={`${aircraftId}-${i}-empty`}
        className="border-l border-ink-3 px-1 py-2"
      />,
    );
  }

  const isAog = acStatus === "aog";
  const isMaint = acStatus === "maint";

  return (
    <>
      <Link
        href={`/admin/operators`}
        className="sticky left-0 z-10 grid grid-cols-[auto_1fr] items-baseline gap-3 border-t border-ink-3 bg-ink-2 px-4 py-3 transition-colors hover:bg-ink"
      >
        <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
          {tailNumber}
        </span>
        <div className="min-w-0">
          <div className="truncate font-serif text-[14px] leading-tight text-bone">
            {makeModel}
          </div>
          <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-bone-2">
            {category} · {seats} pax · {operatorName}
            {isPreferred ? " · pref" : ""}
            {isAog ? " · AOG" : isMaint ? " · MAINT" : ""}
          </div>
        </div>
      </Link>
      {cells}
    </>
  );
}
