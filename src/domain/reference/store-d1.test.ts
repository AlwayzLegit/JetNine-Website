import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { d1ReferenceStore } from "./store-d1";
import { referenceStore } from "./store";

// OPS-112: contract tests for the D1 reference store (operators, contacts,
// aircraft, airports, FBOs), on a real SQLite with the repo's own D1
// migration applied and foreign keys on, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, store: d1ReferenceStore(client) };
}

const operator = (name: string, over: Record<string, unknown> = {}) => ({ name, ...over });

const plane = (tail: string, operatorId: string, over: Record<string, unknown> = {}) => ({
  tailNumber: tail,
  operatorId,
  category: "midsize" as const,
  makeModel: "Citation XLS",
  seats: 8,
  rangeNm: 1800,
  speedKt: 430,
  ...over,
});

const airport = (icao: string, over: Record<string, unknown> = {}) => ({
  icao,
  name: `Airport ${icao}`,
  city: "City",
  countryIso2: "US",
  lat: "34.2",
  lon: "-118.5",
  ...over,
});

test("insert operator then operatorById round-trips booleans, a date text and vetting_extras JSON", async () => {
  const { store } = fresh();
  const { id } = await store.insertOperator(
    operator("Alpha Air", {
      certNumber: "CERT1",
      isPreferred: true,
      wyvernWingman: true,
      argusRenewsOn: "2027-03-04",
      vettingExtras: { notes: ["a", "b"], score: 3 },
      volumeDiscountPct: "2.50",
    }) as never,
  );
  const got = await store.operatorById(id);
  assert.equal(got?.name, "Alpha Air");
  assert.equal(got?.isPreferred, true);
  assert.equal(got?.wyvernWingman, true);
  assert.equal(got?.rateLock, false);
  assert.equal(got?.argusRenewsOn, "2027-03-04");
  assert.deepEqual(got?.vettingExtras, { notes: ["a", "b"], score: 3 });
  assert.equal(got?.volumeDiscountPct, "2.50");
  assert.equal(got?.faaPart, "135");
  assert.ok(got?.createdAt instanceof Date);
});

test("a second operator with the same cert, a second aircraft with the same tail and a second airport with the same ICAO each fail", async () => {
  const { store } = fresh();
  const op = await store.insertOperator(operator("Op", { certNumber: "C1" }) as never);
  await assert.rejects(() => store.insertOperator(operator("Op2", { certNumber: "C1" }) as never));
  await store.insertAircraft(plane("N100AA", op.id) as never);
  await assert.rejects(() => store.insertAircraft(plane("N100AA", op.id) as never));
  await store.insertAirport(airport("KBUR") as never);
  await assert.rejects(() => store.insertAirport(airport("KBUR") as never));
  assert.ok(await store.operatorIdByCert("C1"));
  assert.equal(await store.operatorIdByCert("NOPE"), undefined);
});

test("the conflict lookups ignore the row being edited", async () => {
  const { store } = fresh();
  const op = await store.insertOperator(operator("Op") as never);
  const ac = await store.insertAircraft(plane("N1", op.id) as never);
  assert.equal((await store.aircraftIdByTail("N1"))?.id, ac.id);
  assert.equal(await store.aircraftIdByTail("N1", ac.id), undefined);
  const ap = await store.insertAirport(airport("KVNY") as never);
  assert.equal((await store.airportIdByIcao("KVNY"))?.id, ap.id);
  assert.equal(await store.airportIdByIcao("KVNY", ap.id), undefined);
});

test("insertAircraft with an unknown operator id fails on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertAircraft(plane("N2", "00000000-0000-4000-8000-000000000000") as never));
  assert.equal(await store.operatorExists("00000000-0000-4000-8000-000000000000"), false);
});

test("updateAircraft changes the row and moves updatedAt forward", async () => {
  const { store } = fresh();
  const op = await store.insertOperator(operator("Op") as never);
  const { id } = await store.insertAircraft(plane("N3", op.id) as never);
  const before = await store.aircraftById(id);
  await new Promise((r) => setTimeout(r, 15));
  await store.updateAircraft(id, plane("N3", op.id, { seats: 9, status: "maint" }) as never);
  const after = await store.aircraftById(id);
  assert.equal(after?.seats, 9);
  assert.equal(after?.status, "maint");
  assert.ok(before && after && after.updatedAt.getTime() > before.updatedAt.getTime());
});

