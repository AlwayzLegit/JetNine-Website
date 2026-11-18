import assert from "node:assert/strict";
import { test } from "node:test";
import { composeAlert, formatWhen, sendAlert, alertsConfigured } from "./alert.mjs";
import { ALERT_LOG_KEPT, FAR_FUTURE_MS, SELF_TEST_EVERY_MS, checkQuietMs, handleFetch, quietUntilMs, runRound } from "./handler.mjs";
import { CANARY_PATH, CHECKS, RETRY_WAIT_MS, probeOnce, runProbes } from "./probes.mjs";
import { nextRound, REMINDER_MS } from "./round.mjs";
import { STATUS_MAX_AGE_MS, publicStatus } from "./status.mjs";

const SITE = "https://site.test";
const HEALTH_OK = JSON.stringify({ ok: true, status: "healthy" });

// A fake site: path -> [status, body]. Records every request.
function fakeSite(routes) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, method: init?.method, ua: init?.headers?.["user-agent"] });
    const r = routes[url.replace(SITE, "")] ?? [404, "not found"];
    const [status, body] = typeof r === "function" ? r() : r;
    return new Response(body, { status });
  };
  return { sent, fetchImpl };
}
const goodRoutes = () => ({
  "/api/health": [200, HEALTH_OK],
  "/": [200, "<title>JetNine</title>"],
  "/contact": [200, "<title>Contact 24/7 Private Jet Charter Support</title>"],
  "/cost-calculator": [200, "<title>Private Jet Cost Calculator</title>"],
});
const noSleep = { sleep: async () => {} };

test("a healthy site passes all five checks and the canary, with GET only and our user agent", async () => {
  const { sent, fetchImpl } = fakeSite(goodRoutes());
  const r = await runProbes(SITE, { fetchImpl, ...noSleep });
  assert.equal(r.checks.length, 5);
  assert.ok(r.checks.every((c) => c.ok && c.detail === "HTTP 200"));
  assert.equal(r.canary.ok, true);
  assert.ok(sent.every((s) => s.method === "GET" && s.ua === "jetnine-monitor/1"));
  assert.ok(sent.some((s) => s.url === `${SITE}${CANARY_PATH}`));
});

test("each check fails with a word from the fixed list", async () => {
  const { fetchImpl } = fakeSite({
    "/api/health": [200, JSON.stringify({ ok: false })],
    "/": [500, "boom <secret body>"],
    "/contact": [200, "<title>Welcome</title>"],
    "/cost-calculator": [200, "<title>Private Jet Cost Calculator</title>"],
  });
  const r = await runProbes(SITE, { fetchImpl, ...noSleep });
  const by = Object.fromEntries(r.checks.map((c) => [c.name, c.detail]));
  assert.equal(by["API health"], "unhealthy");
  assert.equal(by["Home page"], "HTTP 500");
  assert.equal(by["Contact page"], "content check failed");
  assert.equal(by["Cost calculator"], "HTTP 200");
});

test("no answer is 'no response' and carries no error text", async () => {
  const c = await probeOnce(CHECKS[0], SITE, async () => { throw new Error("secret host details"); });
  assert.deepEqual([c.ok, c.detail], [false, "no response"]);
});

test("a failed check is tried once more after 30 seconds, and the second answer counts", async () => {
  let calls = 0;
  const routes = goodRoutes();
  routes["/"] = () => (calls++ === 0 ? [503, "x"] : [200, "<title>JetNine</title>"]);
  const waits = [];
  const { fetchImpl } = fakeSite(routes);
  const r = await runProbes(SITE, { fetchImpl, sleep: async (ms) => waits.push(ms) });
  assert.equal(r.checks.find((c) => c.name === "Home page").ok, true);
  assert.deepEqual(waits, [RETRY_WAIT_MS]);
});

test("the canary is ok only when a missing page answers 404", async () => {
  const routes = goodRoutes();
  routes[CANARY_PATH] = [200, "ok"];
  const r = await runProbes(SITE, { fetchImpl: fakeSite(routes).fetchImpl, ...noSleep });
  assert.equal(r.canary.ok, false);
});

