#!/usr/bin/env node
/**
 * Search results report (OPS-24): what Google shows people for this site.
 *
 * Reads the Search Console API (Search Analytics query, final data only, read
 * only scope) and writes one report to the job summary: the last 28 days
 * against the 28 before, the top searches and pages, the biggest movers, the
 * searches sitting at position 5 to 20 (the cheapest wins), pages that get
 * seen but not clicked, and indexed against not indexed from the coverage
 * sweep. The same numbers, already filtered, go to search-report.json.
 *
 * One alarm, which exits 1 and prints "ALARM impressions": the 2 newest final
 * days are both below 30 percent of their weekday baseline (the average of
 * the same weekday in the 4 weeks before), and that baseline is at least 100
 * impressions a day. Search Console's final data is about 2 days behind, so no
 * run can say "today"; the workflow runs three times a week. Everything else
 * is a finding.
 *
 * Auth (OPS-81): no key. The workflow signs in to Google with its own short
 * GitHub sign-in (workload identity) and hands this script a short-lived,
 * read-only token in GSC_ACCESS_TOKEN. Nothing here signs anything or reads a
 * key file. The token and the account's address are never printed: a failed
 * call prints its HTTP status number and nothing from the response.
 * On a public repository the workflow does not sign in at all (GitHub prints a
 * step's inputs in public logs), so the run prints one "waiting" line until the
 * repository is private (OPS-52).
 *
 * Copied from AlwayzLegit/weedtip at df9fdbe (OPS-24) for OPS-36 (blueprint
 * "Search results report for a site"). Five changes from the source, each with
 * a test: (1) no secret is "not configured", exit 0; (2) the property comes
 * from GSC_SITE_URL, or is found from GSC_DOMAIN by listing what the service
 * account can read, and no default names another site; (3) with no --coverage
 * file the Coverage section is left out; (4) search terms are printed and
 * stored only when SHOW_SEARCH_TERMS is exactly "true"; (5) the token is never
 * given to a pull request (that is the workflow's job, see the .yml).
 * OPS-81 then replaced (1) and the key sign-in with the keyless sign-in above.
 *
 * Usage: node report.mjs [--report] [--coverage coverage-summary.json]
 *                        [--previous search-report.json] [--out search-report.json]
 *   --report  also write the full report (the alarm check runs on every run)
 * Env: GSC_ACCESS_TOKEN (from the workflow's sign-in), GSC_SITE_URL (a property
 *      exactly as Search Console names it), GSC_DOMAIN (used when GSC_SITE_URL
 *      is empty), REPO_PRIVATE and SIGN_IN_SET ("true" or "false", only to say
 *      why there is no token), SHOW_SEARCH_TERMS ("true" to print and store
 *      searches; anything else withholds them).
 * Exit: 0 ok, waiting for a sign-in, or no access to the property yet; 1 ALARM
 *       impressions; 2 the run itself broke (including Google refusing the token).
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const T = {
  alarmFraction: 0.3,
  alarmMinBaseline: 100,
  minQueryImpressions: 20,
  rankMinPos: 5,
  rankMaxPos: 20,
  rankMinImpressions: 50,
  ctrMinImpressions: 500,
  ctrMax: 0.01,
  top: 20,
  movers: 10,
  windowDays: 28,
  // Search Console's final data trails by 2 to 3 days. The alarm treats this many
  // days back from today as the newest day that should exist, so days with no
  // impressions at all (which Search Console leaves out) count as zero.
  finalLagDays: 3,
  pageRows: 1000,
  maxPages: 10,
};

const DAY = 24 * 60 * 60 * 1000;
export const addDays = (date, n) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// ─── The alarm ─────────────────────────────────────────────────────────────
/**
 * rows: [{ date: "YYYY-MM-DD", impressions }] from a date query (final data).
 * Days Search Console leaves out had no impressions and count as 0.
 * boundary: the newest day that should exist ("YYYY-MM-DD"). Without it a total
 * drop to zero would move the check back to the last day that had traffic.
 */