test("aircraftRows joins the operator name and orders by category (enum order) then tail", async () => {
  const { store } = fresh();
  const a = await store.insertOperator(operator("Alpha") as never);
  const b = await store.insertOperator(operator("Bravo") as never);
  await store.insertAircraft(plane("N9", a.id, { category: "heavy" }) as never);
  await store.insertAircraft(plane("N8", b.id, { category: "turboprop" }) as never);
  await store.insertAircraft(plane("N7", a.id, { category: "light" }) as never);
  await store.insertAircraft(plane("N6", b.id, { category: "light" }) as never);
  await store.insertAircraft(plane("N5", a.id, { category: "ulr" }) as never);
  const rows = await store.aircraftRows();
  // Postgres sorts the enum as declared: turboprop, light, midsize, supermid, heavy, ulr.
  assert.deepEqual(rows.map((r) => r.tailNumber), ["N8", "N6", "N7", "N9", "N5"]);
  assert.equal(rows.find((r) => r.tailNumber === "N6")?.operatorName, "Bravo");
  const board = await store.fleetBoard();
  assert.deepEqual(board.map((r) => r.tailNumber), ["N8", "N6", "N7", "N9", "N5"]);
  const fleetA = await store.fleetOf(a.id);
  assert.deepEqual(fleetA.map((r) => r.tailNumber), ["N7", "N9", "N5"]);
});

test("aircraftDetail joins the operator and carries its status and rating", async () => {
  const { store } = fresh();
  const op = await store.insertOperator(operator("Alpha", { certNumber: "C9", argusRating: "gold", isPreferred: true, status: "hold" }) as never);
  const { id } = await store.insertAircraft(plane("N10", op.id, { lavatoryEnclosed: true, lastCCheckOn: "2026-01-02" }) as never);
  const d = await store.aircraftDetail(id);
  assert.equal(d?.operatorName, "Alpha");
  assert.equal(d?.operatorCertNumber, "C9");
  assert.equal(d?.operatorStatus, "hold");
  assert.equal(d?.operatorArgus, "gold");
  assert.equal(d?.operatorIsPreferred, true);
  assert.equal(d?.lavatoryEnclosed, true);
  assert.equal(d?.lastCCheckOn, "2026-01-02");
  assert.ok(d?.createdAt instanceof Date);
  assert.equal(await store.aircraftDetail("00000000-0000-4000-8000-000000000000"), undefined);
});

test("operatorRows puts preferred first, then names with no case split", async () => {
  const { store } = fresh();
  await store.insertOperator(operator("charlie") as never);
  await store.insertOperator(operator("Bravo") as never);
  await store.insertOperator(operator("alpha") as never);
  await store.insertOperator(operator("Zulu", { isPreferred: true }) as never);
  const rows = await store.operatorRows();
  assert.deepEqual(rows.map((r) => r.name), ["Zulu", "alpha", "Bravo", "charlie"]);
});

test("sourcingOperators leaves out suspended, banned and hold", async () => {
  const { store } = fresh();
  for (const status of ["active", "audit_due", "hold", "suspended", "banned"]) {
    await store.insertOperator(operator(`Op ${status}`, { status }) as never);
  }
  const rows = await store.sourcingOperators();
  assert.deepEqual(rows.map((r) => r.name), ["Op active", "Op audit_due"]);
});

test("operatorOptions keeps the current operator even when suspended", async () => {
  const { store } = fresh();
  const ok = await store.insertOperator(operator("Fine") as never);
  const bad = await store.insertOperator(operator("Grounded", { status: "suspended" }) as never);
  await store.insertOperator(operator("Other bad", { status: "banned" }) as never);
  const options = await store.operatorOptions(bad.id);
  assert.deepEqual(options.map((o) => o.name), ["Fine", "Grounded"]);
  assert.deepEqual((await store.operatorOptions(ok.id)).map((o) => o.name), ["Fine"]);
});

