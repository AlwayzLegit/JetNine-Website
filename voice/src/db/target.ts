// Which database the voice Worker talks to (OPS-137). The same rule as the
// site's src/db/target.mjs (OPS-99), copied rather than imported because
// voice/ is its own package: anything that is not exactly "d1" means
// Postgres, and production can never choose D1 from this setting alone (the
// cutover row lifts that on purpose).

export type DbTarget = "postgres" | "d1";

export function parseDbTarget(value: unknown, deployEnv: unknown): DbTarget {
  if (typeof value !== "string") return "postgres";
  if (value.trim() !== "d1") return "postgres";
  if (deployEnv === "production") return "postgres";
  return "d1";
}
