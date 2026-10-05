import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gt, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { trips } from "@/db/schema/trips";
import { formatUSD } from "@/lib/quote-pricing";
import { AircraftForm } from "@/components/admin/aircraft-form";
import { SOURCING_INELIGIBLE_STATUSES } from "@/lib/operator-eligibility";
import { DeskCard, DeskHeader, DeskPage, DotSentence, NumberCard, StatusPill } from "@/components/admin/desk-ui";
import { passengersWords, tripState } from "@/lib/desk-status";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const HORIZON_DAYS = 14;

type Tone = "gold" | "steel" | "success" | "danger";

const STATUS_WORDS: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  aog: { label: "Grounded (AOG)", tone: "danger" },
  maint: { label: "In maintenance", tone: "gold" },
  sold: { label: "Sold / retired", tone: "steel" },
};

const OPERATOR_STATUS_WORDS: Record<string, string> = {
  active: "Active",
  audit_due: "Audit due",
  hold: "On hold",
  suspended: "Suspended",
  banned: "Banned",
};

const ARGUS_WORDS: Record<string, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  none: "Not rated",
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

const KIND_WORDS: Record<string, string> = {
  trip: "Trip",
  maintenance: "Maintenance",
  repositioning: "Reposition",
  crew_rest: "Crew rest",
  owner: "Owner",
  hold: "Soft hold",
  unavailable: "Unavailable",
};

