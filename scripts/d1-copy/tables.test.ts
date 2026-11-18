import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HELD_BACK, copyPlan, referentialOrder } from "./tables";
import { applyMigrations, foreignKeyReport, openMemoryDb, readMigrations } from "./preflight.mjs";

const KNOWN_TYPES = new Set(["SQLiteText", "SQLiteTimestamp", "SQLiteInteger", "SQLiteBoolean", "SQLiteTextJson"]);

test("the copy plan covers every D1 table (51 at OPS-100, 57 with the four voice tables of OPS-129), once each", () => {
  const plan = copyPlan();
  assert.ok(plan.length >= 57, `expected at least 57 tables, found ${plan.length}`);
  assert.equal(new Set(plan.map((t) => t.name)).size, plan.length);
  assert.ok(plan.some((t) => t.name === "users"));
  assert.ok(plan.some((t) => t.name === "user_sessions"));
});

test("the four voice call tables are copied, parents first, and none is held back (OPS-129)", () => {
  const plan = copyPlan();
  const at = (n: string) => plan.findIndex((t) => t.name === n);
  for (const n of ["voice_leads", "voice_calls", "voice_trip_requests", "voice_messages"]) {
    assert.ok(at(n) >= 0, `${n} is not in the plan`);
    assert.equal(plan[at(n)].nullRefs.length, 0, `${n} has a nulled reference`);
    assert.ok(!(n in HELD_BACK), `${n} is held back`);
  }
  assert.ok(at("voice_leads") < at("voice_calls"));
  assert.ok(at("voice_calls") < at("voice_trip_requests"));
  assert.ok(at("voice_calls") < at("voice_messages"));
  const plus = (n: string) => plan[at(n)].columns.find((c) => c.name === "transcript" || c.name === "depart_date_iso");
  assert.equal(plus("voice_calls")?.columnType, "SQLiteTextJson");
  assert.equal(plus("voice_trip_requests")?.columnType, "SQLiteText");
});

test("every column has a type the mapping knows, and every table one key", () => {
  for (const t of copyPlan()) {
    for (const c of t.columns) assert.ok(KNOWN_TYPES.has(c.columnType), `${t.name}.${c.name}: ${c.columnType}`);
    assert.ok(t.columns.some((c) => c.name === t.pk), `${t.name}: key column missing`);
    assert.equal(t.keyColumns[0], t.pk);
    assert.ok(t.keyColumns.length <= 2);
  }
});

test("the staging database the tool may write to is the one wrangler.jsonc names for staging", () => {
  const text = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const staging = text.slice(text.indexOf('"staging": {'));
  assert.match(staging, /"binding": "DB",\s*"database_name": "jetnine-staging"/);
  // Production's own DB binding (OPS-183) is a different database: the copy tool never names it.
  const before = text.slice(0, text.indexOf('"staging": {'));
  assert.match(before, /"binding": "DB",\s*"database_name": "jetnine-production"/);
  assert.doesNotMatch(before, /"database_name": "jetnine-staging"/);
});

test("the credential tables and the rate-limit counters are held back, and each held name is a real table", () => {
  const names = new Set(copyPlan().map((t) => t.name));
  for (const held of Object.keys(HELD_BACK)) assert.ok(names.has(held), `${held} is not a D1 table`);
  assert.deepEqual(Object.keys(HELD_BACK).sort(), ["ai_providers", "api_keys", "request_rate_limits", "user_credentials", "user_sessions"]);
});

// OPS-115: the load order, and the references into the held-back tables.

test("every parent table comes before its children in the plan", () => {
  const plan = copyPlan();
  const at = new Map(plan.map((t, i) => [t.name, i]));
  let checked = 0;
  for (const t of plan) {
    for (const p of t.parents) {
      assert.ok(at.has(p), `${t.name}: parent ${p} is not in the plan`);
      assert.ok(at.get(p)! < at.get(t.name)!, `${t.name} is loaded before its parent ${p}`);
      checked++;
    }
  }
  assert.ok(checked > 50, `expected the 79 foreign keys to give many parent links, saw ${checked}`);
});

test("the order is stable: the same plan twice, and ties broken by name", () => {
  assert.deepEqual(copyPlan().map((t) => t.name), copyPlan().map((t) => t.name));
  assert.deepEqual(
    referentialOrder([
      { name: "c", parents: ["a"] },
      { name: "b", parents: [] },
      { name: "a", parents: [] },
    ]),
    ["a", "b", "c"],
  );
});

test("a cycle between tables is refused and the tables are named", () => {
  assert.throws(
    () => referentialOrder([{ name: "x", parents: ["y"] }, { name: "y", parents: ["x"] }, { name: "z", parents: [] }]),
    /cycle between: x, y/,
  );
  // A table that points at itself is not a cycle for the order.
  assert.deepEqual(referentialOrder([{ name: "t", parents: ["t"] }]), ["t"]);
});

test("the five references into api_keys and ai_providers are nulled, and none of them is NOT NULL", () => {
  const plan = copyPlan();
  const refs = (name: string) => plan.find((t) => t.name === name)!.nullRefs;
  assert.deepEqual(refs("agent_runs"), ["key_id"]);
  assert.deepEqual(refs("api_requests"), ["key_id"]);
  assert.deepEqual(refs("approvals"), ["requested_by_key"]);
  assert.deepEqual(refs("ai_routes"), ["fallback_provider_id", "primary_provider_id"]);
  // Every other table keeps its references.
  const all = plan.filter((t) => t.nullRefs.length > 0).map((t) => t.name).sort();
  assert.deepEqual(all, ["agent_runs", "ai_routes", "api_requests", "approvals"]);
});

test("the D1 migrations load in memory, hold every table of the plan, and the empty plan breaks no key", async () => {
  const db = await openMemoryDb();
  applyMigrations(db, readMigrations(join(import.meta.dirname, "../../src/db/d1/migrations")));
  const have = new Set((db.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map((r) => r.name));
  for (const t of copyPlan()) {
    assert.ok(have.has(t.name), `${t.name} is not in the migrations`);
    const cols = new Set((db.prepare(`pragma table_info("${t.name}")`).all() as { name: string }[]).map((r) => r.name));
    for (const c of t.columns) assert.ok(cols.has(c.name), `${t.name}.${c.name} is not in the migrations`);
  }
  assert.deepEqual(foreignKeyReport(db), []);
  db.close();
});
