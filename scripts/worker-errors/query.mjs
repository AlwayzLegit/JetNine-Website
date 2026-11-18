#!/usr/bin/env node
/**
 * Read the Workers' errors for a time window from Workers Logs (OPS-168), after the fact.
 *
 * The deploy tail (scripts/deploy-tail) only sees the minutes right after a deploy. This reads
 * Cloudflare's Workers Observability telemetry for ANY window (at most 2 hours) with the repo's
 * own deploy token, so a break at 11:22 PM can be read the next morning while the logs are kept.
 *
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     node scripts/worker-errors/query.mjs <from ISO UTC> <to ISO UTC> <production|staging>
 *
 * It prints, per Worker, counts by level, outcome and status, then up to 50 lines (time, Worker,
 * path without query string, level, outcome, status, the message REDACTED and cut to 160
 * characters), then the 10 most common redacted messages. It never prints a header, a query
 * string, a body, a cookie, the token or the account id. It also prints the NAMES (never the
 * values) of the fields of the first event, so a change in Cloudflare's event shape is visible.
 *
 * A 401 or 403 prints one line saying the token cannot read Workers Logs and exits 0.
 */
import { pathToFileURL } from "node:url";
import { safePath } from "../deploy-tail/summarize.mjs";

export const MAX_WINDOW_MS = 2 * 60 * 60 * 1000;
export const MAX_LINES = 50;
export const MAX_MESSAGE = 160;
export const EVENT_LIMIT = 1000;
const ENDPOINT = (account) => `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`;

export const SERVICES = {
  production: ["jetnine-edge", "jetnine-web"],
  staging: ["jetnine-edge-staging", "jetnine-web-staging"],
};

/**
 * Take what must not leave a log line out of a message: emails, URLs, quoted values, everything
 * after `params:` (query parameters), runs of 6 or more digits (ids, phone numbers, codes), and long
 * tokens. Then cut it. The result is a message SHAPE, not its data.
 */
