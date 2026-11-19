// Run with: node --test scripts/worker-errors/
import assert from "node:assert/strict";
import { test } from "node:test";
import { EVENT_LIMIT, MAX_LINES, SLICE_MS, buildBody, parseArgs, redact, report, run, slicesOf } from "./query.mjs";

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

// ─── OPS-195: the window is read in 5 minute slices and a cut is never silent ───

const bodyOf = (init) => JSON.parse(init.body);

test("a 30 minute window is read as 6 queries of 5 minutes, in order, with the same filters", async () => {
  const bodies = [];
  const r = await run(ARGS, env, async (_url, init) => { bodies.push(bodyOf(init)); return answer([]); }, NOW);
  assert.equal(bodies.length, 6);
  const from = Date.parse(ARGS[0]);
  bodies.forEach((b, i) => {
    assert.deepEqual(b.timeframe, { from: from + i * SLICE_MS, to: from + (i + 1) * SLICE_MS });
    assert.equal(b.view, "events");
    assert.deepEqual(b.parameters.filters[0].filters.map((f) => f.value), ["jetnine-edge", "jetnine-web"]);
  });
  assert.match(r.text, /Slices of 5 minutes: 6, capped: 0, failed: 0\./);
  assert.match(r.text, /- slice 07:10 to 07:15: 0 events\n/);
  assert.match(r.text, /- slice 07:35 to 07:40: 0 events\n/);
  assert.equal(r.exit, 0);
});

test("slicesOf: a window that is not a multiple of 5 minutes ends with a short slice; 2 hours is 24 slices", () => {
  const a = Date.UTC(2026, 10, 18, 7, 0, 0);
  assert.deepEqual(slicesOf(a, a + 12 * 60_000), [[a, a + 300_000], [a + 300_000, a + 600_000], [a + 600_000, a + 720_000]]);
  assert.equal(slicesOf(a, a + 2 * 60 * 60_000).length, 24);
});

test("a slice that reached the limit, or whose total is larger than its list, is flagged CAPPED and counted in the header", async () => {
  let n = 0;
  const r = await run(ARGS, env, async () => {
    n += 1;
    if (n === 2) return answer([event()], 5000);
    if (n === 4) return answer(Array.from({ length: EVENT_LIMIT }, () => event()), EVENT_LIMIT);
    return answer([event()]);
  }, NOW);
  assert.match(r.text, /Slices of 5 minutes: 6, capped: 2, failed: 0\./);
  assert.match(r.text, /- slice 07:15 to 07:20: 1 events CAPPED/);
  assert.match(r.text, new RegExp(`- slice 07:25 to 07:30: ${EVENT_LIMIT} events CAPPED`));
  assert.match(r.text, /- slice 07:10 to 07:15: 1 events\n/);
  assert.match(r.text, /more exist: the query is capped/);
});

test("a failed slice is reported with its status and the others still run; a network fault in one slice does the same", async () => {
  let n = 0;
  const r = await run(ARGS, env, async () => {
    n += 1;
    if (n === 2) return { ok: false, status: 502, json: async () => ({ success: false, errors: [{ message: "bad gateway for 123456789" }] }) };
    if (n === 3) throw new TypeError("fetch failed secret detail");
    return answer([event()]);
  }, NOW);
  assert.equal(n, 6);
  assert.equal(r.exit, 0);
  assert.match(r.text, /Slices of 5 minutes: 6, capped: 0, failed: 2\./);
  assert.match(r.text, /- slice 07:15 to 07:20: failed, HTTP 502, bad gateway for <n>/);
  assert.match(r.text, /- slice 07:20 to 07:25: failed, no answer \(TypeError\)/);
  assert.ok(!r.text.includes("secret"));
  assert.match(r.text, /Events read: 4\./);
});

test("when every slice fails the run exits 1; a 401 in any slice keeps the one token line and exit 0", async () => {
  const all = await run(ARGS, env, async () => ({ ok: false, status: 500, json: async () => ({ success: false, errors: [] }) }), NOW);
  assert.equal(all.exit, 1);
  assert.match(all.text, /^the query failed in every slice: HTTP 500/);
  let n = 0;
  const late = await run(ARGS, env, async () => { n += 1; return n === 3 ? { ok: false, status: 401, json: async () => ({}) } : answer([event()]); }, NOW);
  assert.equal(late.exit, 0);
  assert.equal(late.text, "the deploy token cannot read Workers Logs (needs Workers Observability read)");
});

test("an event that comes back in two slices (same id) is counted once", async () => {
  const dup = event({ $metadata: { id: "evt-1", service: "jetnine-web", level: "error", message: "boom" } });
  const r = await run(ARGS, env, async () => answer([dup]), NOW);
  assert.match(r.text, /Events read: 1\./);
  assert.match(r.text, /Slices of 5 minutes: 6, capped: 0, failed: 0\./);
});

test("the two lines the edge Worker writes survive redact() unchanged", () => {
  const lines = [
    "[edge] app 5xx where=pass status=500 code=1102 colo=LAX method=GET path=/contact",
    "[edge] app fetch threw where=miss name=Error colo=SJC method=GET path=/cost-calculator msg=Network connection lost",
  ];
  for (const l of lines) assert.equal(redact(l), l);
});
