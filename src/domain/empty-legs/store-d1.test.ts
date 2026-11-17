import test from "node:test";
import assert from "node:assert/strict";
import { formatCode } from "@/db/codes";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { emptyLegs } from "@/db/d1/schema/empty-legs";
import { operators } from "@/db/d1/schema/operators";
import { d1EmptyLegStore } from "./store-d1";
import { emptyLegStore } from "./store";

// OPS-113: contract tests for the D1 empty-legs store, on a real SQLite with the
// repo's own D1 migration applied, foreign keys on and a batch that is one
// transaction, as D1 has them.

const HOUR = 3_600_000;

async function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  const store = d1EmptyLegStore(client);
  const [op] = await client.insert(operators).values({ name: "bravo air" }).returning({ id: operators.id });
  await client.insert(airports).values([
    { icao: "KVNY", name: "Van Nuys", city: "Van Nuys", countryIso2: "US", region: "CA", lat: "34.2", lon: "-118.5" },
    { icao: "KTEB", name: "Teterboro", city: "Teterboro", countryIso2: "US", region: "NJ", lat: "40.8", lon: "-74.0" },
  ]);
  const [ac] = await client
    .insert(aircraft)
    .values({
      tailNumber: "N100AA",
      operatorId: op.id,
      category: "midsize",
      makeModel: "Citation XLS",
      seats: 8,
      rangeNm: 1800,
      speedKt: 430,
    })
    .returning({ id: aircraft.id });
  return { sqlite, client, store, operatorId: op.id, aircraftId: ac.id };
}

type Ctx = Awaited<ReturnType<typeof fresh>>;

// A leg as the create command builds it (without the code).
const newLeg = (c: Ctx, over: Record<string, unknown> = {}) =>
  ({
    aircraftId: c.aircraftId,
    operatorId: c.operatorId,
    category: "midsize" as const,
    fromIcao: "KVNY",
    toIcao: "KTEB",
    wheelsUpAt: new Date(Date.now() + 48 * HOUR),
    seatsAvailable: 6,
    fullCharterRefUsd: 30000,
    listedPriceUsd: 15000,
    discountPct: 50,
    status: "draft" as const,
    visibilityFlags: { publicBoard: true, memberMatch: false, weeklyDigest: true, affiliateFeed: false },
    ...over,
  }) as never;

// A leg written straight to the table, with a code of its own, for the read tests.
async function seed(c: Ctx, code: string, over: Record<string, unknown> = {}) {
  const [row] = await c.client
    .insert(emptyLegs)
    .values({ ...(newLeg(c) as object), code, ...over } as never)
    .returning({ id: emptyLegs.id });
  return row.id;
}

const counter = (c: Ctx) =>
  c.sqlite
    .prepare("select year, last_value from empty_leg_code_sequence order by year")
    .all()
    .map((r) => ({ year: r.year, last_value: r.last_value }));

test("createLeg twice in one year gives EL-YYYY-0001 then 0002, as formatCode makes them", async () => {
  const c = await fresh();
  const now = new Date("2026-06-01T12:00:00Z");
  const a = await c.store.createLeg(newLeg(c), now);
  const b = await c.store.createLeg(newLeg(c), now);
  assert.equal(a.code, formatCode("empty_leg", 2026, 1));
  assert.equal(b.code, formatCode("empty_leg", 2026, 2));
  assert.equal(a.code, "EL-2026-0001");
  assert.notEqual(a.id, b.id);
  assert.deepEqual(counter(c), [{ year: 2026, last_value: 2 }]);
});

test("a new year starts again at 0001 and the UTC year decides", async () => {
  const c = await fresh();
  await c.store.createLeg(newLeg(c), new Date("2026-12-31T23:59:00Z"));
  const next = await c.store.createLeg(newLeg(c), new Date("2027-01-01T00:00:00Z"));
  assert.equal(next.code, "EL-2027-0001");
});

test("a createLeg whose insert fails leaves the counter where it was (the batch rolled back)", async () => {
  const c = await fresh();
  const now = new Date("2026-06-01T12:00:00Z");
  const first = await c.store.createLeg(newLeg(c), now);
  assert.equal(first.code, "EL-2026-0001");
  // An operator that does not exist: the foreign key refuses the insert.
  await assert.rejects(() => c.store.createLeg(newLeg(c, { operatorId: "no-such-operator" }), now));
  assert.deepEqual(counter(c), [{ year: 2026, last_value: 1 }], "the failed create did not use up a number");
  const next = await c.store.createLeg(newLeg(c), now);
  assert.equal(next.code, "EL-2026-0002", "the next create gets the number that failed");
  const rows = c.sqlite.prepare("select count(*) as n from empty_legs").get() as { n: number };
  assert.equal(rows.n, 2);
});

