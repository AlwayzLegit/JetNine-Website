import assert from "node:assert/strict";
import { test } from "node:test";
import { composeAlert, sendAlert, alertsConfigured } from "./alert.mjs";
import { handleFetch, quietUntilMs, runRound } from "./handler.mjs";
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

test("a healthy site passes all four checks and the canary, with GET only and our user agent", async () => {
  const { sent, fetchImpl } = fakeSite(goodRoutes());
  const r = await runProbes(SITE, { fetchImpl, ...noSleep });
  assert.equal(r.checks.length, 4);
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
  assert.equal(out, "skipped");
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
  assert.equal(out, "sent");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.match(JSON.parse(calls[0].init.body).subject, /DOWN/);
  assert.match(composeAlert({ type: "recovery", checks: ["Home page"] }, SITE).subject, /recovered/);
});

test("a provider failure is reported as failed without the key or address in the log", async () => {
  const logs = [];
  const out = await sendAlert(env({ ALERT_EMAIL: "ops@x.test", POSTMARK_SERVER_TOKEN: "tok" }), { type: "start", checks: [] }, async () => new Response("no", { status: 500 }), (m) => logs.push(m));
  assert.equal(out, "failed");
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
  assert.deepEqual(Object.keys(body).sort(), ["alerts", "canary", "checkedAt", "checks", "failingSince", "incidents", "ok", "quietUntil", "streak", "v", "wouldHaveRaised"]);
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
  assert.equal(quietUntilMs({ QUIET_UNTIL: "garbage" }), Number.MAX_SAFE_INTEGER);
});
