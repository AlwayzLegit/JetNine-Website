/**
 * jetnine-monitor (OPS-60): a small Worker that checks the site from outside it
 * every 15 minutes and serves GET /status. It keeps answering when the site does
 * not. State lives in one Durable Object (SQLite), declared in wrangler.jsonc, so
 * no namespace id and no dashboard step. The logic is in handler.mjs.
 */
import { DurableObject } from "cloudflare:workers";
import { handleFetch, runRound } from "./handler.mjs";

const KEY = "state";

export class MonitorState extends DurableObject {
  async get() {
    return (await this.ctx.storage.get(KEY)) ?? null;
  }
  async put(state) {
    await this.ctx.storage.put(KEY, state);
  }
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRound(env));
  },
  fetch: (request, env) => handleFetch(request, env),
};