export function alarm(rows, boundary = null) {
  const byDate = new Map(rows.map((r) => [r.date, r.impressions]));
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return { alarm: false, enough: false, days: [] };
  const last = boundary && boundary > dates.at(-1) ? boundary : dates.at(-1);
  const days = [addDays(last, -1), last].map((date) => {
    const baseline =
      [1, 2, 3, 4].reduce((sum, k) => sum + (byDate.get(addDays(date, -7 * k)) ?? 0), 0) / 4;
    return { date, impressions: byDate.get(date) ?? 0, baseline };
  });
  // The history must reach back 4 weeks before the older of the two days.
  const enough = dates[0] <= addDays(last, -29);
  const low = days.every(
    (d) => d.baseline >= T.alarmMinBaseline && d.impressions < T.alarmFraction * d.baseline,
  );
  return { alarm: enough && low, enough, days };
}

// ─── Privacy filter ────────────────────────────────────────────────────────
const digitCount = (s) => (s.match(/\d/g) ?? []).length;
/** A term that looks like an email address or a phone number. */
export const looksPersonal = (s) => s.includes('@') || digitCount(s) >= 7;

/**
 * Applied before anything is printed or stored. A query is shown only when it
 * has at least 20 impressions in the period and holds no "@" and fewer than 7
 * digits. A personal name cannot be detected with certainty: the impression
 * floor is the control for that.
 */
export function filterQueries(rows) {
  const kept = [];
  let withheld = 0;
  for (const r of rows) {
    if (looksPersonal(r.key) || r.impressions < T.minQueryImpressions) withheld += 1;
    else kept.push(r);
  }
  return { kept, withheld };
}

export function filterPages(rows) {
  const kept = rows.filter((r) => !looksPersonal(r.key));
  return { kept, withheld: rows.length - kept.length };
}

// ─── Maths ─────────────────────────────────────────────────────────────────
export function totals(dayRows) {
  const clicks = dayRows.reduce((s, r) => s + r.clicks, 0);
  const impressions = dayRows.reduce((s, r) => s + r.impressions, 0);
  const weighted = dayRows.reduce((s, r) => s + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weighted / impressions : 0,
  };
}

/**
 * Merge two periods by key. A key that is new this period has isNew true and
 * counts as 0 clicks before.
 */
export function compare(now, before) {
  const prev = new Map(before.map((r) => [r.key, r]));
  return now.map((r) => {
    const p = prev.get(r.key);
    return {
      ...r,
      prevClicks: p?.clicks ?? 0,
      prevPosition: p?.position ?? null,
      dClicks: r.clicks - (p?.clicks ?? 0),
      dPosition: p ? r.position - p.position : null,
      isNew: !p,
    };
  });
}

const byClicks = (a, b) => b.clicks - a.clicks || b.impressions - a.impressions;

/**
 * showTerms false (the default) keeps every search out of the result: the
 * three lists of searches come back empty and only their count is kept.
 */
export function shapeReport({
  nowQueries,
  beforeQueries,
  nowPages,
  beforePages,
  showTerms = false,
}) {
  const p = filterPages(nowPages);
  const pb = filterPages(beforePages).kept;
  const pages = compare(p.kept, pb);
  const pageLists = {
    topPages: [...pages].sort(byClicks).slice(0, T.top),
    poorCtr: pages
      .filter((r) => r.impressions >= T.ctrMinImpressions && r.clicks / r.impressions < T.ctrMax)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, T.top),
    withheldPages: p.withheld,
  };
  if (!showTerms) {
    return {
      showTerms: false,
      searchCount: nowQueries.length,
      topQueries: [],
      queryMovers: { gainers: [], losers: [] },
      cheapWins: [],
      withheldQueries: 0,
      ...pageLists,
    };
  }
  const q = filterQueries(nowQueries);
  const qb = filterQueries(beforeQueries).kept;
  const queries = compare(q.kept, qb);
  const movers = (rows) => ({
    gainers: [...rows]
      .filter((r) => r.dClicks > 0)
      .sort((a, b) => b.dClicks - a.dClicks)
      .slice(0, T.movers),
    losers: [...rows]
      .filter((r) => r.dClicks < 0)
      .sort((a, b) => a.dClicks - b.dClicks)
      .slice(0, T.movers),
  });
  return {
    showTerms: true,
    searchCount: nowQueries.length,
    topQueries: [...queries].sort(byClicks).slice(0, T.top),
    queryMovers: movers(queries),
    cheapWins: queries
      .filter(
        (r) =>
          r.position >= T.rankMinPos &&
          r.position <= T.rankMaxPos &&
          r.impressions >= T.rankMinImpressions,
      )
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, T.top),
    withheldQueries: q.withheld,
    ...pageLists,
  };
}

