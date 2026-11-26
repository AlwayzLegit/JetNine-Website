// Run with: pnpm exec tsx --test edge/worker.test.ts
//
// OPS-195: the edge Worker writes ONE log line when the app throws or answers 5xx, and changes
// nothing else. These tests run the real default export with a fake APP binding and, for the
// cached paths, a fake edge cache.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker";

// The report script's redaction: the edge lines must pass through it unchanged. Loaded on demand
// because that script is an ES module with a top-level await, which this file's CommonJS
// transform cannot import statically.
async function loadRedact(): Promise<(message: string) => string> {
  const mod = (await import("../scripts/worker-errors/query.mjs")) as { redact: (message: string) => string };
  return mod.redact;
}

type Fetcher = { fetch(request: Request): Promise<Response> };

// OPS-332: a fake R2 bucket. `objects` can be shared between two setups to stand for two data
// centres that have different caches but one shared tier.
type Objects = Map<string, ArrayBuffer>;
function fakeBucket(objects: Objects, counts: { gets: string[]; puts: string[] }, failGet = false) {
  return {
    get: async (key: string) => {
      counts.gets.push(key);
      if (failGet) throw new Error("r2 down");
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { body: new Response(bytes).body as ReadableStream, httpEtag: '"e"', arrayBuffer: async () => bytes.slice(0) };
    },
    put: async (key: string, value: ArrayBuffer) => {
      counts.puts.push(key);
      objects.set(key, value);
    },
  };
}

function setup(
  app: (request: Request) => Promise<Response> | Response,
  opts: { cache?: boolean; tier?: Objects; tierVar?: string; version?: string; failTierGet?: boolean } = {},
) {
  const lines: string[] = [];
  const pending: Promise<unknown>[] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  const store = new Map<string, Response>();
  const g = globalThis as { caches?: unknown };
  const hadCaches = "caches" in g;
  const before = g.caches;
  if (opts.cache) {
    g.caches = {
      default: {
        match: async (k: string) => store.get(k)?.clone(),
        // Like the real cache, put reads the whole body (a tee branch that is never read would
        // keep the other branch's cancel() pending).
        put: async (k: string, r: Response) => void store.set(k, new Response(await r.arrayBuffer(), r)),
      },
    };
  } else {
    g.caches = undefined;
  }
  const tierCounts = { gets: [] as string[], puts: [] as string[] };
  const env = {
    APP: { fetch: async (r: Request) => app(r) } as Fetcher,
    APP_VERSION: opts.version ?? (opts.cache ? "v1" : ""),
    ...(opts.tier ? { MEDIA: fakeBucket(opts.tier, tierCounts, opts.failTierGet), EDGE_TIER: opts.tierVar ?? "r2" } : {}),
  };
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  return {
    lines,
    env,
    ctx,
    tierCounts,
    run: (request: Request) => worker.fetch(request, env as never, ctx),
    settle: async () => void (await Promise.all(pending)),
    restore: () => {
      console.error = realError;
      if (hadCaches) g.caches = before;
      else delete g.caches;
    },
  };
}

const platform500 = () => new Response("error code: 1102", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });

test("a 500 text/plain 'error code: 1102' gives exactly one line, and the visitor gets the app's answer unchanged", async () => {
  const t = setup(platform500);
  try {
    const res = await t.run(new Request("https://jetnine.com/contact?token=SECRETQUERY", { headers: { cookie: "session=SECRETCOOKIE" } }));
    await t.settle();
    assert.equal(res.status, 500);
    assert.equal(await res.text(), "error code: 1102");
    assert.equal(t.lines.length, 1);
    const line = t.lines[0];
    assert.match(line, /^\[edge\] app 5xx where=pass status=500 code=1102 colo=none method=GET path=\/contact$/);
    for (const forbidden of ["SECRETQUERY", "SECRETCOOKIE", "token", "cookie", '"', "'", "`"]) assert.ok(!line.includes(forbidden), `line must not contain ${forbidden}`);
  } finally {
    t.restore();
  }
});

