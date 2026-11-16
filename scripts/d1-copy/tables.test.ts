import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELD_BACK, copyPlan } from "./tables";

const KNOWN_TYPES = new Set(["SQLiteText", "SQLiteTimestamp", "SQLiteInteger", "SQLiteBoolean", "SQLiteTextJson"]);

test("the copy plan covers every D1 table (51 at OPS-100), once each", () => {
  const plan = copyPlan();
  assert.ok(plan.length >= 51, `expected at least 51 tables, found ${plan.length}`);
  assert.equal(new Set(plan.map((t) => t.name)).size, plan.length);
  assert.ok(plan.some((t) => t.name === "users"));
  assert.ok(plan.some((t) => t.name === "user_sessions"));
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
  // No other binding called DB anywhere before the staging block (production has none).
  const before = text.slice(0, text.indexOf('"staging": {'));
  assert.doesNotMatch(before, /"binding": "DB"/);
});

test("the credential tables are held back, and each held name is a real table", () => {
  const names = new Set(copyPlan().map((t) => t.name));
  for (const held of Object.keys(HELD_BACK)) assert.ok(names.has(held), `${held} is not a D1 table`);
  assert.deepEqual(Object.keys(HELD_BACK).sort(), ["ai_providers", "api_keys", "user_credentials", "user_sessions"]);
});
