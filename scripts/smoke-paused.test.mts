/* eslint-disable no-console */
// Run with: pnpm exec tsx --test scripts/smoke-paused.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPausedReply, pausedVerdict } from "./smoke-paused.mjs";

const reply = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) });
const paused503 = reply(503, { "x-jetnine-writes": "paused" });

test("the pause header is read from the exact value only", () => {
  assert.equal(isPausedReply(paused503), true);
  assert.equal(isPausedReply(reply(200)), false);
  assert.equal(isPausedReply(reply(200, { "x-jetnine-writes": "off" })), false);
});

test("an unpaused site is judged by the normal checks", () => {
  assert.equal(pausedVerdict(false, "POST", "/api/stripe/webhook", reply(400)), null);
  assert.equal(pausedVerdict(false, "POST", "/api/stripe/webhook", paused503), null);
});

test("a paused site answering a writing request with the pause 503 passes", () => {
  for (const [method, path] of [
    ["POST", "/api/stripe/webhook"],
    ["POST", "/api/email/inbound/wrongsecret"],
    ["POST", "/api/twilio/inbound"],
    ["POST", "/api/email/unsubscribe/smoke-not-a-real-token"],
    ["GET", "/api/cron/empty-leg-watchlists"],
    ["GET", "/api/v1/me"],
    ["GET", "/api/v1/agent/context"],
  ] as const) {
    assert.equal(pausedVerdict(true, method, path, paused503)?.ok, true, `${method} ${path}`);
  }
});

test("a paused site that answers a writing request another way fails", () => {
  const v = pausedVerdict(true, "POST", "/api/stripe/webhook", reply(400));
  assert.equal(v?.ok, false);
  assert.match(v?.detail ?? "", /expected 503/);
  // A 503 without the pause header is a real outage, not the pause.
  assert.equal(pausedVerdict(true, "POST", "/api/twilio/inbound", reply(503))?.ok, false);
  assert.equal(pausedVerdict(true, "POST", "/api/twilio/inbound", reply(500, { "x-jetnine-writes": "paused" }))?.ok, false);
});

test("reads the pause does not block keep their normal checks while paused", () => {
  assert.equal(pausedVerdict(true, "GET", "/", reply(200)), null);
  assert.equal(pausedVerdict(true, "GET", "/api/health", reply(200)), null);
  assert.equal(pausedVerdict(true, "GET", "/account", reply(307)), null);
});
