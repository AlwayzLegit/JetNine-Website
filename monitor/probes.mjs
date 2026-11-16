/**
 * The monitor's HTTP probes (OPS-60). Depends on nothing but fetch, so it runs
 * in a Worker and under `node --test`. GET only: it never sends a form.
 *
 * A failed check is tried once more after RETRY_WAIT_MS before the round counts
 * it as failed, the way the GitHub health workflow does. The canary proves the
 * probes can see a failure; it never counts as a site problem.
 */
export const PROBE_TIMEOUT_MS = 15_000;
export const RETRY_WAIT_MS = 30_000;
export const USER_AGENT = "jetnine-monitor/1";
export const CANARY_PATH = "/monitor-canary-does-not-exist";

/** The fixed words /status may show as a check's detail. */
export const DETAIL_WORDS = /^(HTTP [1-5]\d\d|no response|content check failed|unhealthy)$/;

const hasText = (text) => (body) => body.includes(text);
const healthy = (body) => {
  try {
    return JSON.parse(body)?.ok === true;
  } catch {
    return false;
  }
};

// OPS-90: /api/health lists "auth" in `failing` when Supabase Auth, the provider
// sign-in goes through, does not answer 200 (a restricted project answers 402).
// The answer stays 200 then, so "API health" above does not notice.
const signInServiceUp = (body) => {
  try {
    const failing = JSON.parse(body)?.failing;
    return !(Array.isArray(failing) && failing.includes("auth"));
  } catch {
    return false;
  }
};

/**
 * The checks: /api/health plus the project sheet's money pages. A check with a
 * quietVar has its own quiet date, read from that variable of the Worker: a new
 * alarm starts quiet for 24 hours (see round.mjs).
 */
export const CHECKS = [
  { name: "API health", path: "/api/health", ok: healthy, failWord: "unhealthy" },
  { name: "Sign-in service", path: "/api/health", ok: signInServiceUp, failWord: "unhealthy", quietVar: "SIGNIN_QUIET_UNTIL" },
  { name: "Home page", path: "/", ok: hasText("JetNine") },
  { name: "Contact page", path: "/contact", ok: hasText("Contact 24/7") },
  { name: "Cost calculator", path: "/cost-calculator", ok: hasText("Private Jet Cost Calculator") },
];

const join = (site, path) => `${site.replace(/\/$/, "")}${path}`;

/** One read of one check. Never throws; the detail is always one of DETAIL_WORDS. */
export async function probeOnce(check, site, fetchImpl, now = Date.now) {
  const started = now();
  try {
    const res = await fetchImpl(join(site, check.path), {
      method: "GET",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = await res.text();
    const ms = now() - started;
    if (res.status !== 200) return { name: check.name, ok: false, ms, detail: `HTTP ${res.status}` };
    if (!check.ok(body)) return { name: check.name, ok: false, ms, detail: check.failWord ?? "content check failed" };
    return { name: check.name, ok: true, ms, detail: "HTTP 200" };
  } catch {
    return { name: check.name, ok: false, ms: now() - started, detail: "no response" };
  }
}

async function probeWithRetry(check, site, fetchImpl, sleep, now) {
  const first = await probeOnce(check, site, fetchImpl, now);
  if (first.ok) return first;
  await sleep(RETRY_WAIT_MS);
  return probeOnce(check, site, fetchImpl, now);
}

/** A path that does not exist must answer 404: ok means "the probe saw the failure as it should". */
export async function canary(site, fetchImpl, now = Date.now) {
  const started = now();
  try {
    const res = await fetchImpl(join(site, CANARY_PATH), {
      method: "GET",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    await res.text();
    return { ok: res.status === 404, ms: now() - started };
  } catch {
    return { ok: false, ms: now() - started };
  }
}

/** Every check of one round, side by side, plus the canary. */
export async function runProbes(site, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  const [checks, can] = await Promise.all([
    Promise.all(CHECKS.map((c) => probeWithRetry(c, site, fetchImpl, sleep, now))),
    canary(site, fetchImpl, now),
  ]);
  return { checks, canary: can };
}
