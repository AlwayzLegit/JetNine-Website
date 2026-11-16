import test from "node:test";
import assert from "node:assert/strict";
import { probeSupabaseAuth } from "./auth-probe.mjs";

const URL_ = "https://abc.supabase.co";
const KEY = "anon-key-that-must-never-appear-in-an-answer";
const answer = (status, body = "{}") => async () => new Response(body, { status });

test("a 200 is ok and configured", async () => {
  const r = await probeSupabaseAuth({ url: URL_, anonKey: KEY, fetchImpl: answer(200) });
  assert.deepEqual(r, { ok: true, configured: true, httpStatus: 200, detail: "HTTP 200" });
});

test("a 402 (project restricted) is not ok and says so", async () => {
  const r = await probeSupabaseAuth({ url: URL_, anonKey: KEY, fetchImpl: answer(402, "quota exceeded") });
  assert.deepEqual(r, { ok: false, configured: true, httpStatus: 402, detail: "HTTP 402" });
});

test("a 500 is not ok", async () => {
  const r = await probeSupabaseAuth({ url: URL_, anonKey: KEY, fetchImpl: answer(500) });
  assert.equal(r.ok, false);
  assert.equal(r.httpStatus, 500);
});

test("a thrown fetch is 'no response' and carries no error text", async () => {
  const r = await probeSupabaseAuth({
    url: URL_,
    anonKey: KEY,
    fetchImpl: async () => {
      throw new Error("secret host details");
    },
  });
  assert.deepEqual(r, { ok: false, configured: true, httpStatus: null, detail: "no response" });
});

test("a request that outlasts the timeout is 'no response'", async () => {
  // AbortSignal.timeout does not keep the process alive, so this holds it open.
  const hold = setTimeout(() => {}, 2000);
  const slow = (_url, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  const r = await probeSupabaseAuth({ url: URL_, anonKey: KEY, fetchImpl: slow, timeoutMs: 20 });
  clearTimeout(hold);
  assert.equal(r.ok, false);
  assert.equal(r.detail, "no response");
});

test("no url or no key is ok and not configured, and nothing is sent", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return new Response("{}", { status: 200 });
  };
  for (const opts of [{}, { url: URL_ }, { anonKey: KEY }, { url: "not a url", anonKey: KEY }]) {
    const r = await probeSupabaseAuth({ ...opts, fetchImpl });
    assert.deepEqual(r, { ok: true, configured: false, httpStatus: null, detail: "not configured" });
  }
  assert.equal(calls, 0);
});

test("it asks GET /auth/v1/health with the anon key as apikey, and the key never appears in any answer", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, method: init.method, apikey: init.headers.apikey };
    return new Response("{}", { status: 402 });
  };
  const r = await probeSupabaseAuth({ url: URL_, anonKey: KEY, fetchImpl });
  assert.deepEqual(seen, { url: `${URL_}/auth/v1/health`, method: "GET", apikey: KEY });
  assert.equal(JSON.stringify(r).includes(KEY), false);
});