const T0 = Date.parse("2026-11-17T09:00:00Z");
const QUIET = Date.parse("2026-11-17T08:00:00Z");
const pass = { checks: [{ name: "Home page", ok: true, ms: 5, detail: "HTTP 200" }], canary: { ok: true, ms: 1 } };
const fail = { checks: [{ name: "Home page", ok: false, ms: 5, detail: "HTTP 500" }, { name: "API health", ok: true, ms: 5, detail: "HTTP 200" }], canary: { ok: true, ms: 1 } };

test("before the quiet time a failing round goes to wouldHaveRaised and raises nothing", () => {
  const { state, events } = nextRound(null, fail, QUIET - 60_000, QUIET);
  assert.deepEqual(events, []);
  assert.equal(state.open, null);
  assert.deepEqual(state.incidents, []);
  assert.deepEqual(state.wouldHaveRaised, [{ at: QUIET - 60_000, checks: ["Home page"] }]);
  assert.equal(state.ok, false);
});

test("after the quiet time: one start, a reminder after an hour, one recovery", () => {
  let r = nextRound(null, fail, T0, QUIET);
  assert.deepEqual(r.events.map((e) => e.type), ["start"]);
  r = nextRound(r.state, fail, T0 + 15 * 60_000, QUIET);
  assert.deepEqual(r.events, []);
  assert.equal(r.state.streak, 2);
  r = nextRound(r.state, fail, T0 + REMINDER_MS, QUIET);
  assert.deepEqual(r.events.map((e) => e.type), ["reminder"]);
  r = nextRound(r.state, pass, T0 + REMINDER_MS + 15 * 60_000, QUIET);
  assert.deepEqual(r.events.map((e) => e.type), ["recovery"]);
  assert.equal(r.state.open, null);
  assert.equal(r.state.incidents.length, 1);
  assert.equal(r.state.incidents[0].rounds, 3);
  assert.equal(r.state.streak, 0);
});

test("the lists keep the last 20", () => {
  let state = null;
  for (let i = 0; i < 30; i++) state = nextRound(state, fail, QUIET - 10_000_000 + i * 1000, QUIET).state;
  assert.equal(state.wouldHaveRaised.length, 20);
});

const env = (extra = {}) => ({ SITE_URL: SITE, QUIET_UNTIL: "2026-11-17T08:00:00Z", ...extra });

test("no mail call when the secrets are missing", async () => {
  const calls = [];
  const logs = [];
  const out = await sendAlert(env(), { type: "start", checks: ["Home page"] }, async (...a) => calls.push(a), (m) => logs.push(m));
  assert.deepEqual(out, { result: "skipped", code: null });
  assert.equal(calls.length, 0);
  assert.equal(alertsConfigured(env({ ALERT_EMAIL: "a@b.test" })), false);
  assert.ok(!logs.join().includes("@"));
});