test("fleetCounts counts aircraft per operator", async () => {
  const { store } = fresh();
  const a = await store.insertOperator(operator("A") as never);
  const b = await store.insertOperator(operator("B") as never);
  await store.insertOperator(operator("Empty") as never);
  await store.insertAircraft(plane("N11", a.id) as never);
  await store.insertAircraft(plane("N12", a.id) as never);
  await store.insertAircraft(plane("N13", b.id) as never);
  const counts = new Map((await store.fleetCounts()).map((c) => [c.operatorId, c.n]));
  assert.equal(counts.get(a.id), 2);
  assert.equal(counts.get(b.id), 1);
  assert.equal(counts.size, 2);
});

test("contacts: escalation first then name, scoped to the operator, toggle and delete", async () => {
  const { store } = fresh();
  const a = await store.insertOperator(operator("A") as never);
  const b = await store.insertOperator(operator("B") as never);
  const c1 = await store.insertContact({ operatorId: a.id, name: "zed" } as never);
  await store.insertContact({ operatorId: a.id, name: "Amy" } as never);
  await store.insertContact({ operatorId: a.id, name: "bob", isEscalation: true } as never);
  assert.deepEqual((await store.contactsOf(a.id)).map((c) => c.name), ["bob", "Amy", "zed"]);
  assert.equal((await store.contactOf(a.id, c1.id))?.name, "zed");
  assert.equal(await store.contactOf(b.id, c1.id), undefined);
  await store.setContactEscalation(c1.id, true);
  assert.equal((await store.contactOf(a.id, c1.id))?.isEscalation, true);
  await store.deleteContact(c1.id);
  assert.equal(await store.contactOf(a.id, c1.id), undefined);
});

test("deleting an operator that has aircraft is refused (restrict); one with contacts takes them along", async () => {
  const { store, sqlite } = fresh();
  const a = await store.insertOperator(operator("A") as never);
  await store.insertContact({ operatorId: a.id, name: "Amy" } as never);
  await store.insertAircraft(plane("N14", a.id) as never);
  assert.throws(() => sqlite.prepare("delete from operators where id = ?").run(a.id));
});

test("airportRows counts the FBOs of each airport, fboTotal counts them all, ordered by country then ICAO", async () => {
  const { store } = fresh();
  const bur = await store.insertAirport(airport("KBUR") as never);
  const van = await store.insertAirport(airport("KVNY") as never);
  await store.insertAirport(airport("EGLL", { countryIso2: "GB" }) as never);
  await store.insertFbo({ airportId: bur.id, name: "Atlantic" } as never);
  await store.insertFbo({ airportId: bur.id, name: "Signature" } as never);
  await store.insertFbo({ airportId: van.id, name: "Clay Lacy" } as never);
  const rows = await store.airportRows();
  assert.deepEqual(rows.map((r) => r.icao), ["EGLL", "KBUR", "KVNY"]);
  assert.deepEqual(rows.map((r) => r.fboCount), [0, 2, 1]);
  assert.equal(typeof rows[1].fboCount, "number");
  assert.equal(await store.fboTotal(), 3);
});

test("deleteAirport removes its FBOs (cascade)", async () => {
  const { store } = fresh();
  const bur = await store.insertAirport(airport("KBUR") as never);
  const van = await store.insertAirport(airport("KVNY") as never);
  await store.insertFbo({ airportId: bur.id, name: "Atlantic" } as never);
  await store.insertFbo({ airportId: van.id, name: "Clay Lacy" } as never);
  await store.deleteAirport(bur.id);
  assert.equal(await store.airportById(bur.id), undefined);
  assert.deepEqual(await store.fbosOf(bur.id), []);
  assert.equal(await store.fboTotal(), 1);
});

