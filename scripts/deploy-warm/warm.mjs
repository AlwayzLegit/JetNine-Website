// Warm-up gate for Deploy (Cloudflare) (OPS-175). After the deploy job, before smoke and
// the sitemap audit, request the main pages of the target until each one answers 200 three
// times in a row, and fail the run with one clear line per page that does not.
//
//   node scripts/deploy-warm/warm.mjs https://staging.jetnine.com
//
// Plain Node 22, global fetch, no dependency, no secret. It prints one line per page and
// never a header, a body, a cookie or a query string. For /api/health it also requires the
// JSON to say ok: true, so a 200 that reports a failing check does not count.
import { pathToFileURL } from "node:url";

export const DEFAULT_PATHS = ["/", "/contact", "/cost-calculator", "/api/health"];

const defaults = {
  paths: DEFAULT_PATHS,
  need: 3, // answers in a row
  intervalMs: 5_000, // between two reads of the same page
  limitMs: 180_000, // for the whole gate
  timeoutMs: 20_000, // for one read
};

function realSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read one page once. Returns { ok, label }, label being a short, safe description of the
 * answer: the status number, "200 ok:false", "200 body not JSON" or the name of the error.
 */
export async function readOnce(fetchImpl, url, path, timeoutMs) {
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Read the whole body: a response cut off half way is not a warm page.
    const body = await res.text();
    if (res.status !== 200) return { ok: false, label: String(res.status) };
    if (path === "/api/health") {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        return { ok: false, label: "200 body not JSON" };
      }
      if (json?.ok !== true) return { ok: false, label: "200 ok:false" };
    }
    return { ok: true, label: "200" };
  } catch (err) {
    const name = typeof err?.name === "string" && err.name ? err.name : "Error";
    const code = typeof err?.cause?.code === "string" ? `/${err.cause.code}` : "";
    return { ok: false, label: `${name}${code}` };
  }
}

/**
 * Warm every path of the base URL. Resolves to { ok, lines, results }. `lines` are the
 * lines to print, one per page, in the order of `paths`.
 */
export async function warm(baseUrl, options = {}) {
  const o = { ...defaults, ...options };
  const fetchImpl = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? realSleep;
  const now = o.now ?? Date.now;
  const base = String(baseUrl).replace(/\/+$/, "");
  const startedAt = now();

  async function warmPath(path) {
    const url = `${base}${path}`;
    let streak = 0;
    let tries = 0;
    let last = "no answer";
    for (;;) {
      tries += 1;
      const r = await readOnce(fetchImpl, url, path, o.timeoutMs);
      last = r.label;
      streak = r.ok ? streak + 1 : 0;
      if (streak >= o.need) {
        const secs = ((now() - startedAt) / 1000).toFixed(1);
        return { path, ok: true, tries, line: `warm: ${path} 200 x${o.need} after ${tries} ${tries === 1 ? "try" : "tries"} (${secs} s)` };
      }
      // Stop when the next read could not finish inside the limit.
      if (now() - startedAt + o.intervalMs >= o.limitMs) {
        return { path, ok: false, tries, line: `WARM FAIL: ${path} last status ${last} after ${tries} ${tries === 1 ? "try" : "tries"}` };
      }
      await sleep(o.intervalMs);
    }
  }

  const results = await Promise.all(o.paths.map((p) => warmPath(p)));
  return { ok: results.every((r) => r.ok), lines: results.map((r) => r.line), results };
}

async function main() {
  const base = process.argv[2];
  if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(base ?? "")) {
    console.error("usage: node scripts/deploy-warm/warm.mjs https://host");
    process.exit(2);
  }
  const { ok, lines, results } = await warm(base);
  for (const line of lines) console.log(line);
  if (!ok) {
    for (const r of results.filter((x) => !x.ok)) console.log(`::error title=Warm-up failed::${r.line}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
