import { env } from "cloudflare:workers";

// Worker vars and secrets (wrangler.jsonc `vars`, `wrangler secret put`,
// .dev.vars locally) as plain strings, read once per isolate. This replaces
// process.env: config.ts and secretbox.ts read from here. It is a mutable
// copy so tests can set values before importing the modules that read them.
export const vars: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(env as unknown as Record<string, unknown>).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  ),
);