test("fbosOf sorts names with no case split; a name repeats only at another airport", async () => {
  const { store } = fresh();
  const bur = await store.insertAirport(airport("KBUR") as never);
  const van = await store.insertAirport(airport("KVNY") as never);
  await store.insertFbo({ airportId: bur.id, name: "signature" } as never);
  await store.insertFbo({ airportId: bur.id, name: "Atlantic" } as never);
  await store.insertFbo({ airportId: bur.id, name: "Zeta" } as never);
  await assert.rejects(() => store.insertFbo({ airportId: bur.id, name: "Atlantic" } as never));
  await store.insertFbo({ airportId: van.id, name: "Atlantic" } as never);
  assert.deepEqual((await store.fbosOf(bur.id)).map((f) => f.name), ["Atlantic", "signature", "Zeta"]);
});

test("setFboFlag flips one flag only; demoteOtherPrimaries clears the siblings", async () => {
  const { store } = fresh();
  const bur = await store.insertAirport(airport("KBUR") as never);
  const a = await store.insertFbo({ airportId: bur.id, name: "A", isPrimary: true } as never);
  const b = await store.insertFbo({ airportId: bur.id, name: "B", isPreferred: true } as never);
  await store.setFboFlag(b.id, "isPrimary", true);
  let fb = await store.fboOf(bur.id, b.id);
  assert.deepEqual([fb?.isPrimary, fb?.isPreferred], [true, true]);
  await store.demoteOtherPrimaries(bur.id, b.id);
  assert.equal((await store.fboOf(bur.id, a.id))?.isPrimary, false);
  fb = await store.fboOf(bur.id, b.id);
  assert.deepEqual([fb?.isPrimary, fb?.isPreferred], [true, true]);
  await store.setFboFlag(b.id, "isPreferred", false);
  fb = await store.fboOf(bur.id, b.id);
  assert.deepEqual([fb?.isPrimary, fb?.isPreferred], [true, false]);
  assert.equal(await store.fboOf(bur.id, "00000000-0000-4000-8000-000000000000"), undefined);
  await store.deleteFbo(a.id);
  assert.equal(await store.fboOf(bur.id, a.id), undefined);
});

test("numeric lat and lon read back as they were written", async () => {
  const { store } = fresh();
  const { id } = await store.insertAirport(airport("KBUR", { lat: "34.2", lon: "-118.35900" }) as never);
  const got = await store.airportById(id);
  assert.equal(got?.lat, "34.2");
  assert.equal(got?.lon, "-118.35900");
  await store.updateAirport(id, airport("KBUR", { lat: "34.20056", lon: "-118.359" }) as never);
  assert.equal((await store.airportById(id))?.lat, "34.20056");
  assert.deepEqual(await store.airportRef(id), { id, icao: "KBUR", name: "Airport KBUR" });
});

test("an ICAO of the wrong length and a customs value outside the enum are refused", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertAirport(airport("KB") as never));
  await assert.rejects(() => store.insertAirport(airport("KBUR", { customs: "bogus" }) as never));
});

test("counts() matches what was inserted", async () => {
  const { store } = fresh();
  assert.deepEqual(await store.counts(), { operators: 0, aircraft: 0, airports: 0, fbos: 0 });
  const op = await store.insertOperator(operator("A") as never);
  await store.insertOperator(operator("B") as never);
  await store.insertAircraft(plane("N20", op.id) as never);
  const bur = await store.insertAirport(airport("KBUR") as never);
  await store.insertFbo({ airportId: bur.id, name: "Atlantic" } as never);
  await store.insertFbo({ airportId: bur.id, name: "Signature" } as never);
  assert.deepEqual(await store.counts(), { operators: 2, aircraft: 1, airports: 1, fbos: 2 });
});

// ── the switch ──

function withEnv<T>(target: string, env: string, fn: () => T): T {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = target;
  process.env.DEPLOY_ENV = env;
  try {
    return fn();
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
}

test("referenceStore(): target d1 with no DB binding throws", () => {
  withEnv("d1", "staging", () => {
    assert.throws(() => referenceStore(), /DB_TARGET is d1 but the DB binding is missing/);
  });
});

test("referenceStore(): production never gets the d1 store, whatever DB_TARGET says", () => {
  withEnv("d1", "production", () => {
    assert.equal(typeof referenceStore().operatorRows, "function");
  });
});
