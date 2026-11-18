// Run with: node --test scripts/worker-errors/
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_LINES, buildBody, parseArgs, redact, report, run } from "./query.mjs";

const T = Date.UTC(2026, 10, 18, 7, 22, 45);
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const env = { CLOUDFLARE_API_TOKEN: "TOKEN-VALUE-SECRET", CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
const ARGS = ["2026-11-18T07:10:00Z", "2026-11-18T07:40:00Z", "production"];

const event = (over = {}) => ({
  dataset: "cloudflare-workers",
  timestamp: T,
  $metadata: { service: "jetnine-web", level: "log", message: "ok", url: "https://jetnine.com/contact?token=SECRETQUERY&email=a@b.co" },
  $workers: { scriptName: "jetnine-web", outcome: "ok", event: { request: { url: "https://jetnine.com/contact?token=SECRETQUERY", method: "GET", headers: { cookie: "session=SECRETCOOKIE" } }, response: { status: 200 } } },
  ...over,
});
const answer = (events, count = events.length) => ({ ok: true, status: 200, json: async () => ({ success: true, errors: [], result: { events: { events, count } } }) });

test("redact removes emails, urls, quoted values, params lists, long digit runs and tokens", () => {
  const out = redact('Failed query: select * from users where email = \'a@b.co\' params: ayman@x.com,+18185551234,secret-value https://x.test/p?q=1 code 123456789 abcdefghijklmnopqrstuvwxyz0123 "quoted"');
  for (const forbidden of ["a@b.co", "ayman", "18185551234", "secret-value", "x.test", "123456789", "abcdefghijklmnopqrstuvwxyz0123", "quoted"]) assert.ok(!out.includes(forbidden), `${forbidden} must be gone: ${out}`);
  assert.match(out, /params: <redacted>$/);
  assert.match(out, /^Failed query: select \* from users/);
  assert.equal(redact("word ".repeat(100)).length, 160);
  assert.equal(redact(undefined), "");
});

test("the window must be at most 2 hours, in order, with a time zone, not in the future, and the env known", () => {
  assert.equal(parseArgs(ARGS, NOW).services[0], "jetnine-edge");
  assert.equal(parseArgs([ARGS[0], ARGS[1], "staging"], NOW).services[1], "jetnine-web-staging");
  assert.throws(() => parseArgs(["2026-11-18T07:00:00Z", "2026-11-18T09:00:01Z", "production"], NOW), /at most 2 hours/);
  assert.doesNotThrow(() => parseArgs(["2026-11-18T07:00:00Z", "2026-11-18T09:00:00Z", "production"], NOW));
  assert.throws(() => parseArgs([ARGS[1], ARGS[0], "production"], NOW), /later than from/);
  assert.throws(() => parseArgs(["2026-11-18T07:00:00", "2026-11-18T07:30:00", "production"], NOW), /time zone/);
  assert.throws(() => parseArgs(["yesterday", "today", "production"], NOW), /ISO times/);
  assert.throws(() => parseArgs([ARGS[0], ARGS[1], "prod"], NOW), /production or staging/);
  assert.throws(() => parseArgs(["2026-11-19T07:00:00Z", "2026-11-19T07:30:00Z", "production"], NOW), /future/);
});

test("the request asks for the events of the two Workers of the environment in the window, in ms", () => {
  const body = buildBody(parseArgs(ARGS, NOW));
  assert.deepEqual(body.timeframe, { from: Date.parse(ARGS[0]), to: Date.parse(ARGS[1]) });
  assert.equal(body.view, "events");
  const group = body.parameters.filters[0];
  assert.deepEqual(group.filters.map((f) => f.value), ["jetnine-edge", "jetnine-web"]);
  assert.ok(group.filters.every((f) => f.key === "$metadata.service" && f.operation === "eq"));
});

test("errors, non-ok outcomes and 5xx responses are listed; a 200 with outcome ok is not", () => {
  const events = [
    event(),
    event({ $metadata: { service: "jetnine-web", level: "error", message: "TypeError: cannot read x of undefined" } }),
    event({ $workers: { scriptName: "jetnine-web", outcome: "exceededCpu", event: { response: { status: 200 } } } }),
    event({ $workers: { scriptName: "jetnine-edge", outcome: "ok", event: { request: { url: "https://jetnine.com/", method: "GET" }, response: { status: 500 } } }, $metadata: { service: "jetnine-edge", level: "log", message: "x" } }),
  ];
  const md = report(events, { from: T, to: T + 1000, env: "production" });
  assert.match(md, /Events read: 4\./);
  assert.match(md, /### jetnine-web\nEvents: 3, errors: 2\./);
  assert.match(md, /### jetnine-edge\nEvents: 1, errors: 1\./);
  assert.match(md, /First 3 of 3 error events/);
  assert.match(md, /GET \/ .*status 500/);
  assert.match(md, /outcome exceededCpu/);
  assert.match(md, /1 x TypeError: cannot read x of undefined/);
});

test("the report never carries a query string, header, cookie, address, token or account id", async () => {
  const bad = event({ $metadata: { service: "jetnine-web", level: "error", message: 'boom for ayman@x.com at https://jetnine.com/a?token=SECRETQUERY params: SECRETPARAM' } });
  const { text } = await run(ARGS, env, async () => answer([bad, event()]), NOW);
  for (const forbidden of ["SECRETQUERY", "SECRETCOOKIE", "SECRETPARAM", "ayman@x.com", "cookie", "TOKEN-VALUE-SECRET", ACCOUNT]) assert.ok(!text.includes(forbidden), `must not contain ${forbidden}`);
  assert.match(text, /params: <redacted>/);
});

test("it lists at most 50 error lines and says how many more there are", () => {
  const many = Array.from({ length: 70 }, () => event({ $metadata: { service: "jetnine-web", level: "error", message: "same failure 123456789" } }));
  const md = report(many, { from: T, to: T + 1, env: "production" });
  assert.equal(md.split("\n").filter((l) => l.startsWith("- ") && l.includes("level error")).length, MAX_LINES);
  assert.match(md, /and 20 more not shown/);
  assert.match(md, /- 70 x same failure <n>/);
});

test("the most common messages are grouped after redaction and counted", () => {
  const mk = (id) => event({ $metadata: { service: "jetnine-web", level: "error", message: `failed for user ${id}00000` } });
  const md = report([mk(1), mk(2), mk(3), event({ $metadata: { service: "jetnine-web", level: "error", message: "other" } })], { from: T, to: T + 1, env: "production" });
  assert.match(md, /- 3 x failed for user <n>/);
  assert.match(md, /- 1 x other/);
});

test("a 401 or 403 prints the one line about the token and exits 0", async () => {
  for (const status of [401, 403]) {
    const r = await run(ARGS, env, async () => ({ ok: false, status, json: async () => ({ success: false, errors: [{ message: "Authentication error" }] }) }), NOW);
    assert.equal(r.text, "the deploy token cannot read Workers Logs (needs Workers Observability read)");
    assert.equal(r.exit, 0);
  }
});

test("another failure exits 1 and shows the status and the provider's message, redacted", async () => {
  const r = await run(ARGS, env, async () => ({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: 'bad filter "$metadata.x" for 123456789' }] }) }), NOW);
  assert.equal(r.exit, 1);
  assert.match(r.text, /HTTP 400, bad filter "<str>" for <n>/);
  const net = await run(ARGS, env, async () => { throw new TypeError("fetch failed secret detail"); }, NOW);
  assert.equal(net.exit, 1);
  assert.ok(!net.text.includes("secret"));
});

test("an empty answer says it is not the same as no errors, and a missing token stops before any request", async () => {
  const r = await run(ARGS, env, async () => answer([]), NOW);
  assert.match(r.text, /Events read: 0/);
  assert.match(r.text, /not the same as no errors/);
  let called = false;
  const none = await run(ARGS, {}, async () => { called = true; return answer([]); }, NOW);
  assert.equal(none.exit, 2);
  assert.equal(called, false);
  assert.equal((await run(["x", "y", "production"], env, async () => answer([]), NOW)).exit, 2);
});

test("the names of the first event's fields are printed, never their values, and a capped query says so", async () => {
  const r = await run(ARGS, env, async () => answer([event()], 5000), NOW);
  assert.match(r.text, /- \$metadata: level, message, service, url/);
  assert.match(r.text, /- \$workers: event, outcome, scriptName/);
  assert.match(r.text, /more exist: the query is capped/);
  assert.ok(!r.text.includes("contact?token"));
});