const KIND_CLS: Record<string, string> = {
  trip: "bg-clearance text-ink",
  maintenance: "bg-gold text-ink",
  repositioning: "bg-bone-2 text-ink",
  crew_rest: "bg-steel text-ink",
  owner: "bg-gold text-white",
  hold: "bg-transparent border border-dashed border-clearance text-clearance",
  unavailable: "bg-danger text-ink",
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  return Number.isNaN(d.getTime()) ? String(date) : DATE_FMT.format(d);
}

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

  // Operator options for the editor's operator-swap dropdown — exclude
  // sourcing-ineligible operators (suspended / banned / hold) via the shared
  // safety-floor list, but always keep this aircraft's current operator so an
  // existing assignment to an ineligible operator still renders in the select.
  const operatorOptions = await db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .where(
      or(
        notInArray(operators.status, [...SOURCING_INELIGIBLE_STATUSES]),
        eq(operators.id, row.operatorId),
      ),
    )
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
  if (row.standupCabin) cabinFeatures.push("Stand-up cabin");
  if (row.lavatoryEnclosed) cabinFeatures.push("Enclosed lavatory");
  if (row.lieflatCapable) cabinFeatures.push("Lie-flat seating");
  if (row.flightAttendantStandard) cabinFeatures.push("Flight attendant as standard");
  if (row.petFriendly) cabinFeatures.push("Pet-friendly");

  const dayHeaders = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  const status = STATUS_WORDS[row.status] ?? { label: row.status, tone: "steel" as Tone };

  const leadParts = [
    `Tail ${row.tailNumber}`,
    row.yearManufactured ? String(row.yearManufactured) : null,
    CATEGORY_LABEL[row.category] ?? row.category,
    row.baseIcao ? `Based at ${row.baseIcao}` : null,
    row.totalHours ? `${row.totalHours.toLocaleString()} hours` : null,
  ].filter(Boolean);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/aircraft", label: "Aircraft" }}
        title={row.makeModel}
        lead={`${leadParts.join(" · ")}.`}
        actions={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <NumberCard label="Trips flown" value={aggregate?.lifetimeTrips ?? 0} />
        <NumberCard label="Lifetime revenue" value={formatUSD(aggregate?.lifetimeRevenue ?? 0)} />
        <NumberCard label="Passengers flown" value={aggregate?.totalPax ?? 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* LEFT */}
        <div className="flex flex-col gap-6">
          {/* 14-day strip */}
          <DeskCard
            title={`Next ${HORIZON_DAYS} days`}
            actions={
              <Link href="/admin/ops" className="text-[14px] text-steel transition-colors hover:text-bone">
                Full planner →
              </Link>
            }
          >
            <div className="mt-4 overflow-x-auto">
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
                        "border-l border-line-faint px-2 py-2 text-center",
                        isToday ? "rounded-t-control bg-surface-2 text-clearance" : "text-steel",
                      ].join(" ")}
                    >
                      <div className="text-[12px]">
                        {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                      </div>
                      <div className="mt-0.5 text-[14px] font-medium text-bone">{d.getUTCDate()}</div>
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
                    const kindLabel = KIND_WORDS[block.kind] ?? block.kind;
                    const href = block.relatedTripId
                      ? `/admin/trips/${block.relatedTripId}`
                      : null;
                    const label = block.tripCode ?? block.notes ?? kindLabel;
                    const inner = (
                      <span
                        className={[
                          "block h-7 truncate rounded-[4px] px-2 py-1 text-[12px] font-medium leading-5",
                          cls,
                        ].join(" ")}
                        title={`${kindLabel} · ${block.startAt
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
                        className="border-l border-line-faint px-1 py-2"
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
                      className="border-l border-line-faint px-1 py-2"
                    />
                  );
                })}
              </div>
            </div>
            {blocks.length === 0 ? (
              <p className="mt-4 text-[14px] text-steel">
                Nothing scheduled. Available for the full {HORIZON_DAYS} days.
              </p>
            ) : null}
          </DeskCard>

          {/* Recent trips */}
          <DeskCard title={`Recent trips · ${recentTrips.length}`}>
            {recentTrips.length === 0 ? (
              <p className="mt-4 text-[15px] text-steel">No trips flown on this aircraft yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line-faint">
                {recentTrips.map((t) => {
                  const s = tripState(t.status);
                  return (
                    <li
                      key={t.id}
                      className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[auto_1fr_auto_auto] md:gap-4"
                    >
                      <Link
                        href={`/admin/trips/${t.id}`}
                        className="text-[15px] font-medium text-bone hover:underline"
                      >
                        {t.tripCode}
                      </Link>
                      <span className="text-[14px] text-bone-2">
                        {passengersWords(t.paxCount)} · {formatDate(t.wheelsUpAt ?? t.createdAt)}
                      </span>
                      <span className="pill pill-outline">
                        <DotSentence tone={s.dot}>{s.label}</DotSentence>
                      </span>
                      <span className="text-[15px] text-bone">
                        {t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          {/* Spec */}
          <DeskCard title="Spec sheet">
            <dl className="dl-jn mt-4">
              <dt>Range</dt>
              <dd>{row.rangeNm.toLocaleString()} nm</dd>
              <dt>Cruise speed</dt>
              <dd>{row.speedKt} kt</dd>
              <dt>Seats</dt>
              <dd>{row.seats}</dd>
              <dt>Wi-Fi</dt>
              <dd>{WIFI_LABEL[row.wifiType] ?? row.wifiType}</dd>
              <dt>Cabin height</dt>
              <dd>{row.cabinHeightIn ? `${row.cabinHeightIn} in` : "—"}</dd>
              <dt>Cabin features</dt>
              <dd>{cabinFeatures.length ? cabinFeatures.join(" · ") : "—"}</dd>
              <dt>Base</dt>
              <dd>{row.baseIcao ?? "—"}</dd>
              <dt>Total hours</dt>
              <dd>{row.totalHours ? row.totalHours.toLocaleString() : "—"}</dd>
              <dt>Last C-check</dt>
              <dd>{row.lastCCheckOn ? formatDate(row.lastCCheckOn) : "—"}</dd>
            </dl>
          </DeskCard>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-6">
          {/* Edit fields */}
          <DeskCard title="Edit aircraft">
            <div className="mt-4">
              <AircraftForm mode="edit" initial={acRow} operatorOptions={operatorOptions} />
            </div>
          </DeskCard>

          {/* Operator card */}
          <DeskCard title="Operator">
            <Link
              href={`/admin/operators/${row.operatorId}`}
              className="mt-3 block text-[19px] font-medium leading-tight text-bone transition-colors hover:text-clearance"
            >
              {row.operatorName} →
            </Link>
            <p className="mt-2 text-[14px] text-steel">
              {row.operatorCertNumber ? `Certificate ${row.operatorCertNumber} · ` : ""}
              {OPERATOR_STATUS_WORDS[row.operatorStatus] ?? row.operatorStatus.replace(/_/g, " ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {row.operatorIsPreferred ? <span className="pill pill-clearance">Preferred</span> : null}
              <span className="pill pill-outline">
                ARG/US {ARGUS_WORDS[row.operatorArgus] ?? row.operatorArgus}
              </span>
              {row.operatorWyvern ? <span className="pill pill-outline">Wyvern Wingman</span> : null}
            </div>
          </DeskCard>

          {/* Onboarded */}
          <DeskCard title="History">
            <dl className="dl-jn mt-4">
              <dt>On the network since</dt>
              <dd>{formatDate(row.createdAt)}</dd>
              <dt>Category</dt>
              <dd>{CATEGORY_LABEL[row.category] ?? row.category}</dd>
              <dt>Status</dt>
              <dd>
                <DotSentence tone={status.tone}>{status.label}</DotSentence>
              </dd>
            </dl>
          </DeskCard>
        </div>
      </div>
    </DeskPage>
  );
}