test("an HTML 503 gives code=none: its body, which even says error code 1102, is not read for the log", async () => {
  const t = setup(() => new Response("<html>error code: 1102 secret</html>", { status: 503, headers: { "content-type": "text/html" } }));
  try {
    const res = await t.run(new Request("https://jetnine.com/cost-calculator"));
    await t.settle();
    assert.equal(res.status, 503);
    assert.equal(t.lines.length, 1);
    assert.match(t.lines[0], /status=503 code=none /);
    assert.ok(!t.lines[0].includes("secret"));
    assert.equal(await res.text(), "<html>error code: 1102 secret</html>");
  } finally {
    t.restore();
  }
});

test("a throw gives one 'app fetch threw' line with the name and the same error is rethrown", async () => {
  const boom = new TypeError('Network connection lost for "user@example.com" at https://x.test/a?b=1 id 123456789');
  const t = setup(() => {
    throw boom;
  });
  try {
    await assert.rejects(t.run(new Request("https://jetnine.com/contact")), (err) => err === boom);
    await t.settle();
    assert.equal(t.lines.length, 1);
    const line = t.lines[0];
    assert.match(line, /^\[edge\] app fetch threw where=pass name=TypeError colo=none method=GET path=\/contact msg=/);
    for (const forbidden of ["user@example.com", "x.test", "123456789", '"']) assert.ok(!line.includes(forbidden), `line must not contain ${forbidden}`);
  } finally {
    t.restore();
  }
});

test("a 200 gives no line", async () => {
  const t = setup(() => new Response("ok", { status: 200, headers: { "content-type": "text/html" } }));
  try {
    const res = await t.run(new Request("https://jetnine.com/"));
    await t.settle();
    assert.equal(res.status, 200);
    assert.equal(t.lines.length, 0);
  } finally {
    t.restore();
  }
});

test("a cache miss that gets a 500 logs where=miss, and a stale copy's refresh logs where=refresh", async () => {
  let calls = 0;
  const t = setup(
    () => {
      calls += 1;
      if (calls === 1) return new Response("page", { status: 200, headers: { "content-type": "text/html", "cache-control": "s-maxage=60" } });
      return platform500();
    },
    { cache: true },
  );
  try {
    // First read: a miss that stores the page.
    const first = await t.run(new Request("https://jetnine.com/about"));
    assert.equal(first.headers.get("x-edge-cache"), "MISS");
    await first.text();
    await t.settle();
    assert.equal(t.lines.length, 0);
    // Make the stored copy stale, then read: the visitor gets the copy, the refresh meets the 500.
    const realNow = Date.now;
    Date.now = () => realNow() + 10 * 60_000;
    try {
      const second = await t.run(new Request("https://jetnine.com/about"));
      assert.equal(second.headers.get("x-edge-cache"), "STALE");
      assert.equal(await second.text(), "page");
      await t.settle();
    } finally {
      Date.now = realNow;
    }
    assert.equal(t.lines.length, 1);
    assert.match(t.lines[0], /where=refresh status=500 code=1102 /);
  } finally {
    t.restore();
  }
});

test("a miss that answers 500 logs where=miss and returns the app's response", async () => {
  const t = setup(platform500, { cache: true });
  try {
    const res = await t.run(new Request("https://jetnine.com/about"));
    await t.settle();
    assert.equal(res.status, 500);
    assert.equal(t.lines.length, 1);
    assert.match(t.lines[0], /where=miss status=500 code=1102 /);
  } finally {
    t.restore();
  }
});

