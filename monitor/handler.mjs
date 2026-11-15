/**
 * The monitor's logic without the Workers runtime import, so `node --test` can
 * load it. worker.mjs wires it to the scheduled and fetch events.
 */
import { alertsConfigured, sendAlert } from "./alert.mjs";
import { runProbes } from "./probes.mjs";
import { nextRound } from "./round.mjs";
import { publicStatus } from "./status.mjs";

const stub = (env) => env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName("monitor"));

export const quietUntilMs = (env) => {
  const t = Date.parse(env.QUIET_UNTIL ?? "");
  // A missing or broken value stays quiet forever: a monitor that cannot read its own setting must not page.
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

/** One round: probe, fold into the stored state, then alert. */
export async function runRound(env, deps = {}) {
  const now = deps.now ?? Date.now();
  const s = stub(env);
  const probes = await runProbes(env.SITE_URL, deps.probe ?? {});
  const { state, events } = nextRound(await s.get(), probes, now, quietUntilMs(env));
  await s.put(state);
  for (const event of events) await sendAlert(env, event, deps.fetchImpl ?? fetch, deps.log ?? console.log);
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
