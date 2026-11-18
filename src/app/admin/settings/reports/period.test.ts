import test from "node:test";
import assert from "node:assert/strict";
import { periodPrevStartDate, periodStartDate } from "./period";

// OPS-154: the CSV export reads through the request store, which takes the window start as a
// date. It is the same day the Postgres expressions of periodBounds give on a UTC database.

const NOW = new Date("2026-11-17T20:45:10.000Z");

test("30 and 90 days back are UTC midnights", () => {
  assert.equal(periodStartDate("30", NOW).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(periodStartDate("90", NOW).toISOString(), "2026-08-19T00:00:00.000Z");
});

test("this year starts on 1 January UTC", () => {
  assert.equal(periodStartDate("ytd", NOW).toISOString(), "2026-01-01T00:00:00.000Z");
});

test("the day just after midnight UTC still counts that day", () => {
  assert.equal(periodStartDate("30", new Date("2026-12-01T00:00:01.000Z")).toISOString(), "2026-11-01T00:00:00.000Z");
});

// OPS-163: the D1 report store takes the previous window's start the same way.

test("the previous window starts twice as far back as the window", () => {
  assert.equal(periodPrevStartDate("30", NOW).toISOString(), "2026-09-18T00:00:00.000Z");
  assert.equal(periodPrevStartDate("90", NOW).toISOString(), "2026-05-21T00:00:00.000Z");
});

test("the previous window of this year starts on 1 January of last year", () => {
  assert.equal(periodPrevStartDate("ytd", NOW).toISOString(), "2025-01-01T00:00:00.000Z");
});
