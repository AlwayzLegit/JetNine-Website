import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type Conn = { sql: Sql; db: PostgresJsDatabase };

const OPTIONS = { prepare: false } as const;

// Two ways to reach Postgres:
//
// 1. On Cloudflare Workers, through the HYPERDRIVE binding. A Worker may not
//    reuse a socket opened by another request ("Cannot perform I/O on behalf
//    of a different request"), so each request gets its own postgres.js
//    client, keyed on the request's ExecutionContext. Hyperdrive pools the
//    real connections to Supabase, so opening one per request is cheap.
//
// 2. Everywhere else (`next build`, `next dev` without bindings, scripts),
//    one module-level client from DATABASE_URL, created on first use.
//
// `db` and `sql` below are proxies that resolve to the right client at call
// time, so the 80-odd modules importing them keep their existing imports.

const byRequest = new WeakMap<object, Conn>();

function hyperdriveConn(): Conn | null {
  let cf: ReturnType<typeof getCloudflareContext>;
  try {
    cf = getCloudflareContext();
  } catch {
    return null; // not inside a Cloudflare request
  }
  const hyperdrive = (cf.env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
  if (!hyperdrive) return null;

  const requestKey = cf.ctx as object; // one ExecutionContext per request
  let conn = byRequest.get(requestKey);
  if (!conn) {
    const sqlClient = postgres(hyperdrive.connectionString, { ...OPTIONS, max: 5 });
    conn = { sql: sqlClient, db: drizzle(sqlClient) };
    byRequest.set(requestKey, conn);
  }
  return conn;
}

// Why the stub URL: Next.js statically analyzes route modules during
// `next build`. Any module that throws at load time (because an env var is
// missing) crashes the build, even if the route is dynamic. postgres-js
// doesn't connect until a query runs, so the build gets a syntactically
// valid stub and a missing DATABASE_URL surfaces at query time instead. A
// few build-time reads (the quote layout's reply promise) do query; they
// catch the connection error and fall back to defaults.
//
// In development, every hot reload re-evaluates this module; caching the
// client on globalThis keeps one pool per dev server instead of leaking a
// new one per reload (which eventually exhausts Postgres connections).
const globalForDb = globalThis as unknown as { __jnConn?: Conn };

function processConn(): Conn {
  if (globalForDb.__jnConn) return globalForDb.__jnConn;
  const url = process.env.DATABASE_URL;
  if (!url && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
  }
  const sqlClient = postgres(url ?? "postgresql://build-stub:0@localhost:1/stub", {
    ...OPTIONS,
    max: 10,
  });
  const conn = { sql: sqlClient, db: drizzle(sqlClient) };
  globalForDb.__jnConn = conn;
  return conn;
}

function current(): Conn {
  return hyperdriveConn() ?? processConn();
}

function bound<T extends object>(target: T, prop: PropertyKey): unknown {
  const value = Reflect.get(target, prop, target);
  return typeof value === "function" ? value.bind(target) : value;
}

export const db = new Proxy({} as PostgresJsDatabase, {
  get: (_t, prop) => bound(current().db, prop),
});

// `sql` is called as a tagged template, so the proxy target must be callable.
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_t, thisArg, args) => Reflect.apply(current().sql, thisArg, args),
  get: (_t, prop) => bound(current().sql, prop),
});