test("a counter at 12344 gives EL-YYYY-12345, as formatCode does", async () => {
  const c = await fresh();
  c.sqlite.exec("insert into empty_leg_code_sequence (year, last_value) values (2026, 12344)");
  const leg = await c.store.createLeg(newLeg(c), new Date("2026-03-01T00:00:00Z"));
  assert.equal(leg.code, formatCode("empty_leg", 2026, 12345));
  assert.equal(leg.code, "EL-2026-12345");
});

test("visibility_flags round-trips as an object and timestamps as Dates", async () => {
  const c = await fresh();
  const wheelsUp = new Date("2026-08-01T15:30:00Z");
  const { id } = await c.store.createLeg(newLeg(c, { wheelsUpAt: wheelsUp }), new Date("2026-06-01T00:00:00Z"));
  const [row] = await c.client.select().from(emptyLegs);
  assert.equal(row.id, id);
  assert.deepEqual(row.visibilityFlags, { publicBoard: true, memberMatch: false, weeklyDigest: true, affiliateFeed: false });
  assert.ok(row.wheelsUpAt instanceof Date);
  assert.equal(row.wheelsUpAt.getTime(), wheelsUp.getTime());
});

test("boardLegs lists only live legs, soonest first, with the airport region; a leg with no aircraft is still listed", async () => {
  const c = await fresh();
  const soon = new Date(Date.now() + 5 * HOUR);
  const later = new Date(Date.now() + 30 * HOUR);
  await seed(c, "EL-2026-0010", { status: "live", wheelsUpAt: later });
  await seed(c, "EL-2026-0011", { status: "live", wheelsUpAt: soon, aircraftId: null, fromIcao: "KTEB", toIcao: "KVNY" });
  await seed(c, "EL-2026-0012", { status: "draft", wheelsUpAt: soon });
  await seed(c, "EL-2026-0013", { status: "sold", wheelsUpAt: soon });
  const board = await c.store.boardLegs();
  assert.deepEqual(board.map((l) => l.code), ["EL-2026-0011", "EL-2026-0010"]);
  assert.equal(board[0].makeModel, null);
  assert.equal(board[0].fromRegion, "NJ");
  assert.equal(board[0].fromCountry, "US");
  assert.equal(board[1].makeModel, "Citation XLS");
  assert.equal(board[1].fromRegion, "CA");
  assert.equal(board[1].seats, 6);
  assert.equal(board[1].priceWas, 30000);
  assert.equal(board[1].priceNow, 15000);
  assert.equal(board[1].wyvernWingman, false);
  assert.ok(board[1].wheelsUpAt instanceof Date);
});

test("recentlySold returns at most the limit, newest sale first, a sold leg with sold_at null first, as on Postgres", async () => {
  const c = await fresh();
  const t = (h: number) => new Date(Date.now() - h * HOUR);
  await seed(c, "EL-2026-0020", { status: "sold", soldAt: t(10) });
  await seed(c, "EL-2026-0021", { status: "sold", soldAt: t(2) });
  await seed(c, "EL-2026-0022", { status: "sold", soldAt: t(30) });
  await seed(c, "EL-2026-0023", { status: "sold", soldAt: t(5) });
  await seed(c, "EL-2026-0024", { status: "live", soldAt: t(1) });
  const three = await c.store.recentlySold(3);
  assert.deepEqual(three.map((l) => l.code), ["EL-2026-0021", "EL-2026-0023", "EL-2026-0020"]);
  await seed(c, "EL-2026-0025", { status: "sold", soldAt: null });
  const withNull = await c.store.recentlySold(3);
  assert.deepEqual(withNull.map((l) => l.code), ["EL-2026-0025", "EL-2026-0021", "EL-2026-0023"]);
  assert.equal(withNull[0].soldAt, null);
  assert.ok(withNull[1].soldAt instanceof Date);
});

