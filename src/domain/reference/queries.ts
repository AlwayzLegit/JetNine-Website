import { and, asc, count, desc, eq, gt, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { airports, fbos } from "@/db/schema/airports";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { trips } from "@/db/schema/trips";
import { SOURCING_INELIGIBLE_STATUSES } from "@/lib/operator-eligibility";

/**
 * Reference-data queries shared by the admin operators / aircraft / airports
 * / ops pages and /api/v1/reference/*. Facts only; the pages keep their
 * labels and colours.
 */

// ─── Operators ───────────────────────────────────────────────────────────

export type OperatorTotals = { operators: number; active: number; auditDue: number; suspended: number };

async function loadOperators() {
  return db
    .select({
      id: operators.id,
      name: operators.name,
      certNumber: operators.certNumber,
      homeAirportIcao: operators.homeAirportIcao,
      yearsPartner: operators.yearsPartner,
      isPreferred: operators.isPreferred,
      status: operators.status,
      argusRating: operators.argusRating,
      wyvernWingman: operators.wyvernWingman,
      isbaoStage: operators.isbaoStage,
      nextAuditOn: operators.nextAuditOn,
      insuranceRenewsOn: operators.insuranceRenewsOn,
      suspendedReason: operators.suspendedReason,
    })
    .from(operators)
    .orderBy(desc(operators.isPreferred), asc(operators.name));
}

export type OperatorListItem = Awaited<ReturnType<typeof loadOperators>>[number] & { fleetCount: number };

/** Every operator, preferred first, with its aircraft count and status totals. */
export async function listOperators(): Promise<{ operators: OperatorListItem[]; totals: OperatorTotals }> {
  const [rows, counts] = await Promise.all([
    loadOperators(),
    db.select({ operatorId: aircraft.operatorId, n: count() }).from(aircraft).groupBy(aircraft.operatorId),
  ]);
  const fleetByOperator = new Map(counts.map((c) => [c.operatorId, c.n]));
  const list = rows.map((r) => ({ ...r, fleetCount: fleetByOperator.get(r.id) ?? 0 }));
  return {
    operators: list,
    totals: {
      operators: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      auditDue: rows.filter((r) => r.status === "audit_due").length,
      suspended: rows.filter((r) => r.status === "suspended" || r.status === "hold").length,
    },
  };
}

/** Operators we may source from (not suspended / banned / on hold), for forms. */
export async function listSourcingOperators(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .where(notInArray(operators.status, [...SOURCING_INELIGIBLE_STATUSES]))
    .orderBy(asc(operators.name));
}

// ─── Aircraft ────────────────────────────────────────────────────────────

export type AircraftTotals = { total: number; available: number; aog: number; maint: number };

async function loadAircraft() {
  return db
    .select({
      id: aircraft.id,
      tailNumber: aircraft.tailNumber,
      operatorId: aircraft.operatorId,
      operatorName: operators.name,
      category: aircraft.category,
      makeModel: aircraft.makeModel,
      yearManufactured: aircraft.yearManufactured,
      seats: aircraft.seats,
      rangeNm: aircraft.rangeNm,
      speedKt: aircraft.speedKt,
      wifiType: aircraft.wifiType,
      standupCabin: aircraft.standupCabin,
      lieflatCapable: aircraft.lieflatCapable,
      petFriendly: aircraft.petFriendly,
      baseIcao: aircraft.baseIcao,
      totalHours: aircraft.totalHours,
      status: aircraft.status,
    })
    .from(aircraft)
    .innerJoin(operators, eq(operators.id, aircraft.operatorId))
    .orderBy(asc(aircraft.category), asc(aircraft.tailNumber));
}

export type AircraftListItem = Awaited<ReturnType<typeof loadAircraft>>[number];

/** Every aircraft with its operator, ordered by category then tail, plus status totals. */
export async function listAircraft(): Promise<{ aircraft: AircraftListItem[]; totals: AircraftTotals }> {
  const rows = await loadAircraft();
  return {
    aircraft: rows,
    totals: {
      total: rows.length,
      available: rows.filter((r) => r.status === "available").length,
      aog: rows.filter((r) => r.status === "aog").length,
      maint: rows.filter((r) => r.status === "maint").length,
    },
  };
}

// ─── Airports ────────────────────────────────────────────────────────────

export type AirportListItem = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  region: string | null;
  countryIso2: string;
  category: string | null;
  customs: string;
  active: boolean;
  fboCount: number;
};

export type AirportTotals = { airports: number; active: number; intl: number; countries: number; fbos: number };

