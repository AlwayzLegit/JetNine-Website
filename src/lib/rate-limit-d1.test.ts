import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1 } from "@/db/d1/test-client";
import { requestRateLimits } from "@/db/d1/schema/rate-limits";
import { d1CountHit, d1PruneBefore } from "./rate-limit-d1";

// OPS-123: contract tests for the D1 side of the rate limiter, on a real SQLite with the
// repo's own D1 migrations applied. The one statement is an upsert that adds one and returns
// the count, as on Postgres.

const WINDOW = 5 * 60 * 1000;
const t0 = Date.UTC(2026, 10, 17, 12, 0, 0);

test("the first hit in a window counts 1, the sixth counts 6", async () => {
  const { client } = freshD1();
  assert.equal(await d1CountHit(client, "contact:1.2.3.4", t0), 1);
  for (let i = 2; i <= 5; i++) await d1CountHit(client, "contact:1.2.3.4", t0);
  assert.equal(await d1CountHit(client, "contact:1.2.3.4", t0), 6);
});

test("a new window starts again at 1", async () => {
  const { client } = freshD1();
  await d1CountHit(client, "contact:1.2.3.4", t0);
  await d1CountHit(client, "contact:1.2.3.4", t0);
  assert.equal(await d1CountHit(client, "contact:1.2.3.4", t0 + WINDOW), 1);
  assert.equal(await d1CountHit(client, "contact:1.2.3.4", t0), 3);
});

test("two buckets count apart", async () => {
  const { client } = freshD1();
  await d1CountHit(client, "contact:1.2.3.4", t0);
  await d1CountHit(client, "contact:1.2.3.4", t0);
  assert.equal(await d1CountHit(client, "guide_request:1.2.3.4", t0), 1);
  assert.equal(await d1CountHit(client, "contact:5.6.7.8", t0), 1);
});

test("the row keeps the bucket and the window start as a Date", async () => {
  const { client } = freshD1();
  await d1CountHit(client, "signin:a@example.com", t0);
  const [row] = await client.select().from(requestRateLimits).where(eq(requestRateLimits.bucket, "signin:a@example.com"));
  assert.equal(row.hits, 1);
  assert.ok(row.windowStart instanceof Date);
  assert.equal(row.windowStart.getTime(), t0);
});

test("prune removes only windows that started before the cutoff", async () => {
  const { client } = freshD1();
  await d1CountHit(client, "a", t0 - 2 * 60 * 60 * 1000);
  await d1CountHit(client, "b", t0 - 30 * 60 * 1000);
  await d1CountHit(client, "c", t0);
  await d1PruneBefore(client, t0 - 60 * 60 * 1000);
  const left = (await client.select().from(requestRateLimits)).map((r) => r.bucket).sort();
  assert.deepEqual(left, ["b", "c"]);
});

test("a hit after a prune of the same window still counts from the surviving row", async () => {
  const { client } = freshD1();
  await d1CountHit(client, "x", t0);
  await d1PruneBefore(client, t0 - 1);
  assert.equal(await d1CountHit(client, "x", t0), 2);
});