test("with Resend set one email goes out with the check names only", async () => {
  const calls = [];
  const out = await sendAlert(
    env({ ALERT_EMAIL: "ops@x.test", RESEND_API_KEY: "k" }),
    { type: "start", checks: ["Home page"] },
    async (url, init) => { calls.push({ url, init }); return new Response("{}", { status: 200 }); },
  );
  assert.deepEqual(out, { result: "sent", code: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.match(JSON.parse(calls[0].init.body).subject, /DOWN/);
  assert.match(composeAlert({ type: "recovery", checks: ["Home page"] }, SITE).subject, /recovered/);
});

test("a provider failure is reported as failed without the key or address in the log", async () => {
  const logs = [];
  const out = await sendAlert(env({ ALERT_EMAIL: "ops@x.test", POSTMARK_SERVER_TOKEN: "tok" }), { type: "start", checks: [] }, async () => new Response("no", { status: 500 }), (m) => logs.push(m));
  assert.deepEqual(out, { result: "failed", code: 500 });
  assert.ok(!logs.join().includes("tok") && !logs.join().includes("ops@x.test"));
});

// A fake Durable Object namespace.
function fakeEnv(extra = {}) {
  let stored = null;
  const obj = { get: async () => stored, put: async (s) => { stored = s; } };
  return { ...env(extra), MONITOR_STATE: { idFromName: () => "id", get: () => obj }, peek: () => stored };
}

test("a round stores its state and a failing round after the quiet time sends one email", async () => {
  const e = fakeEnv({ ALERT_EMAIL: "ops@x.test", RESEND_API_KEY: "k" });
  const mail = [];
  const routes = goodRoutes();
  routes["/api/health"] = [503, "{}"];
  const state = await runRound(e, {
    now: T0,
    probe: { fetchImpl: fakeSite(routes).fetchImpl, ...noSleep },
    fetchImpl: async (u) => { mail.push(u); return new Response("{}"); },
    log: () => {},
  });
  assert.equal(state.ok, false);
  assert.deepEqual(mail, ["https://api.resend.com/emails"]);
  assert.equal(e.peek().open.checks[0], "API health");
});

test("/status holds only the fixed fields, never a body, and a missing or stale round is 503", async () => {
  const e = fakeEnv();
  let res = await handleFetch(new Request(`${SITE}/status`), e, T0);
  assert.equal(res.status, 503);
  await runRound(e, { now: T0, probe: { fetchImpl: fakeSite(goodRoutes()).fetchImpl, ...noSleep }, log: () => {} });
  res = await handleFetch(new Request(`${SITE}/status`), e, T0 + 60_000);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["alerts", "alerts_log", "canary", "checkedAt", "checks", "failingSince", "incidents", "ok", "quietUntil", "streak", "v", "wouldHaveRaised"]);
  assert.equal(body.v, 1);
  assert.equal(body.ok, true);
  assert.equal(body.alerts, "not configured");
  assert.equal(body.quietUntil, "2026-11-17T08:00:00.000Z");
  assert.deepEqual(Object.keys(body.checks[0]).sort(), ["detail", "ms", "name", "ok"]);
  res = await handleFetch(new Request(`${SITE}/status`), e, T0 + STATUS_MAX_AGE_MS + 1);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).ok, false);
});

test("a stored detail outside the fixed words is cut, and an extra stored field is dropped", () => {
  const a = publicStatus(
    { checkedAt: T0, ok: false, secret: "x", checks: [{ name: "n", ok: false, ms: 1, detail: "<html>private</html>", body: "private" }] },
    T0,
    { alertsConfigured: true, quietUntilMs: QUIET },
  );
  assert.equal(a.body.checks[0].detail, "content check failed");
  assert.ok(!JSON.stringify(a.body).includes("private"));
  assert.ok(!("secret" in a.body));
  assert.equal(a.body.alerts, "configured");
});

test("everything but GET /status is 404, and a broken QUIET_UNTIL stays quiet", async () => {
  const e = fakeEnv();
  assert.equal((await handleFetch(new Request(`${SITE}/`), e)).status, 404);
  assert.equal((await handleFetch(new Request(`${SITE}/status`, { method: "POST" }), e)).status, 404);
  // The sentinel must be a date that can be shown (it was Number.MAX_SAFE_INTEGER, which made /status throw).
  assert.equal(quietUntilMs({ QUIET_UNTIL: "garbage" }), FAR_FUTURE_MS);
  assert.doesNotThrow(() => new Date(FAR_FUTURE_MS).toISOString());
});

