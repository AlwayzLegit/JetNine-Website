import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeD1 } from "./health-db";

const ok = async () => ({ ok: 1 });
const boom = (name: string) => async () => {
  const e = new Error("secret detail from the database");
  e.name = name;
  throw e;
};
const never = () => new Promise<never>(() => {});
const quiet = () => {};

test("on d1 the db check is ok when D1 answers, whatever Postgres does", async () => {
  const pgDown = await judgeD1({ d1Present: true, d1Ping: ok, pgPing: boom("PostgresError"), info: { d1: "ok", d1Tables: 31 }, log: quiet });
  assert.equal(pgDown.ok, true);
  assert.equal(pgDown.target, "d1");
  assert.equal(pgDown.postgres, "error");
  assert.equal(pgDown.d1Tables, 31);
  assert.equal(typeof pgDown.latencyMs, "number");
  const pgUp = await judgeD1({ d1Present: true, d1Ping: ok, pgPing: ok, log: quiet });
  assert.equal(pgUp.ok, true);
  assert.equal(pgUp.postgres, "ok");
});

test("on d1 a broken D1 makes the check fail even when Postgres is healthy, and only the error name is shown", async () => {
  const r = await judgeD1({ d1Present: true, d1Ping: boom("D1_ERROR"), pgPing: ok, log: quiet });
  assert.equal(r.ok, false);
  assert.equal(r.error, "D1_ERROR");
  assert.equal(r.postgres, "ok");
  assert.ok(!JSON.stringify(r).includes("secret detail"));
});

test("on d1 a missing binding fails the check with a fixed word", async () => {
  let pinged = false;
  const r = await judgeD1({ d1Present: false, d1Ping: async () => { pinged = true; }, pgPing: ok, info: { d1: "absent" }, log: quiet });
  assert.equal(r.ok, false);
  assert.equal(r.error, "d1 binding absent");
  assert.equal(r.d1, "absent");
  assert.equal(pinged, false);
});

test("a D1 that never answers fails after the time limit instead of hanging, and so does a Postgres that never answers (information only)", async () => {
  const slow = await judgeD1({ d1Present: true, d1Ping: never, pgPing: ok, timeoutMs: 20, log: quiet });
  assert.equal(slow.ok, false);
  assert.equal(slow.error, "PingTimeout");
  const pgHang = await judgeD1({ d1Present: true, d1Ping: ok, pgPing: never, timeoutMs: 20, log: quiet });
  assert.equal(pgHang.ok, true);
  assert.equal(pgHang.postgres, "error");
});

test("the failure is logged with the error name only", async () => {
  const lines: Array<[string, Record<string, unknown>]> = [];
  await judgeD1({ d1Present: true, d1Ping: boom("D1_ERROR"), pgPing: ok, log: (l, d) => lines.push([l, d]) });
  assert.deepEqual(lines, [["[health] d1 db probe failed", { name: "D1_ERROR" }]]);
});
