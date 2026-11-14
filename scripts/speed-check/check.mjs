#!/usr/bin/env node
// Speed check: Lighthouse (mobile) on a few key pages, plus three hard alarms.
//
// Standard: Google's Core Web Vitals thresholds at the 75th percentile:
// LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms. A lab run cannot measure INP, so
// the report shows Total Blocking Time (good is <= 200 ms) as Lighthouse does.
// Lighthouse mobile preset with its default throttling, median of 3 runs per
// page (Lighthouse's own guidance on run-to-run variability).
//
// Alarms (exit code 1, one line each starting "ALARM"):
//   noindex  a key page is not crawlable (Lighthouse is-crawlable fails: a
//            robots noindex meta tag or X-Robots-Tag header, or robots.txt blocks it)
//   sitemap  /sitemap.xml is not 200 or holds no urlset
//   robots   /robots.txt is not 200 or disallows / for all agents
//   score    a page's performance score is more than 10 points below last
//            week's, and still is after 3 more runs
// Everything else (a metric over its threshold) is a finding in the summary.
//
// No site-specific code: the base URL and the pages come from a JSON file.
// No key: everything tested is public.
//
// Usage: node check.mjs [--pages pages.json] [--base URL] [--previous file]
//                       [--out speed-check.json] [--runs 3]
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const LIGHTHOUSE = "lighthouse@12.8.2"; // pinned exact version
export const MAX_SCORE_DROP = 10;
export const THRESHOLDS = { lcpMs: 2500, cls: 0.1, tbtMs: 200 };

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The run whose performance score is the median (odd run counts), so the metrics belong to one real run. */
export function medianRun(runs) {
  const sorted = [...runs].sort((a, b) => a.score - b.score);
  return sorted[Math.floor(sorted.length / 2)];
}

/** True when robots.txt disallows / for every agent (the "User-agent: *" group) and does not also allow /. */
export function robotsBlocksAll(text) {
  let agents = [];
  let lastWasAgent = false;
  let blocks = false;
  let allows = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!agents.includes("*")) continue;
    if (field === "disallow" && value === "/") blocks = true;
    if (field === "allow" && value === "/") allows = true;
  }
  return blocks && !allows;
}

/**
 * Pure alarm logic. results: { sitemap: {status, hasUrlset}, robots: {status, blocksAll},
 * pages: [{ path, score, lcp, cls, tbt, crawlable }] }. previous: the same shape or null.
 * Returns { alarms: string[], findings: string[], drops: string[] } where drops are the
 * paths whose score fell by more than MAX_SCORE_DROP (the caller re-runs them before alarming).
 */
export function evaluate(results, previous) {
  const alarms = [];
  const findings = [];
  const drops = [];
  const { sitemap, robots } = results;
  if (sitemap.status !== 200 || !sitemap.hasUrlset) {
    alarms.push(`ALARM sitemap: /sitemap.xml answered ${sitemap.status} and ${sitemap.hasUrlset ? "has" : "has no"} urlset`);
  }
  if (robots.status !== 200) alarms.push(`ALARM robots: /robots.txt answered ${robots.status}`);
  else if (robots.blocksAll) alarms.push("ALARM robots: /robots.txt disallows / for all agents");

  const before = new Map((previous?.pages ?? []).map((p) => [p.path, p]));
  for (const page of results.pages) {
    if (!page.crawlable) alarms.push(`ALARM noindex: ${page.path} is not crawlable (noindex or blocked by robots.txt)`);
    const last = before.get(page.path);
    if (last && last.score - page.score > MAX_SCORE_DROP) {
      drops.push(page.path);
      alarms.push(`ALARM score: ${page.path} performance fell from ${last.score} to ${page.score} (more than ${MAX_SCORE_DROP} points)`);
    }
    if (page.lcp > THRESHOLDS.lcpMs) findings.push(`${page.path}: LCP ${(page.lcp / 1000).toFixed(1)} s is over ${THRESHOLDS.lcpMs / 1000} s`);
    if (page.cls > THRESHOLDS.cls) findings.push(`${page.path}: CLS ${page.cls.toFixed(3)} is over ${THRESHOLDS.cls}`);
    if (page.tbt > THRESHOLDS.tbtMs) findings.push(`${page.path}: TBT ${Math.round(page.tbt)} ms is over ${THRESHOLDS.tbtMs} ms`);
  }
  return { alarms, findings, drops };
}

const mark = (ok) => (ok ? "good" : "over");