// OPS-60 review: GET /status never throws, whatever QUIET_UNTIL holds.
for (const [label, value] of [["missing", undefined], ["empty", ""], ["not a date", "garbage"], ["out of range", "+999999-01-01T00:00:00Z"]]) {
  test(`GET /status answers 200 JSON with QUIET_UNTIL ${label}, and the monitor stays quiet`, async () => {
    const e = fakeEnv({ ALERT_EMAIL: "ops@x.test", RESEND_API_KEY: "k" });
    if (value === undefined) delete e.QUIET_UNTIL;
    else e.QUIET_UNTIL = value;
    const mail = [];
    const routes = goodRoutes();
    routes["/api/health"] = [503, "{}"];
    await runRound(e, {
      now: T0,
      probe: { fetchImpl: fakeSite(routes).fetchImpl, ...noSleep },
      fetchImpl: async (u) => { mail.push(u); return new Response("{}"); },
      log: () => {},
    });
    assert.deepEqual(mail, [], "quiet: no email");
    assert.equal(e.peek().wouldHaveRaised.length, 1, "the failed round is recorded as wouldHaveRaised");
    const res = await handleFetch(new Request(`${SITE}/status`), e, T0 + 60_000);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.v, 1);
    assert.equal(body.wouldHaveRaised.length, 1);
    assert.ok(body.quietUntil === null || typeof body.quietUntil === "string");
  });
}

test("GET /status answers 503 JSON, not an error, for a stale round with QUIET_UNTIL missing", async () => {
  const e = fakeEnv();
  delete e.QUIET_UNTIL;
  await runRound(e, { now: T0, probe: { fetchImpl: fakeSite(goodRoutes()).fetchImpl, ...noSleep }, log: () => {} });
  const res = await handleFetch(new Request(`${SITE}/status`), e, T0 + STATUS_MAX_AGE_MS + 1);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).ok, false);
});

test("publicStatus shows a quiet time it cannot represent as null instead of throwing", () => {
  for (const bad of [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 8_640_000_000_000_001]) {
    const a = publicStatus({ checkedAt: T0, ok: true }, T0, { alertsConfigured: false, quietUntilMs: bad });
    assert.equal(a.body.quietUntil, null);
  }
  const edge = publicStatus({ checkedAt: T0, ok: true }, T0, { alertsConfigured: false, quietUntilMs: FAR_FUTURE_MS });
  assert.equal(edge.body.quietUntil, "+275760-09-13T00:00:00.000Z");
});

// OPS-90, OPS-121: the "Sign-in service" check reads /api/health's `failing` list (the name "signin") and has its own quiet date.
const signin = (body) => {
  const c = CHECKS.find((x) => x.name === "Sign-in service");
  return c.ok(body);
};

test("Sign-in service fails when failing lists signin, passes when it does not, and fails on bad JSON", () => {
  assert.equal(signin(JSON.stringify({ ok: true, status: "degraded", failing: ["signin"] })), false);
  assert.equal(signin(JSON.stringify({ ok: true, status: "degraded", failing: ["stripe", "signin"] })), false);
  // The old name no longer exists in /api/health (OPS-121), so it alone is not a sign-in failure.
  assert.equal(signin(JSON.stringify({ ok: true, status: "degraded", failing: ["auth"] })), true);
  assert.equal(signin(JSON.stringify({ ok: true, status: "healthy", failing: [] })), true);
  assert.equal(signin(JSON.stringify({ ok: true, status: "healthy" })), true);
  assert.equal(signin("<html>not json</html>"), false);
});

test("a site whose health says failing signin fails only Sign-in service, with a fixed word", async () => {
  const routes = goodRoutes();
  routes["/api/health"] = [200, JSON.stringify({ ok: true, status: "degraded", failing: ["signin"] })];
  const r = await runProbes(SITE, { fetchImpl: fakeSite(routes).fetchImpl, ...noSleep });
  const by = Object.fromEntries(r.checks.map((c) => [c.name, [c.ok, c.detail]]));
  assert.deepEqual(by["Sign-in service"], [false, "unhealthy"]);
  assert.deepEqual(by["API health"], [true, "HTTP 200"]);
});

const signInFail = {
  checks: [
    { name: "API health", ok: true, ms: 5, detail: "HTTP 200" },
    { name: "Sign-in service", ok: false, ms: 5, detail: "unhealthy" },
  ],
  canary: { ok: true, ms: 1 },
};
const SIGNIN_QUIET = Date.parse("2026-11-20T08:00:00Z");