const INDEXED = /^(submitted and indexed|indexed, not submitted in sitemap)$/i;
/** coverage: { writtenAt, counts: { state: n } } written by a coverage sweep. No URL in it. */
export function coverageLine(coverage) {
  if (!coverage?.counts) return 'Coverage: no coverage data for this site.';
  let indexed = 0;
  let total = 0;
  for (const [state, n] of Object.entries(coverage.counts)) {
    total += n;
    if (INDEXED.test(state)) indexed += n;
  }
  return `Coverage: ${indexed} indexed, ${total - indexed} not indexed, of ${total} pages checked (sweep written ${coverage.writtenAt ?? 'unknown'}).`;
}

// ─── Rendering ─────────────────────────────────────────────────────────────
const cell = (s, n = 70) =>
  String(s)
    .replace(/\|/g, '/')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, n);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const num = (x) => Math.round(x).toLocaleString('en-US');
const pos = (x) => (x === null ? '-' : x.toFixed(1));
const signed = (x) => (x > 0 ? `+${num(x)}` : num(x));
const shortPage = (u) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

function table(head, rows) {
  if (!rows.length) return 'None.\n';
  return (
    [
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n') + '\n'
  );
}

export function renderSummary({
  site,
  lastFinal,
  ranges,
  now,
  before,
  report,
  verdict,
  coverage,
  previousTotals,
}) {
  const L = [`## Search results report`, ''];
  L.push(`Property ${site}. Final data up to ${lastFinal}.`, '');
  const d = verdict.days.map(
    (x) => `${x.date}: ${num(x.impressions)} impressions against a baseline of ${num(x.baseline)}`,
  );
  L.push(
    verdict.alarm ? '### ALARM impressions' : '### Alarm check',
    '',
    verdict.alarm
      ? `Both of the 2 newest days are below ${T.alarmFraction * 100} percent of their weekday baseline (baseline at least ${T.alarmMinBaseline} a day). ${d.join('; ')}.`
      : `OK. ${verdict.enough ? d.join('; ') + '.' : 'Not enough history yet to compare.'} The alarm needs both of the 2 newest days below ${T.alarmFraction * 100} percent of their weekday baseline, with a baseline of at least ${T.alarmMinBaseline} a day.`,
    '',
  );
  if (!report) {
    L.push('The full report runs on Mondays and on manual runs.', '');
    return L.join('\n') + '\n';
  }
  L.push(
    `### Site, last ${T.windowDays} days (${ranges.now[0]} to ${ranges.now[1]}) against the ${T.windowDays} before`,
    '',
  );
  L.push(
    table(
      ['', 'Clicks', 'Impressions', 'Click rate', 'Avg position'],
      [
        ['Now', num(now.clicks), num(now.impressions), pct(now.ctr), pos(now.position)],
        [
          'Before',
          num(before.clicks),
          num(before.impressions),
          pct(before.ctr),
          pos(before.position),
        ],
        [
          'Change',
          signed(now.clicks - before.clicks),
          signed(now.impressions - before.impressions),
          `${((now.ctr - before.ctr) * 100).toFixed(1)} pts`,
          (now.position - before.position).toFixed(1),
        ],
      ],
    ),
  );
  if (previousTotals)
    L.push(
      `At the last stored report: ${num(previousTotals.clicks)} clicks and ${num(previousTotals.impressions)} impressions.`,
      '',
    );
  const withheldLine = `search terms withheld: public repository (${report.searchCount} searches)`;
  if (report.showTerms) {
    L.push(
      `### Top ${T.top} searches by clicks`,
      '',
      table(
        ['Search', 'Clicks', 'Change', 'Impressions', 'Position', 'Pos change'],
        report.topQueries.map((r) => [
          cell(r.key),
          num(r.clicks),
          r.isNew ? 'new' : signed(r.dClicks),
          num(r.impressions),
          pos(r.position),
          pos(r.dPosition),
        ]),
      ),
    );
  } else {
    L.push(`### Top ${T.top} searches by clicks`, '', withheldLine, '');
  }
  L.push(
    `### Top ${T.top} pages by clicks`,
    '',
    table(
      ['Page', 'Clicks', 'Change', 'Impressions', 'Position', 'Pos change'],
      report.topPages.map((r) => [
        cell(shortPage(r.key)),
        num(r.clicks),
        r.isNew ? 'new' : signed(r.dClicks),
        num(r.impressions),
        pos(r.position),
        pos(r.dPosition),
      ]),
    ),
  );
  if (report.showTerms) {
    L.push(
      `### Biggest gainers (searches, by clicks)`,
      '',
      table(
        ['Search', 'Clicks', 'Change'],
        report.queryMovers.gainers.map((r) => [cell(r.key), num(r.clicks), signed(r.dClicks)]),
      ),
    );
    L.push(
      `### Biggest losers (searches, by clicks)`,
      '',
      table(
        ['Search', 'Clicks', 'Change'],
        report.queryMovers.losers.map((r) => [cell(r.key), num(r.clicks), signed(r.dClicks)]),
      ),
    );
    L.push(
      `### Cheapest wins: searches at position ${T.rankMinPos} to ${T.rankMaxPos} with at least ${T.rankMinImpressions} impressions`,
      '',
      table(
        ['Search', 'Impressions', 'Position', 'Clicks'],
        report.cheapWins.map((r) => [
          cell(r.key),
          num(r.impressions),
          pos(r.position),
          num(r.clicks),
        ]),
      ),
    );
  } else {
    L.push(
      `### Biggest gainers and losers (searches)`,
      '',
      withheldLine,
      '',
      `### Cheapest wins: searches at position ${T.rankMinPos} to ${T.rankMaxPos}`,
      '',
      withheldLine,
      '',
    );
  }
  L.push(
    `### Seen but not clicked: pages with at least ${T.ctrMinImpressions} impressions and a click rate under ${T.ctrMax * 100} percent`,
    '',
    table(
      ['Page', 'Impressions', 'Click rate', 'Position'],
      report.poorCtr.map((r) => [
        cell(shortPage(r.key)),
        num(r.impressions),
        pct(r.clicks / r.impressions),
        pos(r.position),
      ]),
    ),
  );
  if (coverage?.counts) L.push(`### Coverage`, '', coverageLine(coverage), '');
  L.push(
    `### Privacy`,
    '',
    report.showTerms
      ? `Withheld: ${report.withheldQueries} searches (fewer than ${T.minQueryImpressions} impressions in the period, an "@", or 7 or more digits) and ${report.withheldPages} pages. A personal name cannot be detected with certainty, so the ${T.minQueryImpressions} impression floor is the control. No key, token or address of a person is in this report.`
      : `Search terms are not printed or stored (${report.searchCount} searches in the period). ${report.withheldPages} pages withheld (an "@" or 7 or more digits in the address). No key, token or address of a person is in this report.`,
    '',
  );
  return L.join('\n') + '\n';
}

// ─── Search Console API ────────────────────────────────────────────────────
/** An API failure. Only our own message and the HTTP status number, never a response body. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function makeQuery(token, siteUrl, fetchImpl = fetch) {
  return async function query(body) {
    const res = await fetchImpl(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataState: 'final', ...body }),
      },
    );
    if (!res.ok) throw new ApiError(`searchAnalytics.query failed: HTTP ${res.status}`, res.status);
    return (await res.json()).rows ?? [];
  };
}

const asRow = (r) => ({
  key: r.keys[0],
  clicks: r.clicks ?? 0,
  impressions: r.impressions ?? 0,
  position: r.position ?? 0,
});

/**
 * The whole run, with the API behind `query`. Returns { summary, json, exitCode }.
 * today is "YYYY-MM-DD" (UTC).
 */
export async function buildReport({
  query,
  site,
  today,
  withReport,
  showTerms = false,
  coverage = null,
  previous = null,
  now = new Date(),
}) {
  const series = (
    await query({
      startDate: addDays(today, -70),
      endDate: today,
      dimensions: ['date'],
      rowLimit: 100,
    })
  ).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position ?? 0,
  }));
  if (!series.length)
    throw new ApiError('no data returned for the property (is the service account added to it?)');
  const boundary = addDays(today, -T.finalLagDays);
  const verdict = alarm(series, boundary);
  const newestRow = series
    .map((r) => r.date)
    .sort()
    .at(-1);
  const lastFinal = newestRow > boundary ? newestRow : boundary;
  const ranges = {
    now: [addDays(lastFinal, -(T.windowDays - 1)), lastFinal],
    before: [addDays(lastFinal, -(2 * T.windowDays - 1)), addDays(lastFinal, -T.windowDays)],
  };
  const inRange = ([a, b]) => series.filter((r) => r.date >= a && r.date <= b);
  const nowTotals = totals(inRange(ranges.now));
  const beforeTotals = totals(inRange(ranges.before));

  let report = null;
  if (withReport) {
    // Rows come sorted by clicks, so a property with more than one page of
    // them needs every page before the lists are worked out.
    const q = async (dimension, [startDate, endDate]) => {
      const all = [];
      for (let page = 0; page < T.maxPages; page += 1) {
        const rows = await query({
          startDate,
          endDate,
          dimensions: [dimension],
          rowLimit: T.pageRows,
          startRow: page * T.pageRows,
        });
        all.push(...rows);
        if (rows.length < T.pageRows) break;
      }
      return all.map(asRow);
    };
    const [nowQueries, beforeQueries, nowPages, beforePages] = await Promise.all([
      q('query', ranges.now),
      q('query', ranges.before),
      q('page', ranges.now),
      q('page', ranges.before),
    ]);
    report = shapeReport({ nowQueries, beforeQueries, nowPages, beforePages, showTerms });
  }

  const summary = renderSummary({
    site,
    lastFinal,
    ranges,
    now: nowTotals,
    before: beforeTotals,
    report,
    verdict,
    coverage,
    previousTotals: previous?.totals?.now ?? null,
  });
  const json = {
    generatedAt: now.toISOString(),
    site,
    lastFinal,
    ranges,
    totals: { now: nowTotals, before: beforeTotals },
    alarm: { fired: verdict.alarm, days: verdict.days },
    ...(report
      ? {
          termsShown: report.showTerms,
          searchCount: report.searchCount,
          ...(report.showTerms
            ? {
                topQueries: report.topQueries.map(({ key, clicks, impressions, position }) => ({
                  key,
                  clicks,
                  impressions,
                  position,
                })),
                cheapWins: report.cheapWins.map(({ key, impressions, position }) => ({
                  key,
                  impressions,
                  position,
                })),
              }
            : {}),
          topPages: report.topPages.map(({ key, clicks, impressions, position }) => ({
            key,
            clicks,
            impressions,
            position,
          })),
          withheld: { queries: report.withheldQueries, pages: report.withheldPages },
        }
      : {}),
  };
  return {
    summary,
    json,
    exitCode: verdict.alarm ? 1 : 0,
    alarmLine: verdict.alarm
      ? `ALARM impressions: ${verdict.days.map((d) => `${d.date} ${Math.round(d.impressions)} against baseline ${Math.round(d.baseline)}`).join(', ')}`
      : null,
  };
}