export function redact(message, max = MAX_MESSAGE) {
  let s = String(message ?? "");
  const p = s.search(/params\s*:/i);
  if (p !== -1) s = `${s.slice(0, p)}params: <redacted>`;
  s = s
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/"[^"]*"/g, '"<str>"')
    .replace(/'[^']*'/g, "'<str>'")
    .replace(/`[^`]*`/g, "`<str>`")
    .replace(/\+?\d[\d\s().-]{5,}\d/g, "<n>")
    .replace(/\d{6,}/g, "<n>")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "<token>")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

/** Validate the window and the environment. Throws a short message on a bad input. */
export function parseArgs(argv, now = Date.now()) {
  const [fromRaw, toRaw, envName] = argv;
  const from = Date.parse(fromRaw ?? "");
  const to = Date.parse(toRaw ?? "");
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("from and to must be ISO times such as 2026-11-18T07:10:00Z");
  if (!/Z$|[+-]\d\d:?\d\d$/.test(fromRaw) || !/Z$|[+-]\d\d:?\d\d$/.test(toRaw)) throw new Error("from and to must carry a time zone, for example Z for UTC");
  if (to <= from) throw new Error("to must be later than from");
  if (to - from > MAX_WINDOW_MS) throw new Error("the window is at most 2 hours");
  if (from > now) throw new Error("from is in the future");
  if (!SERVICES[envName]) throw new Error("env must be production or staging");
  return { from, to, env: envName, services: SERVICES[envName] };
}

/** The request body. Unix ms timeframe; events of the two Workers of the environment. */
export function buildBody({ from, to, services }) {
  return {
    queryId: "jetnine-worker-errors",
    view: "events",
    limit: EVENT_LIMIT,
    timeframe: { from, to },
    parameters: {
      datasets: [],
      filterCombination: "and",
      filters: [
        {
          kind: "group",
          filterCombination: "or",
          filters: services.map((name) => ({ kind: "filter", key: "$metadata.service", operation: "eq", type: "string", value: name })),
        },
      ],
    },
  };
}

const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One event reduced to the fields this report may show. Unknown shapes become empty fields. */
export function reduceEvent(e) {
  const m = e && typeof e.$metadata === "object" && e.$metadata ? e.$metadata : {};
  const w = e && typeof e.$workers === "object" && e.$workers ? e.$workers : {};
  const res = w.event && typeof w.event === "object" ? w.event.response : undefined;
  const req = w.event && typeof w.event === "object" ? w.event.request : undefined;
  const status = num(res?.status) ?? num(m.statusCode) ?? num(m.status);
  const url = str(req?.url) || str(m.url);
  return {
    at: num(e?.timestamp) ?? (num(m.timestampNs) !== null ? Math.floor(num(m.timestampNs) / 1e6) : null),
    service: str(m.service) || str(w.scriptName) || "unknown",
    method: str(req?.method),
    path: url ? safePath(url) : "",
    level: str(m.level),
    outcome: str(w.outcome),
    status,
    message: str(m.error) || str(m.message),
  };
}

/** An event worth listing: an error level, an outcome that is not ok, or a 5xx response. */
export const isError = (r) => r.level === "error" || (r.outcome !== "" && r.outcome !== "ok") || (r.status !== null && r.status >= 500);

const count = (rows, pick) => {
  const out = {};
  for (const r of rows) {
    const k = pick(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
};

const when = (ms) => (ms === null ? "??:??:??" : new Date(ms).toISOString().slice(11, 23) + "Z");

/** The markdown report from the raw events. Pure: no network, no clock. */
export function report(events, { from, to, env, truncated = false }) {
  const rows = events.map(reduceEvent);
  const lines = [`## Worker errors, ${env}`, "", `Window: ${new Date(from).toISOString()} to ${new Date(to).toISOString()}. Events read: ${rows.length}${truncated ? ` (more exist: the query is capped at ${EVENT_LIMIT})` : ""}.`, ""];
  for (const service of [...new Set(rows.map((r) => r.service))].sort()) {
    const mine = rows.filter((r) => r.service === service);
    const bad = mine.filter(isError);
    lines.push(`### ${service}`);
    lines.push(
      `Events: ${mine.length}, errors: ${bad.length}. Levels: ${count(mine, (r) => r.level || "none")}. Outcomes: ${count(mine, (r) => r.outcome || "none")}. Statuses: ${count(mine, (r) => (r.status === null ? "none" : String(r.status)))}.`,
    );
    lines.push("");
  }
  if (rows.length === 0) lines.push("No events came back for this window and these Workers. That is not the same as no errors: the logs may be past their retention, or the query may not match.", "");
  const bad = rows.filter(isError).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  lines.push(`### First ${Math.min(bad.length, MAX_LINES)} of ${bad.length} error events`);
  for (const r of bad.slice(0, MAX_LINES)) {
    lines.push(
      `- ${when(r.at)} ${r.service}${r.method || r.path ? ` ${r.method} ${r.path}`.trimEnd() : ""}` +
        `${r.level ? ` level ${r.level}` : ""}${r.outcome ? ` outcome ${r.outcome}` : ""}${r.status !== null ? ` status ${r.status}` : ""}` +
        `${r.message ? ` message: ${redact(r.message)}` : ""}`,
    );
  }
  if (bad.length > MAX_LINES) lines.push(`- and ${bad.length - MAX_LINES} more not shown`);
  lines.push("", "### Most common messages (redacted)");
  const byMessage = {};
  for (const r of bad) {
    const k = redact(r.message) || "(no message)";
    byMessage[k] = (byMessage[k] ?? 0) + 1;
  }
  const top = Object.entries(byMessage).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length === 0) lines.push("- none");
  for (const [k, v] of top) lines.push(`- ${v} x ${k}`);
  const first = events[0];
  if (first && typeof first === "object") {
    const names = (o) => (o && typeof o === "object" ? Object.keys(o).sort().join(", ") : "-");
    lines.push("", "### Shape of the first event (field names only, never values)");
    lines.push(`- top level: ${names(first)}`, `- $metadata: ${names(first.$metadata)}`, `- $workers: ${names(first.$workers)}`);
  }
  return lines.join("\n");
}

/** Run the query. Returns { text, exit }. `fetchImpl` is injected in tests. */
export async function run(argv, env, fetchImpl = fetch, now = Date.now()) {
  let args;
  try {
    args = parseArgs(argv, now);
  } catch (err) {
    return { text: `usage error: ${err.message}`, exit: 2 };
  }
  const token = env.CLOUDFLARE_API_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account || !/^[0-9a-f]{32}$/i.test(account)) return { text: "the deploy token or account id is not set for this run", exit: 2 };
  let res;
  try {
    res = await fetchImpl(ENDPOINT(account), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(args)),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return { text: `the query did not get an answer (${String(err?.name ?? "Error")})`, exit: 1 };
  }
  if (res.status === 401 || res.status === 403) {
    return { text: "the deploy token cannot read Workers Logs (needs Workers Observability read)", exit: 0 };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || json?.success === false) {
    const msgs = Array.isArray(json?.errors) ? json.errors.map((e) => redact(e?.message, 120)).filter(Boolean).slice(0, 3).join(" | ") : "";
    return { text: `the query failed: HTTP ${res.status}${msgs ? `, ${msgs}` : ""}`, exit: 1 };
  }
  const list = Array.isArray(json?.result?.events?.events) ? json.result.events.events : [];
  const total = num(json?.result?.events?.count);
  return { text: report(list, { ...args, truncated: total !== null && total > list.length }), exit: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { text, exit } = await run(process.argv.slice(2), process.env);
  console.log(text);
  process.exit(exit);
}