test("inside its own quiet date Sign-in service is only recorded: no incident, no event, round stays ok", () => {
  const r = nextRound(null, signInFail, T0, QUIET, { "Sign-in service": SIGNIN_QUIET });
  assert.deepEqual(r.events, []);
  assert.equal(r.state.open, null);
  assert.equal(r.state.ok, true);
  assert.equal(r.state.streak, 0);
  assert.deepEqual(r.state.wouldHaveRaised, [{ at: T0, checks: ["Sign-in service"] }]);
});

test("after its own quiet date Sign-in service raises like any check", () => {
  const r = nextRound(null, signInFail, SIGNIN_QUIET + 1000, QUIET, { "Sign-in service": SIGNIN_QUIET });
  assert.deepEqual(r.events.map((e) => [e.type, e.checks]), [["start", ["Sign-in service"]]]);
  assert.equal(r.state.ok, false);
  assert.deepEqual(r.state.wouldHaveRaised, []);
});

test("another check failing in the same round still raises while Sign-in service is quiet", () => {
  const both = {
    checks: [
      { name: "Home page", ok: false, ms: 5, detail: "HTTP 500" },
      { name: "Sign-in service", ok: false, ms: 5, detail: "unhealthy" },
    ],
    canary: { ok: true, ms: 1 },
  };
  const r = nextRound(null, both, T0, QUIET, { "Sign-in service": SIGNIN_QUIET });
  assert.deepEqual(r.events.map((e) => [e.type, e.checks]), [["start", ["Home page"]]]);
  assert.deepEqual(r.state.wouldHaveRaised, [{ at: T0, checks: ["Sign-in service"] }]);
});

test("checkQuietMs reads SIGNIN_QUIET_UNTIL, and a missing or broken one stays quiet", () => {
  assert.equal(checkQuietMs({ SIGNIN_QUIET_UNTIL: "2026-11-20T08:00:00Z" })["Sign-in service"], SIGNIN_QUIET);
  assert.equal(checkQuietMs({})["Sign-in service"], FAR_FUTURE_MS);
  assert.equal(checkQuietMs({ SIGNIN_QUIET_UNTIL: "garbage" })["Sign-in service"], FAR_FUTURE_MS);
  assert.deepEqual(Object.keys(checkQuietMs({})), ["Sign-in service"]);
});

test("a full round with signin failing sends no email before SIGNIN_QUIET_UNTIL and records it", async () => {
  const e = fakeEnv({ ALERT_EMAIL: "ops@x.test", RESEND_API_KEY: "k", SIGNIN_QUIET_UNTIL: "2026-11-20T08:00:00Z" });
  const mail = [];
  const routes = goodRoutes();
  routes["/api/health"] = [200, JSON.stringify({ ok: true, status: "degraded", failing: ["signin"] })];
  const state = await runRound(e, {
    now: T0,
    probe: { fetchImpl: fakeSite(routes).fetchImpl, ...noSleep },
    fetchImpl: async (u, init) => { mail.push(JSON.parse(init.body).subject); return new Response("{}"); },
    log: () => {},
  });
  // No failure mail (DOWN, reminder, recovery) goes out. Since OPS-169 the first passing round
  // after the quiet date sends the weekly test mail of the alert path, and only that.
  assert.deepEqual(mail, ["[JetNine monitor] test: alerts reach you"]);
  assert.deepEqual(state.alertLog.map((a) => a.type), ["test"]);
  assert.equal(state.ok, true);
  assert.deepEqual(state.wouldHaveRaised.map((w) => w.checks), [["Sign-in service"]]);
});

// ---- OPS-169: the alert log, the weekly test mail, the times in every mail ----

const mailEnv = (extra = {}) => fakeEnv({ ALERT_EMAIL: "ops@x.test", RESEND_API_KEY: "k", ...extra });
const okMail = (sent) => async (u, init) => { sent.push({ u, body: JSON.parse(init.body) }); return new Response("{}", { status: 200 }); };
const probeOf = (routes) => ({ fetchImpl: fakeSite(routes).fetchImpl, ...noSleep });
const downRoutes = () => ({ ...goodRoutes(), "/api/health": [503, "{}"] });