/** The markdown table for the job summary. */
export function renderSummary(results, previous, { alarms, findings }) {
  const before = new Map((previous?.pages ?? []).map((p) => [p.path, p]));
  const beside = (now, last, fmt) => (last === undefined ? `${fmt(now)} (first run)` : `${fmt(now)} (last ${fmt(last)})`);
  const lines = [
    "## Speed check",
    "",
    `Base ${results.base}, mobile, median of ${results.runs} runs per page, ${results.generatedAt}.`,
    "Thresholds: LCP 2.5 s, CLS 0.1, TBT 200 ms (a lab run has no INP; TBT stands in for it).",
    "",
    "| Page | Performance | LCP | CLS | TBT | Crawlable |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const p of results.pages) {
    const last = before.get(p.path);
    lines.push(
      `| ${p.path} | ${beside(p.score, last?.score, (v) => String(v))} | ${beside(p.lcp, last?.lcp, (v) => `${(v / 1000).toFixed(1)} s`)} ${mark(p.lcp <= THRESHOLDS.lcpMs)} | ${beside(p.cls, last?.cls, (v) => v.toFixed(3))} ${mark(p.cls <= THRESHOLDS.cls)} | ${beside(p.tbt, last?.tbt, (v) => `${Math.round(v)} ms`)} ${mark(p.tbt <= THRESHOLDS.tbtMs)} | ${p.crawlable ? "yes" : "NO"} |`,
    );
  }
  lines.push("", `Sitemap: ${results.sitemap.status}${results.sitemap.hasUrlset ? "" : " (no urlset)"}. Robots: ${results.robots.status}${results.robots.blocksAll ? " (blocks all)" : ""}.`);
  lines.push("", alarms.length ? "### Alarms" : "### Alarms\n\nNone.", ...alarms.map((a) => `- ${a}`));
  lines.push("", findings.length ? "### Findings" : "### Findings\n\nNone.", ...findings.map((f) => `- ${f}`));
  return lines.join("\n") + "\n";
}

async function get(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: 0, text: "" };
  }
}

function lighthouseOnce(url, dir, n) {
  const out = join(dir, `lh-${n}.json`);
  execFileSync(
    "npx",
    [
      "--yes",
      LIGHTHOUSE,
      url,
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
      "--only-categories=performance,seo",
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
    ],
    { stdio: ["ignore", "ignore", "inherit"], timeout: 180_000 },
  );
  const lhr = JSON.parse(readFileSync(out, "utf8"));
  rmSync(out, { force: true });
  const a = lhr.audits;
  return {
    score: Math.round((lhr.categories.performance.score ?? 0) * 100),
    lcp: a["largest-contentful-paint"]?.numericValue ?? 0,
    cls: a["cumulative-layout-shift"]?.numericValue ?? 0,
    tbt: a["total-blocking-time"]?.numericValue ?? 0,
    crawlable: a["is-crawlable"]?.score === 1,
  };
}

function measure(url, dir, runs) {
  const results = [];
  for (let i = 0; i < runs; i += 1) results.push(lighthouseOnce(url, dir, i));
  const run = medianRun(results);
  // A page that is not crawlable on any run is not crawlable.
  return { ...run, crawlable: results.every((r) => r.crawlable) };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const config = JSON.parse(readFileSync(arg("pages", join(here, "pages.json")), "utf8"));
  const base = (arg("base", config.baseUrl) ?? "").replace(/\/$/, "");
  const runs = Number(arg("runs", "3"));
  const out = arg("out", "speed-check.json");
  const prevFile = arg("previous", "");
  const previous = prevFile && existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, "utf8")) : null;
  const dir = mkdtempSync(join(tmpdir(), "speed-check-"));

  const [sitemap, robots] = await Promise.all([get(`${base}/sitemap.xml`), get(`${base}/robots.txt`)]);
  const results = {
    base,
    runs,
    generatedAt: new Date().toISOString(),
    sitemap: { status: sitemap.status, hasUrlset: /<urlset[\s>]|<sitemapindex[\s>]/.test(sitemap.text) },
    robots: { status: robots.status, blocksAll: robotsBlocksAll(robots.text) },
    pages: config.pages.map((path) => ({ path, ...measure(`${base}${path}`, dir, runs) })),
  };

  let verdict = evaluate(results, previous);
  // One noisy runner must not file an Incident: re-run a page that seems to have dropped,
  // and alarm only if the new median is still more than 10 points below.
  if (verdict.drops.length) {
    results.pages = results.pages.map((p) => (verdict.drops.includes(p.path) ? { path: p.path, ...measure(`${base}${p.path}`, dir, runs) } : p));
    verdict = evaluate(results, previous);
  }

  writeFileSync(out, JSON.stringify(results, null, 2));
  const summary = renderSummary(results, previous, verdict);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  for (const alarm of verdict.alarms) console.log(alarm);
  rmSync(dir, { recursive: true, force: true });
  process.exit(verdict.alarms.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`speed check failed to run: ${e.message}`);
    process.exit(2);
  });
}
