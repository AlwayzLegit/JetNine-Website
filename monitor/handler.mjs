/**
 * The monitor's logic without the Workers runtime import, so `node --test` can
 * load it. worker.mjs wires it to the scheduled and fetch events.
 */
import { alertsConfigured, sendAlert } from "./alert.mjs";
import { CHECKS, runProbes } from "./probes.mjs";
import { nextRound } from "./round.mjs";
import { publicStatus } from "./status.mjs";

const stub = (env) => env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName("monitor"));

// The last instant a JavaScript Date can show (8.64e15 ms). Number.MAX_SAFE_INTEGER is
// finite but outside that range, and new Date(it).toISOString() throws a RangeError.
export const FAR_FUTURE_MS = 8_640_000_000_000_000;

export const quietUntilMs = (env) => {
  const t = Date.parse(env.QUIET_UNTIL ?? "");
  // A missing or broken value stays quiet forever: a monitor that cannot read its own setting must not page.
  // The sentinel is a date that can be shown, so GET /status still answers (OPS-60 review).
  return Number.isFinite(t) ? t : FAR_FUTURE_MS;
};

/** Each check's own quiet date, from the Worker variable it names. Broken or missing stays quiet, like QUIET_UNTIL. */
export const checkQuietMs = (env) =>
  Object.fromEntries(
    CHECKS.filter((c) => c.quietVar).map((c) => {
      const t = Date.parse(env[c.quietVar] ?? "");
      return [c.name, Number.isFinite(t) ? t : FAR_FUTURE_MS];
    }),
  );

// The alert log keeps the last 20 sends, and the mail path is tested once a week (OPS-169).
export const ALERT_LOG_KEPT = 20;
export const SELF_TEST_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

/** One round: probe, fold into the stored state, then alert and record every send. */
export async function runRound(env, deps = {}) {
  const now = deps.now ?? Date.now();
  const s = stub(env);
  const probes = await runProbes(env.SITE_URL, deps.probe ?? {});
  const prev = await s.get();
  const next = nextRound(prev, probes, now, quietUntilMs(env), checkQuietMs(env));
  // nextRound builds a fresh state, so what this file owns is carried over by hand.
  let alertLog = Array.isArray(prev?.alertLog) ? prev.alertLog : [];
  let selfTest = typeof prev?.selfTest === "number" ? prev.selfTest : null;
  let state = { ...next.state, alertLog, selfTest };
  await s.put(state);

  const events = [...next.events];
  // The weekly test of the mail path: only on a passing round with nothing else to send (a real
  // alert already tests the path), only when mail is configured, and never before the quiet date.
  const quiet = now < quietUntilMs(env);
  const due = selfTest === null || now - selfTest >= SELF_TEST_EVERY_MS;
  const selfTestNow = due && !quiet && events.length === 0 && next.state.ok && alertsConfigured(env);
  if (selfTestNow) {
    events.push({ type: "test", at: now });
    selfTest = now;
  }

  if (events.length > 0) {
    for (const event of events) {
      const { result, code } = await sendAlert(env, event, deps.fetchImpl ?? fetch, deps.log ?? console.log);
      alertLog = [...alertLog, { at: now, type: event.type, result, code }].slice(-ALERT_LOG_KEPT);
    }
    state = { ...state, alertLog, selfTest };
    await s.put(state);
  }
  return state;
}

/** GET /status from the stored state; 404 for everything else. Makes no outbound request. */
export async function handleFetch(request, env, now = Date.now()) {
  const url = new URL(request.url);
  if (url.pathname !== "/status" || request.method !== "GET") return new Response("Not found", { status: 404 });
  const answer = publicStatus(await stub(env).get(), now, {
    alertsConfigured: alertsConfigured(env),
    quietUntilMs: quietUntilMs(env),
  });
  return new Response(JSON.stringify(answer.body), {
    status: answer.status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
