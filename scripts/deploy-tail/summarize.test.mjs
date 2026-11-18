// Run with: node --test scripts/deploy-tail/
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskSegment, parseTail, safePath, summarizeWorker } from "./summarize.mjs";

const ev = (over = {}) => ({
  outcome: "ok",
  scriptName: "jetnine-web",
  eventTimestamp: Date.UTC(2026, 10, 16, 20, 32, 10, 330),
  exceptions: [],
  logs: [{ message: ["a customer@example.com secret log line"] }],
  event: {
    request: { url: "https://jetnine.com/account?token=abc123&email=a@b.co", method: "GET", headers: { cookie: "session=SECRET", authorization: "Bearer SECRET" } },
    response: { status: 200 },
  },
  ...over,
});
const lines = (...events) => events.map((e) => JSON.stringify(e)).join("\n");

test("only events whose outcome is not ok are listed, with counts per outcome", () => {
  const text = lines(ev(), ev(), ev({ outcome: "exceededCpu", exceptions: [{ name: "Error", message: "secret message" }] }), ev({ outcome: "responseStreamDisconnected" }));
  const r = summarizeWorker("jetnine-web", text);
  assert.equal(r.total, 4);
  assert.equal(r.notOk, 2);
  assert.match(r.markdown, /ok 2, exceededCpu 1, responseStreamDisconnected 1/);
  assert.match(r.markdown, /GET \/account outcome exceededCpu status 200 exception Error/);
  assert.match(r.markdown, /outcome responseStreamDisconnected/);
  assert.equal((r.markdown.match(/^- /gm) ?? []).length, 2);
});

test("it never prints query strings, headers, log lines or exception messages", () => {
  const text = lines(ev({ outcome: "exception", exceptions: [{ name: "TypeError", message: "customer@example.com leaked" }] }));
  const out = summarizeWorker("jetnine-web", text).markdown;
  for (const forbidden of ["token=abc123", "a@b.co", "SECRET", "customer@example.com", "leaked", "cookie", "authorization", "jetnine.com/"]) {
    assert.ok(!out.includes(forbidden), `output must not contain ${forbidden}`);
  }
  assert.match(out, /exception TypeError/);
});

test("tokens and ids in a path are masked", () => {
  assert.equal(safePath("https://jetnine.com/api/email/unsubscribe/abcDEF123456789xyz?x=1"), "/api/email/unsubscribe/<redacted>");
  assert.equal(safePath("https://jetnine.com/api/email/inbound/wrongsecret"), "/api/email/inbound/<redacted>");
  assert.equal(safePath("https://jetnine.com/trips/1234567"), "/trips/<id>");
  assert.equal(safePath("https://jetnine.com/blog/how-much-does-a-private-jet-cost"), "/blog/how-much-does-a-private-jet-cost");
  assert.equal(safePath("not a url"), "(unreadable url)");
  assert.equal(maskSegment("faq"), "faq");
});

test("lines that are not events are skipped and counted, an empty tail says so", () => {
  const { events, skipped } = parseTail(`Successfully created tail\n${JSON.stringify(ev())}\n{"x":1}\n`);
  assert.equal(events.length, 1);
  assert.equal(skipped, 2);
  assert.match(summarizeWorker("jetnine-edge", "").markdown, /No events seen/);
});

// wrangler tail --format json prints each event indented over many lines.
const pretty = (e) => JSON.stringify(e, null, 2);

test("events spread over many lines are read, counted and listed (OPS-104 review)", () => {
  const text = [
    "Successfully created tail, expires at 2026-11-16T23:00:00Z",
    "Connected to jetnine-edge-staging, waiting for logs...",
    pretty(ev()),
    pretty(ev({ outcome: "exceededCpu", event: { request: { url: "https://example.com/faq?x=1", method: "GET" }, response: { status: 503 } }, exceptions: [{ name: "Error", message: "brace } in \"string\" { here" }] })),
    pretty(ev()),
  ].join("\n");
  const { events, skipped } = parseTail(text);
  assert.equal(events.length, 3);
  assert.equal(skipped, 2);
  const r = summarizeWorker("jetnine-edge-staging", text);
  assert.equal(r.total, 3);
  assert.equal(r.notOk, 1);
  assert.match(r.markdown, /Events read: 3,/);
  assert.match(r.markdown, /GET \/faq outcome exceededCpu status 503 exception Error/);
  assert.ok(!r.markdown.includes("brace"), "exception messages are never printed");
});

test("one object per line and indented objects can be mixed, and a cut-off object is skipped", () => {
  const text = `${JSON.stringify(ev())}\n${pretty(ev({ outcome: "canceled" }))}\n{ "outcome": "ok", "eventTimestamp": 1`;
  const { events, skipped } = parseTail(text);
  assert.equal(events.length, 2);
  assert.equal(skipped, 1);
});

test("a summary with no events says it read none, never just 0 not ok", () => {
  const r = summarizeWorker("jetnine-web", "Successfully created tail\n");
  assert.equal(r.total, 0);
  assert.match(r.markdown, /Events read: 0\. No events seen/);
});

test("an event with no request (scheduled, queue) is listed without a path", () => {
  const out = summarizeWorker("jetnine-web", lines(ev({ outcome: "exceededMemory", event: { cron: "* * * * *" } }))).markdown;
  assert.match(out, /\(no request\) outcome exceededMemory/);
});

test("a long list is capped", () => {
  const many = Array.from({ length: 60 }, () => ev({ outcome: "canceled" }));
  const out = summarizeWorker("jetnine-web", lines(...many)).markdown;
  assert.match(out, /and 10 more not shown/);
});

// OPS-168: a 500 the app renders itself ends with outcome "ok", so it used to be invisible.
test("a 5xx with outcome ok is listed and counted, a 200 and a 404 are not", () => {
  const withStatus = (status, over = {}) => ev({ event: { request: { url: "https://jetnine.com/contact?x=1", method: "GET" }, response: { status } }, ...over });
  const r = summarizeWorker("jetnine-web", lines(withStatus(200), withStatus(404), withStatus(500), withStatus(503), withStatus(200, { outcome: "exceededCpu" })));
  assert.equal(r.total, 5);
  assert.equal(r.notOk, 1);
  assert.equal(r.fiveXx, 2);
  assert.match(r.markdown, /1 not ok, 5xx: 2\./);
  assert.match(r.markdown, /GET \/contact outcome ok status 500/);
  assert.match(r.markdown, /GET \/contact outcome ok status 503/);
  assert.equal((r.markdown.match(/^- /gm) ?? []).length, 3);
  assert.ok(!r.markdown.includes("x=1"));
});

test("an all clear window prints 5xx: 0, and the overall summary adds the 5xx count of every Worker", () => {
  const r = summarizeWorker("jetnine-web", lines(ev(), ev()));
  assert.match(r.markdown, /0 not ok, 5xx: 0\./);
  assert.equal(r.fiveXx, 0);
});
