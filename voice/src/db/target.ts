// Which database the voice Worker talks to (OPS-137, OPS-176). The same rule as the
// site's src/db/target.mjs (OPS-99), copied rather than imported because
// voice/ is its own package: anything that is not exactly "d1" means
// Postgres. Production needs two settings: DB_TARGET "d1" AND DB_CUTOVER
// exactly "production-d1" (set by the cutover row and nowhere else).

export type DbTarget = "postgres" | "d1";

/** The only value of DB_CUTOVER that lets production use D1. Compared exactly. */
export const PRODUCTION_CUTOVER = "production-d1";

export function parseDbTarget(value: unknown, deployEnv: unknown, cutover?: unknown): DbTarget {
  if (typeof value !== "string") return "postgres";
  if (value.trim() !== "d1") return "postgres";
  if (deployEnv === "production") return cutover === PRODUCTION_CUTOVER ? "d1" : "postgres";
  return "d1";
}
