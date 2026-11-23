/* eslint-disable no-console */
// Run with: pnpm exec tsx --test scripts/smoke-fetch.test.mts  (also covers scripts/smoke-media.mts)
import assert from "node:assert/strict";
import { test } from "node:test";
import { createReader, TransportError } from "./smoke-fetch.mjs";
import { classifyHero, extractHeroPaths, heroReport, type HeroResult } from "./smoke-media.mjs";

const ok = (body = "ok", headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });

function reader(responses: Array<Response | Error>) {
  const calls: string[] = [];
  const retries: Array<{ url: string; message: string }> = [];
  const r = createReader({
    timeoutMs: 1000,
    retryDelayMs: 0,
    sleep: async () => {},
    onRetry: (url, err) => retries.push({ url, message: err.message }),
    fetchImpl: (async (url: string) => {
      calls.push(String(url));
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next as Response;
    }) as typeof fetch,
  });
  return { r, calls, retries };
}

const fetchFailed = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_SOCKET", message: "other side closed" } });

test("a transport error is retried once and reported with its cause", async () => {
  const { r, calls, retries } = reader([fetchFailed(), ok("second")]);
  const res = await r.read("https://example.test/account");
  assert.equal(res.text, "second");
  assert.equal(calls.length, 2);
  assert.equal(retries.length, 1);
  assert.match(retries[0].message, /UND_ERR_SOCKET/);
  assert.match(retries[0].message, /other side closed/);
  assert.equal(retries[0].url, "https://example.test/account");
});

test("a read that fails twice fails", async () => {
  const { r, calls } = reader([fetchFailed(), fetchFailed()]);
  await assert.rejects(r.read("https://example.test/"), (e: unknown) => e instanceof TransportError);
  assert.equal(calls.length, 2);
});

test("a wrong status is returned at once, never retried", async () => {
  const { r, calls, retries } = reader([new Response("boom", { status: 500 }), ok()]);
  const res = await r.read("https://example.test/");
  assert.equal(res.status, 500);
  assert.equal(calls.length, 1);
  assert.equal(retries.length, 0);
});

test("a body cut off mid-stream is a transport error and is retried", async () => {
  const broken = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("par"));
        c.error(new Error("terminated"));
      },
    }),
    { status: 200 },
  );
  const { r, calls, retries } = reader([broken, ok("whole")]);
  const res = await r.read("https://example.test/page");
  assert.equal(res.text, "whole");
  assert.equal(calls.length, 2);
  assert.match(retries[0].message, /body failed/);
});

test("a POST is never retried", async () => {
  const { r, calls, retries } = reader([fetchFailed(), ok()]);
  await assert.rejects(r.read("https://example.test/api", { method: "POST" }));
  assert.equal(calls.length, 1);
  assert.equal(retries.length, 0);
});

test("the cf-ray and cache state of the latest response are named", async () => {
  const { r } = reader([ok("x", { "cf-ray": "8abc-LAX", "x-edge-cache": "MISS" })]);
  await r.read("https://example.test/");
  assert.equal(r.servedNote(), " [cf-ray 8abc-LAX, edge-cache MISS]");
  r.resetServed();
  assert.equal(r.servedNote(), "");
});

test("a timeout is a transport error that says so", async () => {
  const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  const { r, retries } = reader([abort, ok()]);
  await r.read("https://example.test/slow");
  assert.match(retries[0].message, /timeout after 1000ms/);
});

// OPS-289: the blog hero count of the deploy smoke test (scripts/smoke-media.mts). Kept in this file
// because CI already runs it; a new test file would need a change to ci.yml.
test("hero paths are collected once each, in order, and only from /media/blog/heroes", () => {
  const html = `<img src="/media/blog/heroes/a-1.webp"><img src="/media/blog/heroes/b_2.webp">
    <img src="/media/blog/heroes/a-1.webp"><img src="/images/blog/library/cabin-interior.webp">
    <img src="/media/blog/heroes/not-webp.png"><img src="/media/other/x.webp">`;
  assert.deepEqual(extractHeroPaths(html), ["/media/blog/heroes/a-1.webp", "/media/blog/heroes/b_2.webp"]);
  assert.deepEqual(extractHeroPaths("<p>no images</p>"), []);
});

test("a stand-in header wins over a 200 image answer", () => {
  assert.equal(classifyHero(200, new Headers({ "content-type": "image/webp" })), "real");
  assert.equal(classifyHero(200, new Headers({ "content-type": "image/webp", "x-media-stand-in": "cabin-interior" })), "stand-in");
});

test("anything that is not a 200 image is failed", () => {
  assert.equal(classifyHero(404, new Headers({ "content-type": "text/plain" })), "failed");
  assert.equal(classifyHero(200, new Headers({ "content-type": "text/html" })), "failed");
  assert.equal(classifyHero(500, new Headers({ "content-type": "image/webp" })), "failed");
});

test("the report prints the exact summary line and is ok only when nothing is stand-in or failed", () => {
  const real: HeroResult[] = [
    { path: "/media/blog/heroes/a.webp", verdict: "real", status: 200 },
    { path: "/media/blog/heroes/b.webp", verdict: "real", status: 200 },
  ];
  assert.deepEqual(heroReport(real), { lines: ["media heroes: 2 named, 2 real, 0 stand-in, 0 failed"], ok: true });
  const mixed: HeroResult[] = [
    ...real,
    { path: "/media/blog/heroes/c.webp", verdict: "stand-in", status: 200 },
    { path: "/media/blog/heroes/d.webp", verdict: "failed", status: 404 },
  ];
  const r = heroReport(mixed);
  assert.equal(r.ok, false);
  assert.deepEqual(r.lines, [
    "media heroes: 4 named, 2 real, 1 stand-in, 1 failed",
    "media stand-in: /media/blog/heroes/c.webp",
    "media failed: /media/blog/heroes/d.webp 404",
  ]);
});

test("the list of paths is cut at 10 lines", () => {
  const many: HeroResult[] = Array.from({ length: 25 }, (_, i) => ({ path: `/media/blog/heroes/${i}.webp`, verdict: "stand-in" as const, status: 200 }));
  const r = heroReport(many);
  assert.equal(r.lines.length, 11);
  assert.equal(r.lines[0], "media heroes: 25 named, 0 real, 25 stand-in, 0 failed");
});

test("a page with no heroes still prints the summary line", () => {
  assert.deepEqual(heroReport([]), { lines: ["media heroes: 0 named, 0 real, 0 stand-in, 0 failed"], ok: true });
});