// ─── CLI ───────────────────────────────────────────────────────────────────
function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const readJson = (file) =>
  file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

/**
 * Why there is no sign-in token yet, as one fixed line. The reasons are told in
 * order: a public repository (the sign-in step does not run there, OPS-52), the
 * repository variable GSC_SERVICE_ACCOUNT not set (OPS-25), then the one left:
 * the sign-in runs on main only. Nothing from the environment is printed.
 */
export function notConfiguredLine(env = process.env) {
  if (env.REPO_PRIVATE !== 'true')
    return 'Search results report: waiting (public repository: the keyless sign-in starts once the repository is private, OPS-52)';
  if (env.SIGN_IN_SET !== 'true')
    return 'Search results report: waiting (the repository variable GSC_SERVICE_ACCOUNT is not set, OPS-25)';
  return 'Search results report: waiting (no sign-in token: the keyless sign-in runs on main only)';
}

// ─── The property ──────────────────────────────────────────────────────────
const RIGHTS = { siteOwner: 3, siteFullUser: 2, siteRestrictedUser: 1 };

/**
 * Which property to read for a domain, from what the service account can read.
 * entries: [{ siteUrl, permissionLevel }] (sites.list "siteEntry"). The domain
 * property sc-domain:DOMAIN wins when it is listed; otherwise the address
 * property for DOMAIN or www.DOMAIN with the most rights. A property the
 * account only holds as an unverified user cannot be queried and is skipped.
 * Returns the siteUrl, or null.
 */
