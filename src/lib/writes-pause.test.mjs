import test from "node:test";
import assert from "node:assert/strict";
import { PAUSE_HEADER, PAUSE_VALUE, RETRY_AFTER_SECONDS, blocksRequest, isPaused, pausedResponse } from "./writes-pause.mjs";

// OPS-205: the write pause for the database cutover. Off unless the value is exactly "cutover".

test("only the exact value cutover turns the pause on", () => {
  assert.equal(PAUSE_VALUE, "cutover");
  assert.equal(isPaused("cutover"), true);
  assert.equal(isPaused(undefined), false);
  assert.equal(isPaused(null), false);
  assert.equal(isPaused(""), false);
  assert.equal(isPaused("Cutover"), false);
  assert.equal(isPaused(" cutover"), false);
  assert.equal(isPaused("cutover "), false);
  assert.equal(isPaused("true"), false);
  assert.equal(isPaused(1), false);
});

test("POST, PUT, PATCH and DELETE are blocked on any path", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
    assert.equal(blocksRequest(m, "/"), true, m);
    assert.equal(blocksRequest(m, "/api/stripe/webhook"), true, m);
    assert.equal(blocksRequest(m, "/contact"), true, m);
  }
});

test("plain page reads are not blocked", () => {
  assert.equal(blocksRequest("GET", "/"), false);
  assert.equal(blocksRequest("GET", "/blog"), false);
  assert.equal(blocksRequest("HEAD", "/contact"), false);
  assert.equal(blocksRequest("GET", "/api/health"), false);
  assert.equal(blocksRequest("GET", "/sitemap.xml"), false);
});

test("OPTIONS is not blocked", () => {
  assert.equal(blocksRequest("OPTIONS", "/api/v1/me"), false);
  assert.equal(blocksRequest("OPTIONS", "/"), false);
});

test("GET and HEAD that write are blocked: sign-in links, the API and the crons", () => {
  assert.equal(blocksRequest("GET", "/auth/callback"), true);
  assert.equal(blocksRequest("GET", "/auth/callback/"), true);
  assert.equal(blocksRequest("GET", "/auth/link"), true);
  assert.equal(blocksRequest("HEAD", "/auth/link"), true);
  assert.equal(blocksRequest("GET", "/api/v1/me"), true);
  assert.equal(blocksRequest("GET", "/api/admin/blog"), true);
  assert.equal(blocksRequest("GET", "/api/cron/sla-watch"), true);
});

test("look alike paths are not blocked", () => {
  assert.equal(blocksRequest("GET", "/auth/reset"), false);
  assert.equal(blocksRequest("GET", "/api/v10/me"), false);
  assert.equal(blocksRequest("GET", "/authentic"), false);
});

test("the paused answer for an API path is JSON with 503, Retry-After and the header", async () => {
  const res = pausedResponse("/api/stripe/webhook");
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("retry-after"), "600");
  assert.equal(RETRY_AFTER_SECONDS, 600);
  assert.equal(res.headers.get(PAUSE_HEADER), "paused");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await res.json(), { error: "paused", retryAfterSeconds: 600 });
});

test("the paused answer for a page is a short HTML page with no dash characters", async () => {
  const res = pausedResponse("/contact");
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("retry-after"), "600");
  assert.equal(res.headers.get(PAUSE_HEADER), "paused");
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  const body = await res.text();
  assert.match(body, /JetNine is moving to a new system/);
  assert.doesNotMatch(body, /[–—]/);
  assert.doesNotMatch(body, /\$|\d{3}/, "no price and no phone number");
});