test("a very long path is cut, and every line shape passes through redact() unchanged", async () => {
  const redact = await loadRedact();
  const t = setup(platform500);
  try {
    await t.run(new Request("https://jetnine.com/contact"));
    await t.settle();
    await t.run(new Request("https://jetnine.com/" + "a/".repeat(100)));
    await t.settle();
    for (const line of t.lines) {
      assert.ok(line.length < 160, `line too long: ${line.length}`);
      assert.equal(redact(line), line);
    }
  } finally {
    t.restore();
  }
  const t2 = setup(() => {
    throw new Error("Network connection lost");
  });
  try {
    await assert.rejects(t2.run(new Request("https://jetnine.com/cost-calculator")));
    assert.equal(t2.lines.length, 1);
    assert.equal(redact(t2.lines[0]), t2.lines[0]);
    assert.ok(t2.lines[0].length < 160);
  } finally {
    t2.restore();
  }
});

// OPS-289: hero images come out of R2 and nowhere else. The Worker no longer has a Supabase
// fallback: a key that is not in the bucket gets the stand-in photo and the stand-in header,
// and no request leaves the Worker for a Supabase address.
function mediaSetup(objects: Record<string, string>) {
  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetched.push(String(input instanceof Request ? input.url : input));
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  const g = globalThis as { caches?: unknown };
  const hadCaches = "caches" in g;
  const before = g.caches;
  g.caches = undefined;
  const appCalls: string[] = [];
  const env = {
    APP: {
      fetch: async (r: Request) => {
        appCalls.push(new URL(r.url).pathname);
        return new Response("standin-bytes", { status: 200, headers: { "content-type": "image/webp" } });
      },
    } as Fetcher,
    APP_VERSION: "",
    MEDIA: {
      get: async (key: string) =>
        key in objects
          ? { body: new Response(objects[key]).body as ReadableStream, httpEtag: '"etag1"', httpMetadata: { contentType: "image/webp" } }
          : null,
    },
  };
  const ctx = { waitUntil: (_p: Promise<unknown>) => {} };
  return {
    fetched,
    appCalls,
    env,
    run: (request: Request) => worker.fetch(request, env as never, ctx),
    restore: () => {
      globalThis.fetch = realFetch;
      if (hadCaches) g.caches = before;
      else delete g.caches;
    },
  };
}

