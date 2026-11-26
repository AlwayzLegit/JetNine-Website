// Run with: node --test scripts/deploy-warm/tier.test.mjs
// OPS-332: the shared-tier warm-up reads each sitemap path once, counts what the edge Worker
// answered, prints one line with nothing but counts, and never fails the deploy.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseSitemap, summarize, tierWarm } from "./tier.mjs";

const SITEMAP = `<?xml version="1.0"?><urlset>
<url><loc>https://jetnine.com/</loc></url>
<url><loc>https://jetnine.com/aircraft/ultra?utm=x</loc></url>
<url><loc>https://www.jetnine.com/guides/a</loc></url>
<url><loc>https://jetnine.com/guides/a</loc></url>
<url><loc>not a url</loc></url>
</urlset>`;

test("the sitemap's paths are kept, hosts and queries dropped, repeats and bad entries skipped", () => {
  assert.deepEqual(parseSitemap(SITEMAP), ["/", "/aircraft/ultra", "/guides/a"]);
});

test("the summary line counts each cache value and the slowest read, and holds nothing else", () => {
  const reads = [
    { ok: true, cache: "MISS", ms: 3100, colo: "ORD" },
    { ok: true, cache: "MISS", ms: 900, colo: "ORD" },
    { ok: true, cache: "TIER", ms: 150, colo: "ORD" },
    { ok: true, cache: "HIT", ms: 90, colo: "ORD" },
    { ok: true, cache: "STALE", ms: 100, colo: "ORD" },
    { ok: false, cache: "", ms: 20000, colo: "none" },
  ];
  assert.equal(summarize(reads), "tier warm: colo ORD, 5 of 6 pages 200, MISS 2, HIT 1, TIER 1, STALE 1, slowest 20.0 s");
});

test("a failed read is counted and never throws; the script exits 0 even when the site cannot be reached", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/sitemap.xml")) return new Response(SITEMAP, { status: 200 });
    if (String(url).endsWith("/aircraft/ultra")) throw new Error("boom");
    return new Response("<html></html>", { status: 200, headers: { "x-edge-cache": "MISS", "cf-ray": "8a1b2c3d4e5f6789-LAX" } });
  };
  const { line } = await tierWarm("https://staging.jetnine.com", { fetchImpl });
  assert.equal(line, "tier warm: colo LAX, 2 of 3 pages 200, MISS 2, HIT 0, TIER 0, STALE 0, slowest 0.0 s");
  // Nothing is listening on this port: the sitemap read fails, the line says 0 of 0, the exit is 0.
  const script = fileURLToPath(new URL("./tier.mjs", import.meta.url));
  const run = spawnSync(process.execPath, [script, "https://127.0.0.1:9"], { encoding: "utf8", timeout: 30_000 });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /^tier warm: colo none, 0 of 0 pages 200, MISS 0, HIT 0, TIER 0, STALE 0, slowest 0\.0 s\n$/);
  const bad = spawnSync(process.execPath, [script, "nonsense"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
});
