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

test("an event with no request (scheduled, queue) is listed without a path", () => {
  const out = summarizeWorker("jetnine-web", lines(ev({ outcome: "exceededMemory", event: { cron: "* * * * *" } }))).markdown;
  assert.match(out, /\(no request\) outcome exceededMemory/);
});

test("a long list is capped", () => {
  const many = Array.from({ length: 60 }, () => ev({ outcome: "canceled" }));
  const out = summarizeWorker("jetnine-web", lines(...many)).markdown;
  assert.match(out, /and 10 more not shown/);
});