test("liveLegsAfter leaves out a departed leg and a leg that is not live", async () => {
  const c = await fresh();
  const now = new Date();
  await seed(c, "EL-2026-0030", { status: "live", wheelsUpAt: new Date(now.getTime() + 3 * HOUR) });
  await seed(c, "EL-2026-0031", { status: "live", wheelsUpAt: new Date(now.getTime() - 3 * HOUR) });
  await seed(c, "EL-2026-0032", { status: "scheduled", wheelsUpAt: new Date(now.getTime() + 2 * HOUR) });
  await seed(c, "EL-2026-0033", { status: "live", wheelsUpAt: new Date(now.getTime() + 1 * HOUR) });
  const live = await c.store.liveLegsAfter(now);
  assert.deepEqual(live.map((l) => l.code), ["EL-2026-0033", "EL-2026-0030"]);
  assert.equal(live[0].listedPriceUsd, 15000);
  assert.equal(live[0].fullCharterRefUsd, 30000);
});

test("setStatus changes the status and moves updatedAt forward; legForStatus reads it back", async () => {
  const c = await fresh();
  const id = await seed(c, "EL-2026-0040", { status: "draft", updatedAt: new Date("2026-01-01T00:00:00Z") });
  assert.deepEqual(await c.store.legForStatus(id), { id, code: "EL-2026-0040", status: "draft" });
  const at = new Date("2026-06-01T10:00:00Z");
  await c.store.setStatus(id, "live", at);
  assert.deepEqual(await c.store.legForStatus(id), { id, code: "EL-2026-0040", status: "live" });
  const [row] = await c.client.select().from(emptyLegs);
  assert.equal(row.updatedAt.getTime(), at.getTime());
  assert.equal(await c.store.legForStatus("nope"), undefined);
});

test("countActive counts scheduled and live legs only", async () => {
  const c = await fresh();
  assert.equal(await c.store.countActive(), 0);
  for (const [i, status] of (["draft", "scheduled", "live", "live", "sold", "cancelled"] as const).entries()) {
    await seed(c, `EL-2026-005${i}`, { status });
  }
  assert.equal(await c.store.countActive(), 3);
});

test("adminLegs: newest wheels-up first, limited, with the operator name; availableTails sorts operator names without case", async () => {
  const c = await fresh();
  await seed(c, "EL-2026-0060", { wheelsUpAt: new Date("2026-07-01T00:00:00Z") });
  await seed(c, "EL-2026-0061", { wheelsUpAt: new Date("2026-09-01T00:00:00Z") });
  await seed(c, "EL-2026-0062", { wheelsUpAt: new Date("2026-08-01T00:00:00Z") });
  const two = await c.store.adminLegs(2);
  assert.deepEqual(two.map((l) => l.code), ["EL-2026-0061", "EL-2026-0062"]);
  assert.equal(two[0].operatorName, "bravo air");

  const [zulu] = await c.client.insert(operators).values({ name: "Zulu Jets" }).returning({ id: operators.id });
  const [alpha] = await c.client.insert(operators).values({ name: "alpha charter" }).returning({ id: operators.id });
  for (const [tail, op] of [["N200ZZ", zulu.id], ["N300AA", alpha.id]] as const) {
    await c.client.insert(aircraft).values({
      tailNumber: tail, operatorId: op, category: "light", makeModel: "Phenom 300", seats: 6, rangeNm: 1700, speedKt: 450,
    });
  }
  const tails = await c.store.availableTails();
  assert.deepEqual(tails.map((t) => t.operator), ["alpha charter", "bravo air", "Zulu Jets"]);
  assert.deepEqual(tails[0], { tail: "N300AA", makeModel: "Phenom 300", operator: "alpha charter" });
});

test("tailRef finds an aircraft by tail and says nothing for an unknown one", async () => {
  const c = await fresh();
  assert.deepEqual(await c.store.tailRef("N100AA"), { id: c.aircraftId, operatorId: c.operatorId, category: "midsize" });
  assert.equal(await c.store.tailRef("N999ZZ"), undefined);
});

// ── the switch ──

function withEnv(env: { DB_TARGET: string; DEPLOY_ENV: string }, run: () => void) {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = env.DB_TARGET;
  process.env.DEPLOY_ENV = env.DEPLOY_ENV;
  try {
    run();
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
}

test("emptyLegStore(): target d1 with no DB binding throws", () => {
  withEnv({ DB_TARGET: "d1", DEPLOY_ENV: "staging" }, () => {
    assert.throws(() => emptyLegStore(), /DB_TARGET is d1 but the DB binding is missing/);
  });
});

test("emptyLegStore(): production never gets the d1 store, whatever DB_TARGET says", () => {
  withEnv({ DB_TARGET: "d1", DEPLOY_ENV: "production" }, () => {
    assert.equal(typeof emptyLegStore().createLeg, "function");
  });
});
