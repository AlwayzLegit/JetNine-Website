import test from "node:test";
import assert from "node:assert/strict";
import { planScheduleBlock, syncTripScheduleBlock, type ScheduleExecutor, type ScheduleLeg, type ScheduleTrip } from "./schedule-block";

const d = (s: string) => new Date(s);
const trip = (over: Partial<ScheduleTrip> = {}): ScheduleTrip => ({
  tripCode: "JN-2026-0001",
  aircraftId: "ac1",
  status: "confirmed",
  wheelsUpAt: null,
  wheelsDownAt: null,
  etaAt: null,
  ...over,
});
const leg = (over: Partial<ScheduleLeg> = {}): ScheduleLeg => ({ scheduledDepAt: null, scheduledArrAt: null, departDate: null, ...over });

test("no aircraft: no block", () => {
  const legs = [leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:00:00Z") })];
  assert.deepEqual(planScheduleBlock(trip({ aircraftId: null }), legs), { action: "clear" });
});

test("no times at all: no block", () => {
  assert.deepEqual(planScheduleBlock(trip(), []), { action: "clear" });
  assert.deepEqual(planScheduleBlock(trip(), [leg()]), { action: "clear" });
});

test("cancelled trips clear the block, other statuses keep it", () => {
  const legs = [leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:00:00Z") })];
  assert.deepEqual(planScheduleBlock(trip({ status: "cancelled_wx" }), legs), { action: "clear" });
  assert.deepEqual(planScheduleBlock(trip({ status: "cancelled_other" }), legs), { action: "clear" });
  assert.equal(planScheduleBlock(trip({ status: "diverted" }), legs).action, "set");
});

test("leg times: earliest departure to latest arrival, notes are the trip code", () => {
  const legs = [
    leg({ scheduledDepAt: d("2026-12-02T09:00:00Z"), scheduledArrAt: d("2026-12-02T11:00:00Z") }),
    leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:30:00Z") }),
  ];
  assert.deepEqual(planScheduleBlock(trip(), legs), {
    action: "set",
    aircraftId: "ac1",
    startAt: d("2026-12-01T10:00:00Z"),
    endAt: d("2026-12-02T11:00:00Z"),
    notes: "JN-2026-0001",
  });
});

test("a leg with only a date counts as 00:00 UTC, and that alone is not a window", () => {
  assert.deepEqual(planScheduleBlock(trip(), [leg({ departDate: "2026-12-05" })]), { action: "clear" });
  const plan = planScheduleBlock(trip({ etaAt: d("2026-12-05T18:00:00Z") }), [leg({ departDate: "2026-12-05" })]);
  assert.deepEqual(plan, { action: "set", aircraftId: "ac1", startAt: d("2026-12-05T00:00:00Z"), endAt: d("2026-12-05T18:00:00Z"), notes: "JN-2026-0001" });
});

test("wheels times win over leg times, wheels-down over the ETA", () => {
  const legs = [leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:00:00Z") })];
  const plan = planScheduleBlock(
    trip({ wheelsUpAt: d("2026-12-01T10:20:00Z"), wheelsDownAt: d("2026-12-01T12:40:00Z"), etaAt: d("2026-12-01T12:10:00Z") }),
    legs,
  );
  assert.equal(plan.action === "set" && plan.startAt.toISOString(), "2026-12-01T10:20:00.000Z");
  assert.equal(plan.action === "set" && plan.endAt.toISOString(), "2026-12-01T12:40:00.000Z");
});

test("an end that is not after the start clears the block", () => {
  const legs = [leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T10:00:00Z") })];
  assert.deepEqual(planScheduleBlock(trip(), legs), { action: "clear" });
});

test("a later wheels-up moves the planned block", () => {
  const legs = [leg({ scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:00:00Z") })];
  const before = planScheduleBlock(trip(), legs);
  const after = planScheduleBlock(trip({ wheelsUpAt: d("2026-12-01T11:00:00Z") }), legs);
  assert.equal(before.action === "set" && before.startAt.toISOString(), "2026-12-01T10:00:00.000Z");
  assert.equal(after.action === "set" && after.startAt.toISOString(), "2026-12-01T11:00:00.000Z");
});

// A stand-in for the database handle: each select resolves to the next queued result.
function fakeExecutor(selects: unknown[][]) {
  const ops: { op: string; value?: unknown }[] = [];
  let i = 0;
  const select = () => {
    const result = selects[i++] ?? [];
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit"]) chain[m] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return chain;
  };
  const executor = {
    select,
    delete: () => ({ where: async () => void ops.push({ op: "delete" }) }),
    insert: () => ({ values: async (value: unknown) => void ops.push({ op: "insert", value }) }),
    update: () => ({ set: (value: unknown) => ({ where: async () => void ops.push({ op: "update", value }) }) }),
  } as unknown as ScheduleExecutor;
  return { executor, ops };
}

const tripRow = { tripCode: "JN-2026-0001", aircraftId: "ac1", status: "confirmed", wheelsUpAt: null, wheelsDownAt: null, etaAt: null };
const legRow = { scheduledDepAt: d("2026-12-01T10:00:00Z"), scheduledArrAt: d("2026-12-01T12:00:00Z"), departDate: null };

test("syncTripScheduleBlock inserts a block when none exists", async () => {
  const { executor, ops } = fakeExecutor([[tripRow], [legRow], []]);
  await syncTripScheduleBlock(executor, "t1");
  assert.deepEqual(ops.map((o) => o.op), ["insert"]);
  assert.deepEqual(ops[0].value, {
    aircraftId: "ac1", kind: "trip", startAt: d("2026-12-01T10:00:00Z"), endAt: d("2026-12-01T12:00:00Z"), relatedTripId: "t1", notes: "JN-2026-0001",
  });
});

test("syncTripScheduleBlock updates the block that exists, and is the same on a repeat", async () => {
  for (let run = 0; run < 2; run++) {
    const { executor, ops } = fakeExecutor([[tripRow], [legRow], [{ id: "b1" }]]);
    await syncTripScheduleBlock(executor, "t1");
    assert.deepEqual(ops.map((o) => o.op), ["update"]);
    const set = ops[0].value as Record<string, unknown>;
    assert.equal((set.startAt as Date).toISOString(), "2026-12-01T10:00:00.000Z");
    assert.equal(set.notes, "JN-2026-0001");
  }
});

test("syncTripScheduleBlock deletes the block when the trip is cancelled", async () => {
  const { executor, ops } = fakeExecutor([[{ ...tripRow, status: "cancelled_wx" }], [legRow]]);
  await syncTripScheduleBlock(executor, "t1");
  assert.deepEqual(ops.map((o) => o.op), ["delete"]);
});

test("syncTripScheduleBlock does nothing for a trip that is gone", async () => {
  const { executor, ops } = fakeExecutor([[]]);
  await syncTripScheduleBlock(executor, "gone");
  assert.deepEqual(ops, []);
});
