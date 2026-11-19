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

function setup(app: (request: Request) => Promise<Response> | Response, opts: { cache?: boolean } = {}) {
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
        put: async (k: string, r: Response) => void store.set(k, r),
      },
    };
  } else {
    g.caches = undefined;
  }
  const env = { APP: { fetch: async (r: Request) => app(r) } as Fetcher, APP_VERSION: opts.cache ? "v1" : "" };
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  return {
    lines,
    env,
    ctx,
    run: (request: Request) => worker.fetch(request, env, ctx),
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
