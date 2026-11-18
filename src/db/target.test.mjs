import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTION_CUTOVER, parseDbTarget } from "./target.mjs";

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

test("production refuses d1 without the second setting", () => {
  assert.equal(parseDbTarget("d1", "production"), "postgres");
  assert.equal(parseDbTarget("d1", "production", undefined), "postgres");
  assert.equal(parseDbTarget("d1", "production", ""), "postgres");
});

test("production uses d1 only with DB_TARGET d1 and DB_CUTOVER exactly production-d1", () => {
  assert.equal(PRODUCTION_CUTOVER, "production-d1");
  assert.equal(parseDbTarget("d1", "production", "production-d1"), "d1");
  assert.equal(parseDbTarget(" d1 ", "production", "production-d1"), "d1"); // DB_TARGET is trimmed as before
});

test("a wrong word for DB_CUTOVER keeps production on postgres", () => {
  for (const word of ["d1", "yes", "true", "1", "production", " production-d1 ", "production-d1 ", "Production-D1", "PRODUCTION-D1", "production_d1", 1, true, null]) {
    assert.equal(parseDbTarget("d1", "production", word), "postgres", `cutover ${JSON.stringify(word)}`);
  }
});

test("DB_CUTOVER alone does not move production, and without d1 it never does", () => {
  assert.equal(parseDbTarget(undefined, "production", "production-d1"), "postgres");
  assert.equal(parseDbTarget("postgres", "production", "production-d1"), "postgres");
  assert.equal(parseDbTarget("sqlite", "production", "production-d1"), "postgres");
});

test("the second setting changes nothing outside production", () => {
  assert.equal(parseDbTarget("d1", "staging", "production-d1"), "d1");
  assert.equal(parseDbTarget("d1", "staging", "anything"), "d1");
  assert.equal(parseDbTarget("postgres", "staging", "production-d1"), "postgres");
  assert.equal(parseDbTarget(undefined, "development", "production-d1"), "postgres");
});

test("capital letters do not count as d1", () => {
  assert.equal(parseDbTarget("D1", "staging"), "postgres");
});
