/**
 * The write pause as the production smoke sees it (OPS-211, part of the cutover OPS-206).
 *
 * While the Worker setting WRITES_PAUSED is "cutover" (src/lib/writes-pause.mjs, OPS-205) the app
 * answers every request that writes with 503, Retry-After and the header x-jetnine-writes: paused.
 * That is a maintenance window (RFC 9110 15.6.4), so the post-deploy smoke must read the deploy of
 * the pause as green, and must still fail on a real fault: a paused site that answers a writing
 * request with anything but that exact 503 is wrong, and an unpaused site is judged as before.
 *
 * Kept apart from scripts/smoke-prod.mts so the rule can be tested without a network.
 */
import { PAUSE_HEADER, blocksRequest } from "../src/lib/writes-pause.mjs";

export type PausedReply = { status: number; headers: Headers };
export type Verdict = { ok: boolean; detail: string };

/** True when a response carries the pause header with the value the Worker sets. */
export function isPausedReply(reply: PausedReply): boolean {
  return reply.headers.get(PAUSE_HEADER) === "paused";
}

/**
 * The verdict for a check that the pause turns into a 503, or null when the normal check applies.
 *
 * @param paused whether the site's home page carried the pause header
 * @param method the request method of the check
 * @param path the request path of the check
 * @param reply the answer to that request
 */
export function pausedVerdict(paused: boolean, method: string, path: string, reply: PausedReply): Verdict | null {
  if (!paused || !blocksRequest(method, path)) return null;
  if (reply.status === 503 && isPausedReply(reply)) {
    return { ok: true, detail: "503 · writes paused (expected during the cutover window)" };
  }
  return { ok: false, detail: `writes are paused but this answered ${reply.status} (expected 503 with ${PAUSE_HEADER}: paused)` };
}
