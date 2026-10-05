import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Why this dance: Next.js statically analyzes route modules during
// `next build` on Vercel. Any module that throws at load time (because
// an env var is missing) crashes the build, even if the route is
// dynamic and would resolve at request time anyway. We defer the env
// check until first DB access so the build phase always succeeds, then
// surfaces a clean runtime error if the var really is missing.

const url = process.env.DATABASE_URL;
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!url && !isBuildPhase) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
}

// During build with no env, hand postgres-js a syntactically-valid stub
// URL. postgres-js doesn't connect until a query runs. A few build-time
// reads (the quote layout's reply promise) do query; they catch the
// connection error and fall back to defaults. Otherwise no query
// runs during `next build` because all DB-touching routes are
// `force-dynamic`. If a future route is wrongly statically rendered and
// reaches for the DB, the failure happens at query time with a clear
// connection error — not a confusing module-load error.
//
// In development, every hot reload re-evaluates this module; caching the
// client on globalThis keeps one pool per dev server instead of leaking a
// new one per reload (which eventually exhausts Postgres connections).
const globalForDb = globalThis as unknown as { __jnSql?: ReturnType<typeof postgres> };
const sqlClient =
  globalForDb.__jnSql ??
  postgres(url ?? "postgresql://build-stub:0@localhost:1/stub", {
    prepare: false,
    max: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__jnSql = sqlClient;

export const db = drizzle(sqlClient);
export const sql = sqlClient;