export function chooseProperty(entries, domain) {
  const d = String(domain || '')
    .trim()
    .toLowerCase();
  if (!d) return null;
  const usable = (entries ?? []).filter((e) => RIGHTS[e.permissionLevel]);
  const domainProperty = usable.find((e) => String(e.siteUrl).toLowerCase() === `sc-domain:${d}`);
  if (domainProperty) return domainProperty.siteUrl;
  const addresses = new Set([`https://${d}/`, `http://${d}/`, `https://www.${d}/`, `http://www.${d}/`]);
  const matches = usable.filter((e) => addresses.has(String(e.siteUrl).toLowerCase()));
  matches.sort((a, b) => RIGHTS[b.permissionLevel] - RIGHTS[a.permissionLevel]);
  return matches[0]?.siteUrl ?? null;
}

/** The properties this account can read. On failure only the status number is kept. */
export async function listSites(token, fetchImpl = fetch) {
  const res = await fetchImpl('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(`sites.list failed: HTTP ${res.status}`, res.status);
  return (await res.json()).siteEntry ?? [];
}

/**
 * The property to read. Search Console is asked first, so a refused token is a
 * failure here (listSites throws with the status number). GSC_SITE_URL is used
 * only when the account can read it; otherwise the property that covers
 * GSC_DOMAIN is chosen. Returns the siteUrl, or null when the read-only account
 * has not been added to a property yet (owner step OPS-25), which is not a failure.
 */
export async function resolveSite({ siteUrl, domain, token, fetchImpl = fetch }) {
  if (!siteUrl && !domain) throw new ApiError('neither GSC_SITE_URL nor GSC_DOMAIN is set');
  const entries = await listSites(token, fetchImpl);
  if (siteUrl) {
    const listed = entries.some((e) => e.siteUrl === siteUrl && RIGHTS[e.permissionLevel]);
    return listed ? siteUrl : null;
  }
  return chooseProperty(entries, domain);
}

export function noAccessLine(domain, siteUrl) {
  return `Search results report: the read-only account cannot read a property for ${domain || siteUrl} yet (owner step OPS-25)`;
}

function waitWith(line) {
  console.log(`::notice::${line}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Search results report\n\n${line}\n`);
  process.exit(0);
}

async function main() {
  const token = (process.env.GSC_ACCESS_TOKEN || '').trim();
  // Not an error: the repository is public, or the owner step (OPS-25) is not done yet.
  if (!token) waitWith(notConfiguredLine());
  // The names are checked before any call is made.
  if (!process.env.GSC_SITE_URL && !process.env.GSC_DOMAIN)
    throw new ApiError('neither GSC_SITE_URL nor GSC_DOMAIN is set');
  const site = await resolveSite({
    siteUrl: process.env.GSC_SITE_URL,
    domain: process.env.GSC_DOMAIN,
    token,
  });
  console.log('sign-in: workload identity');
  if (!site) waitWith(noAccessLine(process.env.GSC_DOMAIN, process.env.GSC_SITE_URL));
  const result = await buildReport({
    query: makeQuery(token, site),
    site,
    today: new Date().toISOString().slice(0, 10),
    withReport: process.argv.includes('--report'),
    showTerms: process.env.SHOW_SEARCH_TERMS === 'true',
    coverage: readJson(arg('coverage')),
    previous: readJson(arg('previous')),
  });
  writeFileSync(arg('out', 'search-report.json'), JSON.stringify(result.json, null, 2));
  console.log(result.summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary);
  if (result.alarmLine) console.log(result.alarmLine);
  process.exit(result.exitCode);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    // Only our own messages (a status number) are printed, never a response body or the key.
    console.error(
      `::error::search report failed: ${e instanceof ApiError ? e.message : 'unexpected error'}`,
    );
    process.exit(2);
  });
}
