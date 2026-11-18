/**
 * The public answer of GET /status (OPS-60). The one place that decides what
 * leaves the Worker: it rebuilds the answer field by field from a fixed list, so
 * a field added to the stored state later is never exposed by accident, and every
 * free-text value is cut to the fixed vocabulary. Never a response body, a header
 * or a secret.
 */
import { DETAIL_WORDS } from "./probes.mjs";

// The fixed vocabulary of the alert log (OPS-169); anything else stored is cut to null or dropped.
const LOG_TYPES = ["start", "reminder", "recovery", "test"];
const LOG_RESULTS = ["sent", "skipped", "failed"];

export const STATUS_MAX_AGE_MS = 45 * 60 * 1000;

const clip = (s, n = 80) => String(s ?? "").slice(0, n);
const num = (n) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
// A Date can only show +/- 8.64e15 ms; beyond that toISOString throws, so such a value is shown as null
// and never lets /status fail.
const DATE_LIMIT_MS = 8_640_000_000_000_000;
const iso = (ms) => (typeof ms === "number" && Number.isFinite(ms) && Math.abs(ms) <= DATE_LIMIT_MS ? new Date(ms).toISOString() : null);
const list = (x, n) => (Array.isArray(x) ? x.slice(-n) : []);
const names = (x) => list(x, 10).map((n) => clip(n));

/** 503 when no round is stored or the last is over 45 minutes old: the monitor itself stopped. */
export function publicStatus(raw, now, { alertsConfigured, quietUntilMs }) {
  const s = raw && typeof raw === "object" ? raw : {};
  const checkedAtMs = typeof s.checkedAt === "number" ? s.checkedAt : null;
  const fresh = checkedAtMs !== null && now - checkedAtMs <= STATUS_MAX_AGE_MS;
  const canary = s.canary && typeof s.canary === "object" ? s.canary : null;
  return {
    status: fresh ? 200 : 503,
    body: {
      v: 1,
      ok: fresh && s.ok === true,
      checkedAt: iso(checkedAtMs),
      failingSince: iso(s.since),
      streak: num(s.streak),
      checks: list(s.checks, 10).map((c) => {
        const x = c && typeof c === "object" ? c : {};
        return {
          name: clip(x.name),
          ok: x.ok === true,
          ms: num(x.ms),
          detail: typeof x.detail === "string" && DETAIL_WORDS.test(x.detail) ? x.detail : "content check failed",
        };
      }),
      canary: canary ? { ok: canary.ok === true, ms: num(canary.ms) } : null,
      alerts: alertsConfigured ? "configured" : "not configured",
      // Each send of an alert mail and its outcome, never an address, a subject or a provider body.
      alerts_log: list(s.alertLog, 20)
        .filter((a) => a && typeof a === "object" && LOG_TYPES.includes(a.type) && LOG_RESULTS.includes(a.result))
        .map((a) => ({ at: iso(a.at), type: a.type, result: a.result, code: typeof a.code === "number" && Number.isFinite(a.code) ? a.code : null })),
      quietUntil: iso(quietUntilMs),
      wouldHaveRaised: list(s.wouldHaveRaised, 20).map((w) => ({ at: iso(w?.at), checks: names(w?.checks) })),
      incidents: list(s.incidents, 20).map((i) => ({
        from: iso(i?.from),
        to: iso(i?.to),
        checks: names(i?.checks),
        rounds: num(i?.rounds),
      })),
    },
  };
}