test("a hero that is in R2 answers 200, immutable, with no stand-in header", async () => {
  const key = "blog/heroes/real-1.webp";
  const t = mediaSetup({ [key]: "real-bytes" });
  try {
    const res = await t.run(new Request(`https://jetnine.com/media/${key}`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(res.headers.get("x-media-stand-in"), null);
    assert.equal(await res.text(), "real-bytes");
    assert.deepEqual(t.fetched, []);
    assert.deepEqual(t.appCalls, []);
  } finally {
    t.restore();
  }
});

test("a hero that is not in R2 gets the stand-in, and nothing is fetched from Supabase or anywhere else", async () => {
  const t = mediaSetup({});
  try {
    const res = await t.run(new Request("https://jetnine.com/media/blog/heroes/missing-2.webp"));
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("x-media-stand-in"), "the stand-in header must be set");
    assert.equal(res.headers.get("cache-control"), "public, max-age=300");
    assert.equal(t.fetched.filter((u) => u.includes("supabase.co")).length, 0);
    assert.equal(t.fetched.length, 0, "no outside fetch: nothing may call Supabase");
    assert.equal(t.appCalls.length, 1);
    assert.match(t.appCalls[0], /^\/images\/blog\/library\/[a-z-]+\.webp$/);
  } finally {
    t.restore();
  }
});

test("the same missing key always gets the same stand-in photo", async () => {
  const t = mediaSetup({});
  try {
    const a = await t.run(new Request("https://jetnine.com/media/blog/heroes/same-3.webp"));
    const b = await t.run(new Request("https://jetnine.com/media/blog/heroes/same-3.webp"));
    assert.equal(a.headers.get("x-media-stand-in"), b.headers.get("x-media-stand-in"));
  } finally {
    t.restore();
  }
});

// OPS-332: the shared second tier. Each test builds two "data centres" as two setups that share
// one fake bucket but not their caches.
const PAGE_HEADERS = {
  "content-type": "text/html",
  "cache-control": "s-maxage=1, stale-while-revalidate=2592000",
  "content-security-policy": "default-src 'self'",
};
const pageApp = (counter?: { n: number }) => () => {
  if (counter) counter.n += 1;
  return new Response("<html>aircraft</html>", { status: 200, headers: PAGE_HEADERS });
};

/** Data centre A reads the page once, so the bucket holds a copy. */
async function fillTier(objects: Objects, url: string) {
  const a = setup(pageApp(), { cache: true, tier: objects });
  try {
    const res = await a.run(new Request(url));
    await res.text();
    await a.settle();
  } finally {
    a.restore();
  }
}

test("tier 1: a data centre with no copy answers TIER from the shared object without calling the app, and a stale one refreshes once", async () => {
  const objects: Objects = new Map();
  await fillTier(objects, "https://jetnine.com/aircraft/ultra");
  const calls = { n: 0 };
  const b = setup(pageApp(calls), { cache: true, tier: objects });
  try {
    const res = await b.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-edge-cache"), "TIER");
    assert.equal(await res.text(), "<html>aircraft</html>");
    await b.settle();
    // FRESH_FOR is 1 s on this page, so the copy is stale at once only after a second; it was
    // read in the same instant, so no refresh has been asked yet.
    assert.equal(calls.n, 0, "the app is not called for a fresh shared copy");
    // Make the copy stale: the next read is served from the data centre's own copy, STALE,
    // with exactly one refresh.
    const realNow = Date.now;
    Date.now = () => realNow() + 10_000;
    try {
      const again = await b.run(new Request("https://jetnine.com/aircraft/ultra"));
      assert.equal(again.headers.get("x-edge-cache"), "STALE");
      await again.text();
      await b.settle();
    } finally {
      Date.now = realNow;
    }
    assert.equal(calls.n, 1, "one background refresh");
  } finally {
    b.restore();
  }
});

test("tier 2: a shared copy of another version is a miss; the app is called and the object is rewritten with the new version", async () => {
  const objects: Objects = new Map();
  await fillTier(objects, "https://jetnine.com/aircraft/ultra");
  const calls = { n: 0 };
  const b = setup(pageApp(calls), { cache: true, tier: objects, version: "v2" });
  try {
    const res = await b.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.headers.get("x-edge-cache"), "MISS");
    await res.text();
    await b.settle();
    assert.equal(calls.n, 1);
    const stored = new Uint8Array(objects.get("edge-tier/jetnine.com/aircraft/ultra")!);
    const head = JSON.parse(new TextDecoder().decode(stored.subarray(0, stored.indexOf(10)))) as { v: string };
    assert.equal(head.v, "v2");
  } finally {
    b.restore();
  }
});

test("tier 3: a shared copy older than a day is a miss", async () => {
  const objects: Objects = new Map();
  await fillTier(objects, "https://jetnine.com/aircraft/ultra");
  const calls = { n: 0 };
  const b = setup(pageApp(calls), { cache: true, tier: objects });
  const realNow = Date.now;
  Date.now = () => realNow() + 86_400_000 + 60_000;
  try {
    const res = await b.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.headers.get("x-edge-cache"), "MISS");
    await res.text();
    await b.settle();
    assert.equal(calls.n, 1);
  } finally {
    Date.now = realNow;
    b.restore();
  }
});

