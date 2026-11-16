#!/usr/bin/env node
/**
 * Summarise `wrangler tail --format json` output for the post-deploy window
 * (OPS-104). Keeps only events whose outcome is not "ok" and prints, per
 * Worker, a count per outcome plus one line per event: time, method, path
 * without query string, outcome, response status, exception name.
 *
 * It never prints headers, query strings, bodies, log lines or exception
 * messages, and path segments that look like a token or id are masked. The
 * raw tail is read from a file and never uploaded.
 *
 * Usage: node scripts/deploy-tail/summarize.mjs <worker>=<file> [<worker>=<file> ...]
 * Output: markdown on stdout (the job summary and the artifact).
 */
import { readFileSync, existsSync } from "node:fs";

const MAX_LINES_PER_WORKER = 50;
// The next path segment after these is a secret or a token, whatever it looks like.
const SECRET_AFTER = ["/api/email/inbound/", "/api/email/unsubscribe/", "/downloads/", "/auth/"];

export function maskSegment(segment) {
  if (/\d{6,}/.test(segment)) return "<id>";
  if (segment.length >= 16 && /\d/.test(segment)) return "<id>";
  if (segment.length >= 20 && !/^[a-z]+(-[a-z]+)*$/.test(segment)) return "<id>";
  return segment;
}

/** Path only: no query, no fragment, no host, tokens masked. */
export function safePath(rawUrl) {
  let pathname;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return "(unreadable url)";
  }
  let out = pathname;
  for (const prefix of SECRET_AFTER) {
    const i = out.indexOf(prefix);
    if (i !== -1) {
      const rest = out.slice(i + prefix.length);
      const slash = rest.indexOf("/");
      out = out.slice(0, i + prefix.length) + "<redacted>" + (slash === -1 ? "" : rest.slice(slash));
    }
  }
  out = out
    .split("/")
    .map((s) => (s === "<redacted>" ? s : maskSegment(s)))
    .join("/");
  return out.length > 120 ? out.slice(0, 117) + "..." : out;
}

/** Parse tail output: one JSON object per line; anything else is skipped and counted. */
export function parseTail(text) {
  const events = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object" && "outcome" in obj) events.push(obj);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { events, skipped };
}

function when(ts) {
  const d = new Date(typeof ts === "number" ? ts : Number.NaN);
  return Number.isNaN(d.getTime()) ? "??:??:??" : d.toISOString().slice(11, 23) + "Z";
}

export function summarizeWorker(name, text) {
  const { events, skipped } = parseTail(text);
  const counts = {};
  for (const e of events) counts[String(e.outcome)] = (counts[String(e.outcome)] ?? 0) + 1;
  const notOk = events.filter((e) => e.outcome !== "ok");
  const times = events.map((e) => e.eventTimestamp).filter((t) => typeof t === "number").sort((a, b) => a - b);
  const lines = [];
  lines.push(`### ${name}`);
  if (events.length === 0) {
    lines.push(`No events seen${skipped ? ` (${skipped} lines were not events)` : ""}.`);
    return { markdown: lines.join("\n"), total: 0, notOk: 0 };
  }
  lines.push(
    `${events.length} events from ${when(times[0])} to ${when(times[times.length - 1])}, ${notOk.length} not ok. ` +
      `Outcomes: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}.` +
      (skipped ? ` ${skipped} lines were not events.` : ""),
  );
  for (const e of notOk.slice(0, MAX_LINES_PER_WORKER)) {
    const req = e.event?.request;
    const where = req ? `${String(req.method ?? "?")} ${safePath(String(req.url ?? ""))}` : "(no request)";
    const status = e.event?.response?.status;
    const exceptions = Array.isArray(e.exceptions) ? [...new Set(e.exceptions.map((x) => String(x?.name ?? "Error")))] : [];
    lines.push(
      `- ${when(e.eventTimestamp)} ${where} outcome ${String(e.outcome)}` +
        (status ? ` status ${status}` : "") +
        (exceptions.length ? ` exception ${exceptions.join(", ")}` : ""),
    );
  }
  if (notOk.length > MAX_LINES_PER_WORKER) lines.push(`- and ${notOk.length - MAX_LINES_PER_WORKER} more not shown`);
  return { markdown: lines.join("\n"), total: events.length, notOk: notOk.length };
}

export function summarize(pairs) {
  const parts = ["## Deploy tail summary", ""];
  let notOk = 0;
  for (const [name, file] of pairs) {
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const r = summarizeWorker(name, text);
    notOk += r.notOk;
    parts.push(r.markdown, "");
  }
  parts.push(`Not ok outcomes in the window: ${notOk}. Read the times against the smoke and sitemap jobs of the same run.`);
  return parts.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pairs = process.argv.slice(2).map((a) => {
    const i = a.indexOf("=");
    return [a.slice(0, i), a.slice(i + 1)];
  });
  console.log(summarize(pairs));
}
