import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { deployEnv } from "@/lib/deploy-env";
import { parseDbTarget } from "./target.mjs";

// The D1 side of the database move (OPS-99). Nothing reads it yet: `db` in
// ./index.ts stays on Postgres until a domain's queries exist for D1 (later
// rows). Production has no DB binding and parseDbTarget refuses "d1" there.

export type DbTarget = "postgres" | "d1";

type D1Binding = Parameters<typeof drizzle>[0];

function cfEnv(): { DB?: D1Binding; DB_TARGET?: string } | null {
  try {
    return getCloudflareContext().env as { DB?: D1Binding; DB_TARGET?: string };
  } catch {
    return null; // not inside a Cloudflare request
  }
}

/** The database this deployment uses: a fixed word, "postgres" or "d1". */
export function dbTarget(): DbTarget {
  const raw = cfEnv()?.DB_TARGET ?? process.env.DB_TARGET;
  return parseDbTarget(raw, deployEnv());
}

// One client per request, keyed on the request's ExecutionContext, the same
// pattern as hyperdriveConn() in ./index.ts.
const byRequest = new WeakMap<object, DrizzleD1Database>();

/** The D1 client for this request, or null when the DB binding is absent. */
export function d1Db(): DrizzleD1Database | null {
  let cf: ReturnType<typeof getCloudflareContext>;
  try {
    cf = getCloudflareContext();
  } catch {
    return null;
  }
  const binding = (cf.env as { DB?: D1Binding }).DB;
  if (!binding) return null;
  const key = cf.ctx as object;
  let client = byRequest.get(key);
  if (!client) {
    client = drizzle(binding);
    byRequest.set(key, client);
  }
  return client;
}

/** For the health probe: the raw binding, or null. */
export function d1Binding(): D1Binding | null {
  return cfEnv()?.DB ?? null;
}