/** Every airport with its FBO count, ordered by country then ICAO, plus totals. */
export async function listAirports(): Promise<{ airports: AirportListItem[]; totals: AirportTotals }> {
  const [rows, totalFbos] = await Promise.all([
    db
      .select({
        id: airports.id,
        icao: airports.icao,
        iata: airports.iata,
        name: airports.name,
        city: airports.city,
        region: airports.region,
        countryIso2: airports.countryIso2,
        category: airports.category,
        customs: airports.customs,
        active: airports.active,
        fboCount: sql<number>`(
          select count(*)::int from public.fbos f where f.airport_id = ${airports.id}
        )`,
      })
      .from(airports)
      .orderBy(asc(airports.countryIso2), asc(airports.icao)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(fbos)
      .then((r) => r[0]?.n ?? 0),
  ]);
  return {
    airports: rows,
    totals: {
      airports: rows.length,
      active: rows.filter((r) => r.active).length,
      intl: rows.filter((r) => r.customs === "intl").length,
      countries: new Set(rows.map((r) => r.countryIso2)).size,
      fbos: totalFbos,
    },
  };
}

// ─── Counts for the reference-data index ─────────────────────────────────

export type ReferenceCounts = {
  operators: number;
  aircraft: number;
  airports: number;
  fbos: number;
  empty_legs: number;
  ai_providers: number;
};

/** Row counts behind /admin/settings/reference. Partial when a table is missing. */
export async function referenceCounts(): Promise<Partial<ReferenceCounts>> {
  try {
    const [row] = await db.execute<ReferenceCounts>(sql`
      select
        (select count(*)::int from public.operators)                                       as operators,
        (select count(*)::int from public.aircraft)                                        as aircraft,
        (select count(*)::int from public.airports)                                        as airports,
        (select count(*)::int from public.fbos)                                            as fbos,
        (select count(*)::int from public.empty_legs where status in ('scheduled','live')) as empty_legs,
        (select count(*)::int from public.ai_providers where enabled)                      as ai_providers
    `);
    return row ?? {};
  } catch {
    // A missing table (e.g. ai_providers before migration 0047) must not
    // take the whole page down — the links still work.
    return {};
  }
}

// ─── Schedule blocks (ops board) ─────────────────────────────────────────

/** Truncate a Date to the start of its UTC day. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

async function loadFleet() {
  return db
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
}

async function loadBlocks(from: Date, to: Date) {
  return db
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
    .where(and(lt(aircraftScheduleBlocks.startAt, to), gt(aircraftScheduleBlocks.endAt, from)))
    .orderBy(asc(aircraftScheduleBlocks.aircraftId), asc(aircraftScheduleBlocks.startAt));
}

export type FleetRowFacts = Awaited<ReturnType<typeof loadFleet>>[number];
export type ScheduleBlockFacts = Awaited<ReturnType<typeof loadBlocks>>[number];

export type ScheduleWindow = {
  /** Start of today (UTC). */
  from: Date;
  /** Exclusive end of the window. */
  to: Date;
  days: number;
  fleet: FleetRowFacts[];
  /** Blocks overlapping the window, ordered by aircraft then start. */
  blocks: ScheduleBlockFacts[];
  /** Share (0–100) of aircraft-days in the window with at least one block. */
  utilizationPct: number;
};

/** The ops board: every aircraft plus the schedule blocks in the next `days` days. */
export async function listScheduleBlocks(now = new Date(), days = 14): Promise<ScheduleWindow> {
  const span = Math.min(60, Math.max(1, Math.floor(days)));
  const from = startOfUtcDay(now);
  const to = addDays(from, span);
  const [fleet, blocks] = await Promise.all([loadFleet(), loadBlocks(from, to)]);

  const blocksByTail = new Map<string, ScheduleBlockFacts[]>();
  for (const b of blocks) blocksByTail.set(b.aircraftId, [...(blocksByTail.get(b.aircraftId) ?? []), b]);

  const totalCells = fleet.length * span;
  let busyCells = 0;
  for (const ac of fleet) {
    for (let i = 0; i < span; i++) {
      const dayStart = addDays(from, i);
      const dayEnd = addDays(from, i + 1);
      if ((blocksByTail.get(ac.id) ?? []).some((b) => b.startAt < dayEnd && b.endAt > dayStart)) busyCells++;
    }
  }
  const utilizationPct = totalCells > 0 ? Math.round((busyCells / totalCells) * 100) : 0;

  return { from, to, days: span, fleet, blocks, utilizationPct };
}