test("every send is recorded in the alert log with its type, result and the provider's code, and nothing else", async () => {
  const e = mailEnv();
  const sent = [];
  // A failing round sends one DOWN mail (the weekly test is not sent on top of a real alert).
  await runRound(e, { now: T0, probe: probeOf(downRoutes()), fetchImpl: okMail(sent), log: () => {} });
  assert.equal(sent.length, 1);
  assert.deepEqual(e.peek().alertLog, [{ at: T0, type: "start", result: "sent", code: 200 }]);
  // The next passing round sends the recovery mail; the log keeps the earlier entry.
  await runRound(e, { now: T0 + 15 * 60_000, probe: probeOf(goodRoutes()), fetchImpl: okMail(sent), log: () => {} });
  assert.deepEqual(e.peek().alertLog.map((a) => [a.type, a.result, a.code]), [["start", "sent", 200], ["recovery", "sent", 200]]);
  const stored = JSON.stringify(e.peek().alertLog);
  for (const forbidden of ["ops@x.test", "subject", "DOWN", "k"]) assert.ok(!stored.includes(`"${forbidden}"`) && !stored.includes(forbidden === "k" ? "Bearer" : forbidden));
});

test("a provider that refuses is recorded as failed with its code, and a missing key as skipped", async () => {
  const e = mailEnv();
  await runRound(e, { now: T0, probe: probeOf(downRoutes()), fetchImpl: async () => new Response("no", { status: 422 }), log: () => {} });
  assert.deepEqual(e.peek().alertLog, [{ at: T0, type: "start", result: "failed", code: 422 }]);
  const e2 = fakeEnv();
  await runRound(e2, { now: T0, probe: probeOf(downRoutes()), fetchImpl: async () => { throw new Error("no call"); }, log: () => {} });
  assert.deepEqual(e2.peek().alertLog, [{ at: T0, type: "start", result: "skipped", code: null }]);
});

test("the alert log keeps the last 20 sends", async () => {
  const e = mailEnv();
  const fetchImpl = okMail([]);
  // Alternate down and up: every round sends one mail.
  for (let i = 0; i < 25; i++) {
    await runRound(e, { now: T0 + i * 15 * 60_000, probe: probeOf(i % 2 === 0 ? downRoutes() : goodRoutes()), fetchImpl, log: () => {} });
  }
  assert.equal(e.peek().alertLog.length, ALERT_LOG_KEPT);
  assert.equal(e.peek().alertLog.at(-1).type, "start");
});

test("the weekly test mail: one on the first passing round after quiet, then one a week later, never before quiet", async () => {
  const e = mailEnv();
  const sent = [];
  const run = (now) => runRound(e, { now, probe: probeOf(goodRoutes()), fetchImpl: okMail(sent), log: () => {} });
  // Before the quiet date nothing is sent, not even the test.
  await run(QUIET - 60_000);
  assert.equal(sent.length, 0);
  assert.equal(e.peek().selfTest, null);
  // The first round after it sends one test mail and records it.
  await run(T0);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.subject, /test: alerts reach you/);
  assert.equal(e.peek().selfTest, T0);
  assert.deepEqual(e.peek().alertLog, [{ at: T0, type: "test", result: "sent", code: 200 }]);
  // Not again within the week, then once more after it.
  await run(T0 + SELF_TEST_EVERY_MS - 60_000);
  assert.equal(sent.length, 1);
  await run(T0 + SELF_TEST_EVERY_MS);
  assert.equal(sent.length, 2);
  assert.equal(e.peek().selfTest, T0 + SELF_TEST_EVERY_MS);
});

test("no test mail without mail secrets, and none on a failing round", async () => {
  const none = fakeEnv();
  await runRound(none, { now: T0, probe: probeOf(goodRoutes()), fetchImpl: async () => { throw new Error("no call"); }, log: () => {} });
  assert.deepEqual(none.peek().alertLog, []);
  assert.equal(none.peek().selfTest, null);
  const e = mailEnv();
  const sent = [];
  await runRound(e, { now: T0, probe: probeOf(downRoutes()), fetchImpl: okMail(sent), log: () => {} });
  assert.deepEqual(sent.map((m) => m.body.subject.includes("DOWN")), [true]);
  assert.equal(e.peek().selfTest, null);
});

