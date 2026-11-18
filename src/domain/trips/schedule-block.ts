import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { db } from "@/db";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { tripLegs, trips } from "@/db/schema/trips";
import { aircraftScheduleBlocks as d1Blocks } from "@/db/d1/schema/schedule-blocks";
import { tripLegs as d1TripLegs, trips as d1Trips } from "@/db/d1/schema/trips";

// A trip with an aircraft and times keeps one aircraft_schedule_blocks row in
// step with it (OPS-102). Until now the Postgres trigger trips_sync_schedule_block
// did this (jn_internal.sync_trip_to_schedule_block, migration 0025). D1 cannot
// run triggers, so the app does the same after each trip or trip-leg write. It
// recomputes from the current rows (idempotent), so running beside the trigger
// arrives at the same row.

export type ScheduleTrip = {
  tripCode: string;
  aircraftId: string | null;
  status: string;
  wheelsUpAt: Date | null;
  wheelsDownAt: Date | null;
  etaAt: Date | null;
};

export type ScheduleLeg = {
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
  /** YYYY-MM-DD; read as 00:00 UTC when a leg has no scheduled time. */
  departDate: string | null;
};

export type ScheduleBlockPlan =
  | { action: "clear" }
  | { action: "set"; aircraftId: string; startAt: Date; endAt: Date; notes: string };

const CANCELLED = new Set(["cancelled_wx", "cancelled_other"]);

function dayStartUtc(date: string | null): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function earliest(times: (Date | null)[]): Date | null {
  const real = times.filter((t): t is Date => t !== null);
  return real.length ? new Date(Math.min(...real.map((t) => t.getTime()))) : null;
}

function latest(times: (Date | null)[]): Date | null {
  const real = times.filter((t): t is Date => t !== null);
  return real.length ? new Date(Math.max(...real.map((t) => t.getTime()))) : null;
}

/**
 * Start: the wheels-up time, else the earliest leg departure (or its date at
 * 00:00 UTC). End: wheels-down, else the ETA, else the latest leg arrival (or
 * its date at 00:00 UTC). No aircraft, no times, an end not after the start, or
 * a cancelled trip: the block goes away.
 */
export function planScheduleBlock(trip: ScheduleTrip, legs: ScheduleLeg[]): ScheduleBlockPlan {
  const startAt =
    trip.wheelsUpAt ?? earliest(legs.map((l) => l.scheduledDepAt ?? dayStartUtc(l.departDate)));
  const endAt =
    trip.wheelsDownAt ?? trip.etaAt ?? latest(legs.map((l) => l.scheduledArrAt ?? dayStartUtc(l.departDate)));

  if (!trip.aircraftId || !startAt || !endAt || endAt.getTime() <= startAt.getTime()) return { action: "clear" };
  if (CANCELLED.has(trip.status)) return { action: "clear" };
  return { action: "set", aircraftId: trip.aircraftId, startAt, endAt, notes: trip.tripCode };
}

export type ScheduleExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

/**
 * Call after every trip insert or update and every trip-leg insert, update or
 * delete, in the same transaction where one exists.
 */
export async function syncTripScheduleBlock(executor: ScheduleExecutor, tripId: string): Promise<void> {
  const [trip] = await executor
    .select({
      tripCode: trips.tripCode,
      aircraftId: trips.aircraftId,
      status: trips.status,
      wheelsUpAt: trips.wheelsUpAt,
      wheelsDownAt: trips.wheelsDownAt,
      etaAt: trips.etaAt,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) return;

  const legs = await executor
    .select({
      scheduledDepAt: tripLegs.scheduledDepAt,
      scheduledArrAt: tripLegs.scheduledArrAt,
      departDate: tripLegs.departDate,
    })
    .from(tripLegs)
    .where(eq(tripLegs.tripId, tripId));

  const plan = planScheduleBlock(trip, legs);
  if (plan.action === "clear") {
    await executor.delete(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, tripId));
    return;
  }

  const existing = await executor
    .select({ id: aircraftScheduleBlocks.id })
    .from(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.relatedTripId, tripId))
    .limit(1);
  if (existing.length === 0) {
    await executor.insert(aircraftScheduleBlocks).values({
      aircraftId: plan.aircraftId,
      kind: "trip",
      startAt: plan.startAt,
      endAt: plan.endAt,
      relatedTripId: tripId,
      notes: plan.notes,
    });
    return;
  }
  await executor
    .update(aircraftScheduleBlocks)
    .set({
      aircraftId: plan.aircraftId,
      startAt: plan.startAt,
      endAt: plan.endAt,
      notes: plan.notes,
      updatedAt: new Date(),
    })
    .where(eq(aircraftScheduleBlocks.relatedTripId, tripId));
}

/**
 * The D1 twin of syncTripScheduleBlock (OPS-156): the same reads, the same planScheduleBlock
 * decision, on the D1 tables. D1 has no trigger and no interactive transaction, so like the
 * Postgres function it recomputes from the current rows (idempotent) after the trip write.
 * The Postgres function stays as it is; convert-to-trip (src/domain/requests/commands.ts)
 * still calls it inside its transaction until its own row (OPS-157).
 */
export async function syncTripScheduleBlockD1(client: DrizzleD1Database, tripId: string): Promise<void> {
  const [trip] = await client
    .select({
      tripCode: d1Trips.tripCode,
      aircraftId: d1Trips.aircraftId,
      status: d1Trips.status,
      wheelsUpAt: d1Trips.wheelsUpAt,
      wheelsDownAt: d1Trips.wheelsDownAt,
      etaAt: d1Trips.etaAt,
    })
    .from(d1Trips)
    .where(eq(d1Trips.id, tripId))
    .limit(1);
  if (!trip) return;

  const legs = await client
    .select({
      scheduledDepAt: d1TripLegs.scheduledDepAt,
      scheduledArrAt: d1TripLegs.scheduledArrAt,
      departDate: d1TripLegs.departDate,
    })
    .from(d1TripLegs)
    .where(eq(d1TripLegs.tripId, tripId));

  const plan = planScheduleBlock(trip, legs);
  if (plan.action === "clear") {
    await client.delete(d1Blocks).where(eq(d1Blocks.relatedTripId, tripId));
    return;
  }

  const existing = await client
    .select({ id: d1Blocks.id })
    .from(d1Blocks)
    .where(eq(d1Blocks.relatedTripId, tripId))
    .limit(1);
  if (existing.length === 0) {
    await client.insert(d1Blocks).values({
      aircraftId: plan.aircraftId,
      kind: "trip",
      startAt: plan.startAt,
      endAt: plan.endAt,
      relatedTripId: tripId,
      notes: plan.notes,
    });
    return;
  }
  await client
    .update(d1Blocks)
    .set({
      aircraftId: plan.aircraftId,
      startAt: plan.startAt,
      endAt: plan.endAt,
      notes: plan.notes,
      updatedAt: new Date(),
    })
    .where(eq(d1Blocks.relatedTripId, tripId));
}
