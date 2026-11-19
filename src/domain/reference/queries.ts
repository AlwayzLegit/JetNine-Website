import { emptyLegStore } from "@/domain/empty-legs/store";
import { aiProviderStore } from "@/domain/settings/ai-store";
import { tripStore, type WindowBlockRow } from "@/domain/trips/store";
import { referenceStore, type AircraftListRow, type FleetBoardRow, type OperatorRow } from "./store";

/**
 * Reference-data queries shared by the admin operators / aircraft / airports
 * / ops pages and /api/v1/reference/*. Facts only; the pages keep their
 * labels and colours.
 */

// ─── Operators ───────────────────────────────────────────────────────────

export type OperatorTotals = { operators: number; active: number; auditDue: number; suspended: number };

export type OperatorListItem = OperatorRow & { fleetCount: number };

/** Every operator, preferred first, with its aircraft count and status totals. */
export async function listOperators(): Promise<{ operators: OperatorListItem[]; totals: OperatorTotals }> {
  const store = referenceStore();
  const [rows, counts] = await Promise.all([store.operatorRows(), store.fleetCounts()]);
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
  return referenceStore().sourcingOperators();
}

// ─── Aircraft ────────────────────────────────────────────────────────────

export type AircraftTotals = { total: number; available: number; aog: number; maint: number };

export type AircraftListItem = AircraftListRow;

/** Every aircraft with its operator, ordered by category then tail, plus status totals. */
export async function listAircraft(): Promise<{ aircraft: AircraftListItem[]; totals: AircraftTotals }> {
  const rows = await referenceStore().aircraftRows();
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
  const store = referenceStore();
  const [rows, totalFbos] = await Promise.all([store.airportRows(), store.fboTotal()]);
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
  // The store is chosen outside the try: a d1 target without its binding
  // must fail loudly, not come back as an empty page (OPS-112, OPS-113).
  const store = referenceStore();
  const legs = emptyLegStore();
  const providers = aiProviderStore();
  try {
    // The four reference counts, the empty-legs count and the enabled AI
    // providers go through their stores (Postgres or D1; OPS-166 for providers).
    const [reference, aiProviders, emptyLegCount] = await Promise.all([
      store.counts(),
      providers.countEnabled(),
      legs.countActive(),
    ]);
    return { ...reference, ai_providers: aiProviders, empty_legs: emptyLegCount };
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

export type FleetRowFacts = FleetBoardRow;
export type ScheduleBlockFacts = WindowBlockRow;

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
  const [fleet, blocks] = await Promise.all([referenceStore().fleetBoard(), tripStore().blocksInWindow(from, to)]);

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