test("a test mail whose send failed is still recorded and not retried for a week", async () => {
  const e = mailEnv();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response("no", { status: 401 }); };
  await runRound(e, { now: T0, probe: probeOf(goodRoutes()), fetchImpl, log: () => {} });
  await runRound(e, { now: T0 + 15 * 60_000, probe: probeOf(goodRoutes()), fetchImpl, log: () => {} });
  assert.equal(calls, 1);
  assert.deepEqual(e.peek().alertLog, [{ at: T0, type: "test", result: "failed", code: 401 }]);
});

test("a round keeps the log and the test time the previous rounds wrote", async () => {
  const e = mailEnv();
  await runRound(e, { now: T0, probe: probeOf(goodRoutes()), fetchImpl: okMail([]), log: () => {} });
  await runRound(e, { now: T0 + 15 * 60_000, probe: probeOf(goodRoutes()), fetchImpl: okMail([]), log: () => {} });
  assert.equal(e.peek().selfTest, T0);
  assert.equal(e.peek().alertLog.length, 1);
});

test("every mail names the time, in UTC and in Pacific time", () => {
  const from = Date.UTC(2026, 10, 18, 7, 22, 45); // 11:22 PM PST on 17 Nov
  const to = Date.UTC(2026, 10, 18, 7, 37, 46);
  assert.equal(formatWhen(from), "2026-11-18 07:22 UTC (Nov 17, 2026, 11:22 PM PST)");
  assert.equal(formatWhen(Date.UTC(2026, 6, 1, 19, 0, 0)), "2026-07-01 19:00 UTC (Jul 1, 2026, 12:00 PM PDT)");
  assert.equal(formatWhen(undefined), "an unknown time");
  const down = composeAlert({ type: "start", checks: ["Home page", "Contact page"], from }, SITE);
  assert.match(down.text, /Home page, Contact page/);
  assert.match(down.text, /Failing since 2026-11-18 07:22 UTC \(Nov 17, 2026, 11:22 PM PST\)/);
  assert.match(composeAlert({ type: "reminder", checks: ["Home page"], from }, SITE).text, /Still failing since 2026-11-18 07:22 UTC/);
  const back = composeAlert({ type: "recovery", checks: ["Home page"], from, to }, SITE);
  assert.match(back.text, /Down from 2026-11-18 07:22 UTC .* to 2026-11-18 07:37 UTC \(Nov 17, 2026, 11:37 PM PST\)/);
  const test = composeAlert({ type: "test", at: from }, SITE);
  assert.match(test.subject, /test: alerts reach you/);
  assert.match(test.text, /Nothing is wrong/);
});

test("/status shows the alert log from a fixed list of fields and never an address or a subject", () => {
  const a = publicStatus(
    {
      checkedAt: T0,
      ok: true,
      alertLog: [
        { at: T0, type: "test", result: "sent", code: 200, to: "ops@x.test", subject: "secret subject" },
        { at: T0, type: "start", result: "failed", code: 422 },
        { at: T0, type: "weird", result: "sent", code: 200 },
        { at: T0, type: "start", result: "maybe", code: 200 },
        { at: T0, type: "recovery", result: "skipped", code: "200" },
        null,
      ],
    },
    T0,
    { alertsConfigured: true, quietUntilMs: QUIET },
  );
  assert.deepEqual(a.body.alerts_log, [
    { at: new Date(T0).toISOString(), type: "test", result: "sent", code: 200 },
    { at: new Date(T0).toISOString(), type: "start", result: "failed", code: 422 },
    { at: new Date(T0).toISOString(), type: "recovery", result: "skipped", code: null },
  ]);
  assert.ok(!JSON.stringify(a.body).includes("ops@x.test") && !JSON.stringify(a.body).includes("secret subject"));
  assert.deepEqual(publicStatus(null, T0, { alertsConfigured: false, quietUntilMs: QUIET }).body.alerts_log, []);
});
