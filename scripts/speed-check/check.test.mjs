import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SCORE_DROP, evaluate, median, medianRun, renderSummary, robotsBlocksAll } from "./check.mjs";

const page = (path, score = 90, extra = {}) => ({ path, score, lcp: 2000, cls: 0.05, tbt: 100, crawlable: true, ...extra });
const results = (pages, extra = {}) => ({
  base: "https://example.com",
  runs: 3,
  generatedAt: "2026-11-16T14:17:00.000Z",
  sitemap: { status: 200, hasUrlset: true },
  robots: { status: 200, blocksAll: false },
  pages,
  ...extra,
});

test("the drop limit is fixed at 10 points", () => {
  assert.equal(MAX_SCORE_DROP, 10);
});

test("a healthy first run has no alarms and no previous file is needed", () => {
  const v = evaluate(results([page("/")]), null);
  assert.deepEqual([v.alarms, v.findings, v.drops], [[], [], []]);
});

test("a noindex page gives an alarm", () => {
  const v = evaluate(results([page("/", 90, { crawlable: false })]), null);
  assert.equal(v.alarms.length, 1);
  assert.match(v.alarms[0], /^ALARM noindex: \/ /);
});

test("a blocked or missing robots.txt gives an alarm", () => {
  assert.match(evaluate(results([page("/")], { robots: { status: 200, blocksAll: true } }), null).alarms[0], /^ALARM robots: .*disallows/);
  assert.match(evaluate(results([page("/")], { robots: { status: 404, blocksAll: false } }), null).alarms[0], /^ALARM robots: .*404/);
});

test("a sitemap that fails or has no urlset gives an alarm", () => {
  assert.match(evaluate(results([page("/")], { sitemap: { status: 500, hasUrlset: false } }), null).alarms[0], /^ALARM sitemap/);
  assert.match(evaluate(results([page("/")], { sitemap: { status: 200, hasUrlset: false } }), null).alarms[0], /^ALARM sitemap/);
});

test("an 11 point drop gives an alarm and a 10 point drop does not", () => {
  const previous = results([page("/", 90)]);
  const eleven = evaluate(results([page("/", 79)]), previous);
  assert.match(eleven.alarms[0], /^ALARM score: \/ performance fell from 90 to 79/);
  assert.deepEqual(eleven.drops, ["/"]);
  const ten = evaluate(results([page("/", 80)]), previous);
  assert.deepEqual([ten.alarms, ten.drops], [[], []]);
});

test("a page that is new since last week has no drop", () => {
  assert.deepEqual(evaluate(results([page("/new", 50)]), results([page("/", 95)])).alarms, []);
});

test("a metric over its threshold is a finding, not an alarm", () => {
  const v = evaluate(results([page("/", 70, { lcp: 3100, cls: 0.2, tbt: 450 })]), null);
  assert.equal(v.alarms.length, 0);
  assert.equal(v.findings.length, 3);
  assert.match(v.findings[0], /LCP 3\.1 s is over 2\.5 s/);
});

test("robots.txt parsing: only the * group counts, comments and an Allow / are respected", () => {
  assert.equal(robotsBlocksAll("User-agent: *\nDisallow: /"), true);
  assert.equal(robotsBlocksAll("User-agent: *\nDisallow: /admin\nAllow: /"), false);
  assert.equal(robotsBlocksAll("User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:"), false);
  assert.equal(robotsBlocksAll("User-agent: Googlebot\nUser-agent: *\nDisallow: / # all\n"), true);
  assert.equal(robotsBlocksAll(""), false);
});

test("the median run is the one in the middle by score", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.deepEqual(medianRun([{ score: 70, lcp: 1 }, { score: 90, lcp: 3 }, { score: 80, lcp: 2 }]), { score: 80, lcp: 2 });
});

test("the summary shows last week's number or first run beside each metric", () => {
  const now = results([page("/", 88)]);
  const first = renderSummary(now, null, { alarms: [], findings: [] });
  assert.match(first, /88 \(first run\)/);
  const later = renderSummary(now, results([page("/", 85)]), { alarms: [], findings: [] });
  assert.match(later, /88 \(last 85\)/);
  assert.match(later, /### Alarms\n\nNone\./);
});
