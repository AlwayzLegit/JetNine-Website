// Run with: node --test scripts/deploy-warm/
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PATHS, warm } from "./warm.mjs";

// A fake clock: sleeping moves it forward and nothing else does (pages read in parallel, so
// the clock runs faster than real time while several pages are still being read).
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}
const res = (status, body = "<html></html>") => ({ status, text: async () => body });
const healthy = () => res(200, JSON.stringify({ ok: true, status: "healthy", env: "production", failing: [], timestamp: "x" }));

// answers[path] is a list of answers used in order; the last one repeats.
function fakeFetch(answers, seen = []) {
  const idx = {};
  return async (url, init) => {
    const path = new URL(url).pathname;
    seen.push({ path, init });
    const list = answers[path] ?? [() => res(200)];
    const i = Math.min(idx[path] ?? 0, list.length - 1);
    idx[path] = (idx[path] ?? 0) + 1;
    const a = list[i];
    if (a instanceof Error) throw a;
    return a();
  };
}
const allGood = () => ({ "/": [() => res(200)], "/contact": [() => res(200)], "/cost-calculator": [() => res(200)], "/api/health": [healthy] });

test("all four pages answering 200 pass after three reads each, with one line per page", async () => {
  const seen = [];
  const r = await warm("https://staging.jetnine.com/", { ...clock(), fetchImpl: fakeFetch(allGood(), seen) });
  assert.equal(r.ok, true);
  assert.equal(r.lines.length, 4);
  assert.match(r.lines[0], /^warm: \/ 200 x3 after 3 tries \(\d+\.\d s\)$/);
  assert.match(r.lines[3], /^warm: \/api\/health 200 x3 after 3 tries/);
  assert.deepEqual(DEFAULT_PATHS, ["/", "/contact", "/cost-calculator", "/api/health"]);
  assert.equal(seen.length, 12);
  assert.equal(seen[0].init.headers["cache-control"], "no-cache");
  assert.equal(seen[0].init.method, "GET");
  assert.equal(seen[0].init.redirect, "manual");
  assert.ok(seen.every((s) => s.path !== undefined));
});

test("a 500 in the middle resets the run: three answers in a row are needed again", async () => {
  const answers = allGood();
  answers["/contact"] = [() => res(200), () => res(200), () => res(500), () => res(200), () => res(200), () => res(200)];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, true);
  assert.match(r.lines[1], /^warm: \/contact 200 x3 after 6 tries/);
});

test("it passes after a start of 500s, and the line says how many tries it took", async () => {
  const answers = allGood();
  answers["/"] = [() => res(500), () => res(502), () => res(200)];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, true);
  assert.match(r.lines[0], /^warm: \/ 200 x3 after 5 tries/);
});

test("a page that never answers 200 fails at the limit and names the page and its last status", async () => {
  const answers = allGood();
  answers["/contact"] = [() => res(500)];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, false);
  assert.match(r.lines[1], /^WARM FAIL: \/contact last status 500 after \d+ tries$/);
  // 180 s limit, a read every 5 s: it stops before the limit, not after.
  const tries = Number(/after (\d+) tries/.exec(r.lines[1])[1]);
  assert.ok(tries >= 30 && tries <= 37, `tries ${tries}`);
  // The other pages still pass; only the failing page fails the gate.
  assert.match(r.lines[0], /^warm: \//);
});

test("a /api/health that answers 200 with ok false counts as a failure", async () => {
  const answers = allGood();
  answers["/api/health"] = [() => res(200, JSON.stringify({ ok: false, failing: ["db"] }))];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, false);
  assert.match(r.lines[3], /^WARM FAIL: \/api\/health last status 200 ok:false after/);
});

test("a /api/health body that is not JSON counts as a failure", async () => {
  const answers = allGood();
  answers["/api/health"] = [() => res(200, "<html>Error</html>")];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, false);
  assert.match(r.lines[3], /last status 200 body not JSON/);
});

test("a thrown error or a cut-off body is a failed read, named by its type and code, never by its message", async () => {
  const cause = Object.assign(new Error("secret host detail"), { code: "UND_ERR_SOCKET" });
  const answers = allGood();
  answers["/cost-calculator"] = [new TypeError("fetch failed secret-message", { cause })];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, false);
  assert.match(r.lines[2], /last status TypeError\/UND_ERR_SOCKET after/);
  assert.ok(!r.lines.join("\n").includes("secret"));
  const cut = allGood();
  cut["/"] = [() => ({ status: 200, text: async () => { throw Object.assign(new Error("terminated"), { name: "TypeError" }); } })];
  const r2 = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(cut) });
  assert.equal(r2.ok, false);
  assert.match(r2.lines[0], /last status TypeError after/);
});

test("a redirect is not followed and does not count as 200", async () => {
  const answers = allGood();
  answers["/contact"] = [() => res(301)];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  assert.equal(r.ok, false);
  assert.match(r.lines[1], /last status 301 after/);
});

test("the output never carries a header, a body or a cookie", async () => {
  const answers = allGood();
  answers["/"] = [() => ({ status: 500, headers: { "set-cookie": "session=SECRET" }, text: async () => "SECRET-BODY" })];
  const r = await warm("https://jetnine.com", { ...clock(), fetchImpl: fakeFetch(answers) });
  const out = r.lines.join("\n");
  for (const forbidden of ["SECRET", "cookie", "session"]) assert.ok(!out.includes(forbidden), `output must not contain ${forbidden}`);
});
