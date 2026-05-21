import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { trips } from "@/db/schema/trips";
import { formatUSD } from "@/lib/quote-pricing";
import { AircraftForm } from "@/components/admin/aircraft-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const HORIZON_DAYS = 14;

const STATUS_CLASS: Record<string, string> = {
  available: "border-[var(--success)] text-[var(--success)]",
  aog: "border-[var(--error)] text-[var(--error)]",
  maint: "border-[var(--warn)] text-[var(--warn)]",
  sold: "border-steel text-steel",
};

const CATEGORY_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ulr: "Ultra long range",
};

const WIFI_LABEL: Record<string, string> = {
  ka: "Ka-band (high-bandwidth)",
  yes: "Wi-Fi",
  gogo: "Gogo",
  aircell: "Aircell",
  none: "No connectivity",
};

const KIND_CLS: Record<string, string> = {
  trip: "bg-clearance text-ink",
  maintenance: "bg-[var(--warn)] text-ink",
  repositioning: "bg-bone-2 text-ink",
  crew_rest: "bg-steel text-ink",
  owner: "bg-[#C9A961] text-ink",
  hold: "bg-transparent border border-dashed border-clearance text-clearance",
  unavailable: "bg-[var(--error)] text-bone",
};

const TRIP_STATUS_CLASS: Record<string, string> = {
  confirmed: "border-clearance text-clearance",
  airborne: "border-[var(--warn)] text-[var(--warn)]",
  completed: "border-[var(--success)] text-[var(--success)]",
  cancelled_wx: "border-[var(--error)] text-[var(--error)]",
  cancelled_other: "border-[var(--error)] text-[var(--error)]",
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

export default async function AdminAircraftDetailPage({ params }: Props) {
  const { id } = await params;

  // Pure-aircraft row for the editor's initial value (the join-shape `row`
  // below is missing some columns like cabinHeightIn / lavatoryEnclosed /
  // updatedAt that AircraftForm wants).
  const [acRow] = await db.select().from(aircraft).where(eq(aircraft.id, id));
  if (!acRow) notFound();

  const [row] = await db
    .select({
      id: aircraft.id,
      tailNumber: aircraft.tailNumber,
      makeModel: aircraft.makeModel,
      yearManufactured: aircraft.yearManufactured,
      category: aircraft.category,
      seats: aircraft.seats,
      rangeNm: aircraft.rangeNm,
      speedKt: aircraft.speedKt,
      wifiType: aircraft.wifiType,
      cabinHeightIn: aircraft.cabinHeightIn,
      standupCabin: aircraft.standupCabin,
      lavatoryEnclosed: aircraft.lavatoryEnclosed,
      lieflatCapable: aircraft.lieflatCapable,
      petFriendly: aircraft.petFriendly,
      flightAttendantStandard: aircraft.flightAttendantStandard,
      baseIcao: aircraft.baseIcao,
      totalHours: aircraft.totalHours,
      lastCCheckOn: aircraft.lastCCheckOn,
      status: aircraft.status,
      createdAt: aircraft.createdAt,
      operatorId: operators.id,
      operatorName: operators.name,
      operatorCertNumber: operators.certNumber,
      operatorStatus: operators.status,
      operatorArgus: operators.argusRating,
      operatorWyvern: operators.wyvernWingman,
      operatorIsPreferred: operators.isPreferred,
    })
    .from(aircraft)
    .innerJoin(operators, eq(operators.id, aircraft.operatorId))
    .where(eq(aircraft.id, id));
  if (!row) notFound();

  // Operator options for the editor's operator-swap dropdown.
  const operatorOptions = await db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .orderBy(asc(operators.name));

  const today = startOfUtcDay(new Date());
  const horizonEnd = addDays(today, HORIZON_DAYS);

  // ── 14-day timeline blocks for this tail ──
  const blocks = await db
    .select({
      id: aircraftScheduleBlocks.id,
      kind: aircraftScheduleBlocks.kind,
      startAt: aircraftScheduleBlocks.startAt,
      endAt: aircraftScheduleBlocks.endAt,
      relatedTripId: aircraftScheduleBlocks.relatedTripId,
      notes: aircraftScheduleBlocks.notes,
      tripCode: trips.tripCode,
    })
    .from(aircraftScheduleBlocks)
    .leftJoin(trips, eq(trips.id, aircraftScheduleBlocks.relatedTripId))
    .where(
      and(
        eq(aircraftScheduleBlocks.aircraftId, id),
        lt(aircraftScheduleBlocks.startAt, horizonEnd),
        gt(aircraftScheduleBlocks.endAt, today),
      ),
    )
    .orderBy(asc(aircraftScheduleBlocks.startAt));

  // ── Recent trips on this tail (last 12) ──
  const recentTrips = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      revenueUsd: trips.revenueUsd,
      wheelsUpAt: trips.wheelsUpAt,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.aircraftId, id))
    .orderBy(desc(trips.createdAt))
    .limit(12);

  const [aggregate] = await db
    .select({
      lifetimeTrips: sql<number>`coalesce(count(*)::int, 0)`,
      lifetimeRevenue: sql<number>`coalesce(sum(${trips.revenueUsd}), 0)::int`,
      totalPax: sql<number>`coalesce(sum(${trips.paxCount}), 0)::int`,
    })
    .from(trips)
    .where(eq(trips.aircraftId, id));

  const cabinFeatures: string[] = [];
  if (row.standupCabin) cabinFeatures.push("Stand-up");
  if (row.lavatoryEnclosed) cabinFeatures.push("Enclosed lavatory");
  if (row.lieflatCapable) cabinFeatures.push("Lie-flat");
  if (row.flightAttendantStandard) cabinFeatures.push("Flight attendant std.");
  if (row.petFriendly) cabinFeatures.push("Pet-friendly");

  const dayHeaders = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  return (
    <div className="container-jn py-8">
      {/* Top bar */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            <Link href="/admin/aircraft" className="transition-colors hover:text-clearance">
              Aircraft
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <span className="text-bone">{row.tailNumber}</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <span
              className="font-mono text-[36px] tracking-[0.04em] text-clearance"
              style={{ letterSpacing: "0.04em" }}
            >
              {row.tailNumber}
            </span>
            <span
              className="font-serif text-[26px] font-light leading-none text-bone"
              style={{ letterSpacing: "-0.01em" }}
            >
              {row.makeModel}
              {row.yearManufactured ? (
                <span className="ml-2 font-mono text-[14px] text-bone-2">
                  · {row.yearManufactured}
                </span>
              ) : null}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                STATUS_CLASS[row.status] ?? "border-ink-3 text-bone-2",
              ].join(" ")}
            >
              {row.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
            {CATEGORY_LABEL[row.category] ?? row.category}
            {row.baseIcao ? ` · Base ${row.baseIcao}` : ""}
            {row.totalHours ? ` · ${row.totalHours.toLocaleString()} hrs` : ""}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["LIFETIME TRIPS", String(aggregate?.lifetimeTrips ?? 0)],
            ["LIFETIME REV", formatUSD(aggregate?.lifetimeRevenue ?? 0)],
            ["PAX FLOWN", String(aggregate?.totalPax ?? 0)],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                {lbl}
              </dt>
              <dd className="mt-1 font-serif text-[22px] font-light leading-none text-bone">
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* LEFT */}
        <div className="flex flex-col gap-6">
          {/* 14-day strip */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="caption">— Next {HORIZON_DAYS} days</h2>
              <Link
                href="/admin/ops"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
              >
                Full planner →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[840px]"
                style={{ gridTemplateColumns: `repeat(${HORIZON_DAYS}, minmax(0, 1fr))` }}
              >
                {dayHeaders.map((d) => {
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <div
                      key={d.toISOString()}
                      className={[
                        "border-l border-ink-3 px-2 py-2 text-center font-mono",
                        isToday ? "bg-ink text-clearance" : "text-bone-2",
                      ].join(" ")}
                    >
                      <div className="text-[9px] uppercase tracking-[0.14em]">
                        {d
                          .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
                          .toUpperCase()}
                      </div>
                      <div className="mt-0.5 text-[13px] tracking-[0.04em] text-bone">
                        {d.getUTCDate()}
                      </div>
                    </div>
                  );
                })}
                {Array.from({ length: HORIZON_DAYS }).map((_, i) => {
                  const dayStart = addDays(today, i);
                  const dayEnd = addDays(today, i + 1);
                  const block = blocks.find((b) => {
                    const overlaps = b.startAt < dayEnd && b.endAt > dayStart;
                    if (!overlaps) return false;
                    const firstOverlap = Math.max(
                      0,
                      Math.floor(
                        (startOfUtcDay(b.startAt).getTime() - today.getTime()) / 86_400_000,
                      ),
                    );
                    return firstOverlap === i;
                  });
                  if (block) {
                    const lastOverlap = Math.min(
                      HORIZON_DAYS - 1,
                      Math.floor(
                        (startOfUtcDay(block.endAt).getTime() - today.getTime()) / 86_400_000,
                      ),
                    );
                    const span = Math.max(1, lastOverlap - i + 1);
                    const cls = KIND_CLS[block.kind] ?? "bg-bone-2 text-ink";
                    const href = block.relatedTripId
                      ? `/admin/trip/${block.relatedTripId}`
                      : null;
                    const label = block.tripCode ?? block.notes ?? block.kind;
                    const inner = (
                      <span
                        className={[
                          "block h-7 truncate rounded-[2px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                          cls,
                        ].join(" ")}
                        title={`${block.kind} · ${block.startAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")} → ${block.endAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}`}
                      >
                        {label}
                      </span>
                    );
                    return (
                      <div
                        key={`${i}-block`}
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
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${i}-empty`}
                      className="border-l border-ink-3 px-1 py-2"
                    />
                  );
                })}
              </div>
            </div>
            {blocks.length === 0 ? (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                — No blocks in window. Available for the full 14 days.
              </p>
            ) : null}
          </section>

          {/* Recent trips */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Recent trips · {recentTrips.length}</h2>
            {recentTrips.length === 0 ? (
              <p className="text-[13px] text-steel">— No trips flown on this tail yet.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {recentTrips.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-4 py-3"
                  >
                    <Link
                      href={`/admin/trip/${t.id}`}
                      className="font-mono text-[11px] tracking-[0.04em] text-clearance hover:underline"
                    >
                      {t.tripCode}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {t.paxCount} pax ·{" "}
                      {t.wheelsUpAt
                        ? t.wheelsUpAt.toISOString().slice(0, 10)
                        : t.createdAt.toISOString().slice(0, 10)}
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        TRIP_STATUS_CLASS[t.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone">
                      {t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}
                    </span>
                    <span />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Spec */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-5">— Spec sheet</h2>
            <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3 text-[12px]">
              <Row k="— Range">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {row.rangeNm.toLocaleString()} NM
                </span>
              </Row>
              <Row k="— Cruise speed">
                <span className="font-mono tracking-[0.04em] text-bone">{row.speedKt} KT</span>
              </Row>
              <Row k="— Seats">
                <span className="font-mono tracking-[0.04em] text-bone">{row.seats}</span>
              </Row>
              <Row k="— Wi-Fi">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {WIFI_LABEL[row.wifiType] ?? row.wifiType}
                </span>
              </Row>
              <Row k="— Cabin height">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {row.cabinHeightIn ? `${row.cabinHeightIn}"` : "—"}
                </span>
              </Row>
              <Row k="— Cabin features">
                <span className="text-bone">
                  {cabinFeatures.length ? cabinFeatures.join(" · ") : "—"}
                </span>
              </Row>
              <Row k="— Base">
                <span className="font-mono tracking-[0.06em] text-bone">
                  {row.baseIcao ?? "—"}
                </span>
              </Row>
              <Row k="— Total hours">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {row.totalHours ? row.totalHours.toLocaleString() : "—"}
                </span>
              </Row>
              <Row k="— Last C-check">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {row.lastCCheckOn ? String(row.lastCCheckOn) : "—"}
                </span>
              </Row>
            </dl>
          </section>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-6">
          {/* Edit fields */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Edit fields</h2>
            <AircraftForm mode="edit" initial={acRow} operatorOptions={operatorOptions} />
          </section>

          {/* Operator card */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Operator</h2>
            <Link
              href={`/admin/operators/${row.operatorId}`}
              className="font-serif text-[22px] leading-tight text-bone transition-colors hover:text-clearance"
            >
              {row.operatorName} →
            </Link>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
              {row.operatorCertNumber ?? "—"} · status{" "}
              <span className="text-bone">{row.operatorStatus}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {row.operatorIsPreferred ? (
                <span className="rounded-[2px] bg-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink">
                  Preferred
                </span>
              ) : null}
              <span
                className={[
                  "rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                  row.operatorArgus === "platinum"
                    ? "border-clearance text-clearance"
                    : row.operatorArgus === "gold"
                      ? "border-[#C9A961] text-[#C9A961]"
                      : "border-bone-2 text-bone-2",
                ].join(" ")}
              >
                ARG/US {row.operatorArgus}
              </span>
              {row.operatorWyvern ? (
                <span className="rounded-[2px] border border-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                  Wyvern Wingman
                </span>
              ) : null}
            </div>
          </section>

          {/* Onboarded */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— History</h2>
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-[12px]">
              <Row k="— On network since">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {row.createdAt.toISOString().slice(0, 10)}
                </span>
              </Row>
              <Row k="— Category">
                <span className="font-mono uppercase tracking-[0.08em] text-bone">
                  {row.category}
                </span>
              </Row>
              <Row k="— Status">
                <span
                  className={[
                    "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    STATUS_CLASS[row.status] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {row.status}
                </span>
              </Row>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{k}</dt>
      <dd>{children}</dd>
    </>
  );
}