test("tier 4: a miss writes exactly one shared object, under edge-tier/<host><path>", async () => {
  const objects: Objects = new Map();
  const a = setup(pageApp(), { cache: true, tier: objects });
  try {
    const res = await a.run(new Request("https://staging.jetnine.com/guides/private-jet-baggage-limits"));
    await res.text();
    await a.settle();
    assert.deepEqual(a.tierCounts.puts, ["edge-tier/staging.jetnine.com/guides/private-jet-baggage-limits"]);
    assert.deepEqual([...objects.keys()], ["edge-tier/staging.jetnine.com/guides/private-jet-baggage-limits"]);
    // The bytes after the first newline are the page as it came.
    const stored = new Uint8Array(objects.get([...objects.keys()][0])!);
    assert.equal(new TextDecoder().decode(stored.subarray(stored.indexOf(10) + 1)), "<html>aircraft</html>");
  } finally {
    a.restore();
  }
});

test("tier 5: a refresh of a copy younger than 300 s writes no shared object, an older one writes one", async () => {
  const objects: Objects = new Map();
  const a = setup(pageApp(), { cache: true, tier: objects });
  const realNow = Date.now;
  try {
    const first = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    await first.text();
    await a.settle();
    assert.equal(a.tierCounts.puts.length, 1);
    // 60 s later: stale (FRESH_FOR 1 s) but younger than 300 s.
    Date.now = () => realNow() + 60_000;
    const young = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(young.headers.get("x-edge-cache"), "STALE");
    await young.text();
    await a.settle();
    assert.equal(a.tierCounts.puts.length, 1, "no shared write for a young copy");
    // The refresh above stored a new copy at +60 s. At +400 s it is 340 s old: older than 300 s.
    Date.now = () => realNow() + 400_000;
    const old = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    await old.text();
    await a.settle();
    assert.equal(a.tierCounts.puts.length, 2, "one shared write for an old copy");
  } finally {
    Date.now = realNow;
    a.restore();
  }
});

test("tier 6: EDGE_TIER empty means no shared read and no shared write", async () => {
  const objects: Objects = new Map();
  const a = setup(pageApp(), { cache: true, tier: objects, tierVar: "" });
  try {
    const res = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.headers.get("x-edge-cache"), "MISS");
    await res.text();
    await a.settle();
    assert.deepEqual(a.tierCounts.gets, []);
    assert.deepEqual(a.tierCounts.puts, []);
    assert.equal(objects.size, 0);
    const again = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(again.headers.get("x-edge-cache"), "HIT");
    assert.ok(again.headers.get("x-edge-age"), "x-edge-age is set on every copy answer");
  } finally {
    a.restore();
  }
});

test("tier 7: a shared read that throws falls through to the app and the page answers 200", async () => {
  const objects: Objects = new Map();
  const calls = { n: 0 };
  const a = setup(pageApp(calls), { cache: true, tier: objects, failTierGet: true });
  try {
    const res = await a.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-edge-cache"), "MISS");
    assert.equal(await res.text(), "<html>aircraft</html>");
    assert.equal(calls.n, 1);
    await a.settle();
    assert.equal(a.lines.length, 1);
    assert.match(a.lines[0], /^\[edge\] tier get failed name=Error$/);
  } finally {
    a.restore();
  }
});

test("tier 8: a TIER answer carries x-edge-age and the stored content-security-policy and none of the internal headers", async () => {
  const objects: Objects = new Map();
  await fillTier(objects, "https://jetnine.com/aircraft/ultra");
  const b = setup(pageApp(), { cache: true, tier: objects });
  try {
    const res = await b.run(new Request("https://jetnine.com/aircraft/ultra"));
    assert.equal(res.headers.get("x-edge-cache"), "TIER");
    assert.match(res.headers.get("x-edge-age") ?? "", /^\d+$/);
    assert.equal(res.headers.get("content-security-policy"), "default-src 'self'");
    assert.equal(res.headers.get("cache-control"), "s-maxage=1, stale-while-revalidate=2592000");
    assert.equal(res.headers.get("x-edge-stored-at"), null);
    assert.equal(res.headers.get("x-edge-fresh-for"), null);
    assert.equal(res.headers.get("x-edge-origin-cache-control"), null);
    await res.text();
    await b.settle();
  } finally {
    b.restore();
  }
});
