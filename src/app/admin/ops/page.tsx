import Link from "next/link";
import { ScheduleBlockForm } from "@/components/admin/schedule-block-form";
import { DeskEmpty, DeskHeader, DeskPage, NumberCard } from "@/components/admin/desk-ui";
import { addDays, listScheduleBlocks, startOfUtcDay } from "@/domain/reference/queries";

export const dynamic = "force-dynamic";

const HORIZON_DAYS = 14;

// Color theme by block kind.
const KIND: Record<
  string,
  { label: string; cls: string }
> = {
  trip: { label: "Trip", cls: "bg-clearance text-ink" },
  maintenance: { label: "Maintenance", cls: "bg-gold text-ink" },
  repositioning: { label: "Reposition", cls: "bg-bone-2 text-ink" },
  crew_rest: { label: "Crew rest", cls: "bg-steel text-ink" },
  owner: { label: "Owner", cls: "bg-[#C9A961] text-ink" },
  hold: {
    label: "Soft hold",
    cls: "bg-transparent border border-dashed border-clearance text-clearance",
  },
  unavailable: { label: "Unavailable", cls: "bg-danger text-ink" },
};

const CATEGORY_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ulr: "Ultra long range",
};

function fmtDay(d: Date): { dow: string; mday: string } {
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    mday: d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" }),
  };
}

export default async function AdminOpsPage() {
  const { from: today, fleet, blocks, utilizationPct: utilization } = await listScheduleBlocks(new Date(), HORIZON_DAYS);

  // Group blocks per aircraft.
  const blocksByTail = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const arr = blocksByTail.get(b.aircraftId) ?? [];
    arr.push(b);
    blocksByTail.set(b.aircraftId, arr);
  }

  const dayHeaders = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/settings/reference", label: "Reference data" }}
        title="Live ops board"
        lead={`Every aircraft in the network across the next ${HORIZON_DAYS} days. Trips come in automatically; maintenance, owner and unavailable blocks are added by hand, and soft holds show with a dashed border.`}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Aircraft" value={fleet.length} />
        <NumberCard label="Blocks in window" value={blocks.length} />
        <NumberCard label="Days in use" value={`${utilization}%`} note="Share of aircraft-days with a block" />
        <NumberCard label="Window" value={`${HORIZON_DAYS} days`} />
      </div>

      {/* Legend + manual-block authoring */}
      <section className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          {Object.entries(KIND).map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              <span
                className={[
                  "inline-block h-3 w-5 rounded-[3px]",
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
        <DeskEmpty
          className="mt-6"
          title="No aircraft yet."
          body={
            <>
              Seed the operators and aircraft tables, or add partners under{" "}
              <Link href="/admin/operators" className="text-link">
                Operators
              </Link>
              .
            </>
          }
        />
      ) : (
        <div className="card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[1280px]"
              style={{
                gridTemplateColumns: `260px repeat(${HORIZON_DAYS}, minmax(0, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="label-jn sticky left-0 z-10 border-b border-line bg-surface px-4 py-3 text-[13px]">
                Aircraft · operator
              </div>
              {dayHeaders.map((d) => {
                const { dow, mday } = fmtDay(d);
                const isToday = d.getTime() === today.getTime();
                return (
                  <div
                    key={d.toISOString()}
                    className={[
                      "border-b border-l border-line border-l-line-faint px-2 py-3 text-center",
                      isToday ? "bg-surface-2 text-clearance" : "text-steel",
                    ].join(" ")}
                  >
                    <div className="text-[12px]">{dow}</div>
                    <div className="mt-0.5 text-[14px] font-medium text-bone">{mday}</div>
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
        </div>
      )}
    </DeskPage>
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
      const href = block.relatedTripId ? `/admin/trips/${block.relatedTripId}` : null;
      const label = block.tripCode ?? block.notes ?? theme.label;

      const inner = (
        <span
          className={[
            "block h-7 truncate rounded-[4px] px-2 py-1 text-[12px] font-medium leading-5",
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
          className="border-l border-t border-line-faint px-1 py-2"
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
        className="border-l border-t border-line-faint px-1 py-2"
      />,
    );
  }

  const isAog = acStatus === "aog";
  const isMaint = acStatus === "maint";

  const meta = [
    CATEGORY_LABEL[category] ?? category,
    `${seats} seat${seats === 1 ? "" : "s"}`,
    operatorName,
    isPreferred ? "Preferred" : null,
    isAog ? "Grounded (AOG)" : isMaint ? "In maintenance" : null,
  ].filter(Boolean);

  return (
    <>
      <Link
        href={`/admin/aircraft/${aircraftId}`}
        className="sticky left-0 z-10 grid grid-cols-[auto_1fr] items-baseline gap-3 border-t border-line-faint bg-surface px-4 py-3 transition-colors hover:bg-surface-2/50"
      >
        <span className="text-[14px] font-medium text-bone">{tailNumber}</span>
        <div className="min-w-0">
          <div className="truncate text-[14px] leading-tight text-bone">{makeModel}</div>
          <div className={`mt-0.5 truncate text-[12px] ${isAog ? "text-danger" : "text-steel"}`}>
            {meta.join(" · ")}
          </div>
        </div>
      </Link>
      {cells}
    </>
  );
}
