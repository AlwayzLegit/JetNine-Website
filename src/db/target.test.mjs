import test from "node:test";
import assert from "node:assert/strict";
import { parseDbTarget } from "./target.mjs";

test("missing, empty or unknown means postgres", () => {
  assert.equal(parseDbTarget(undefined, "staging"), "postgres");
  assert.equal(parseDbTarget(null, "staging"), "postgres");
  assert.equal(parseDbTarget("", "staging"), "postgres");
  assert.equal(parseDbTarget("sqlite", "staging"), "postgres");
  assert.equal(parseDbTarget(1, "staging"), "postgres");
});

test("postgres stays postgres", () => {
  assert.equal(parseDbTarget("postgres", "staging"), "postgres");
  assert.equal(parseDbTarget("postgres", "production"), "postgres");
});

test("d1 is honoured outside production", () => {
  assert.equal(parseDbTarget("d1", "staging"), "d1");
  assert.equal(parseDbTarget("d1", "development"), "d1");
});

test("production refuses d1 until the cutover row changes it", () => {
  assert.equal(parseDbTarget("d1", "production"), "postgres");
});

test("capital letters do not count as d1", () => {
  assert.equal(parseDbTarget("D1", "staging"), "postgres");
});
