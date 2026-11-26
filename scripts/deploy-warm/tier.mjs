// Shared-tier warm-up for Deploy (Cloudflare) (OPS-332). After a deploy, read every page of the
// target's sitemap once, so the edge Worker's shared tier (R2, edge-tier/) holds a copy of each
// page for the new release. A data centre that has never served a page then answers it from the
// tier (x-edge-cache: TIER) instead of waiting for the app to load.
//
//   node scripts/deploy-warm/tier.mjs https://staging.jetnine.com
//
// Plain Node 22, global fetch, no dependency, no secret. It only informs: it never fails the
// deploy, and exits 0 whatever the reads did (2 only for a bad argument). It prints ONE line:
//
//   tier warm: colo ORD, 220 of 222 pages 200, MISS 218, HIT 1, TIER 0, STALE 1, slowest 3.1 s
//
// Never printed: a header other than the counts above (the colo is the three letters after the
// dash of cf-ray), a body, a cookie, a query string or a path.
import { pathToFileURL } from "node:url";

const defaults = { concurrency: 4, timeoutMs: 20_000 };

/** The paths of a sitemap's <loc> entries: host and query dropped, in order, without repeats. */
export function parseSitemap(xml) {
  const paths = [];
  const seen = new Set();
  for (const m of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    let path;
    try {
      path = new URL(m[1]).pathname;
    } catch {
      continue;
    }
    if (!path.startsWith("/") || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

/** The colo letters of a cf-ray value such as "8a1b2c3d4e5f-ORD", or "none". */
export function coloOf(cfRay) {
  const m = /-([A-Za-z]{3,4})$/.exec(String(cfRay ?? ""));
  return m ? m[1].toUpperCase() : "none";
}

/** Turns the reads into the one printed line. A read is { ok, cache, ms, colo }. */
export function summarize(reads, total = reads.length) {
  const count = { MISS: 0, HIT: 0, TIER: 0, STALE: 0 };
  let ok = 0;
  let slowest = 0;
  let colo = "none";
  for (const r of reads) {
    if (r.ok) ok += 1;
    if (r.cache in count) count[r.cache] += 1;
    if (r.ms > slowest) slowest = r.ms;
    if (colo === "none" && r.colo && r.colo !== "none") colo = r.colo;
  }
  return `tier warm: colo ${colo}, ${ok} of ${total} pages 200, MISS ${count.MISS}, HIT ${count.HIT}, TIER ${count.TIER}, STALE ${count.STALE}, slowest ${(slowest / 1000).toFixed(1)} s`;
}

async function readPage(fetchImpl, base, path, timeoutMs, now) {
  const started = now();
  try {
    const res = await fetchImpl(`${base}${path}`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    const ms = now() - started;
    // The whole body: a response cut off half way is not a warm page.
    await res.text();
    return { ok: res.status === 200, cache: String(res.headers.get("x-edge-cache") ?? ""), ms, colo: coloOf(res.headers.get("cf-ray")) };
  } catch {
    return { ok: false, cache: "", ms: now() - started, colo: "none" };
  }
}

/** Warm every page of the sitemap. Resolves to { line, reads }; never rejects. */
export async function tierWarm(baseUrl, options = {}) {
  const o = { ...defaults, ...options };
  const fetchImpl = o.fetchImpl ?? fetch;
  const now = o.now ?? Date.now;
  const base = String(baseUrl).replace(/\/+$/, "");
  let paths = [];
  try {
    const res = await fetchImpl(`${base}/sitemap.xml`, { method: "GET", signal: AbortSignal.timeout(o.timeoutMs) });
    if (res.status === 200) paths = parseSitemap(await res.text());
  } catch {
    paths = [];
  }
  const reads = new Array(paths.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= paths.length) return;
      reads[i] = await readPage(fetchImpl, base, paths[i], o.timeoutMs, now);
    }
  }
  await Promise.all(Array.from({ length: Math.min(o.concurrency, paths.length) }, worker));
  return { line: summarize(reads, paths.length), reads };
}

async function main() {
  const base = process.argv[2];
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(base ?? "")) {
    console.error("usage: node scripts/deploy-warm/tier.mjs https://host");
    process.exit(2);
  }
  const { line } = await tierWarm(base);
  console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
