// Which database the data layer uses (OPS-99). A plain module, like
// src/lib/session/core.mjs, so `node --test` can load it without a build.
//
// Anything that is not exactly "d1" means Postgres, and production can never
// choose D1 from this setting alone: the cutover row lifts that on purpose.

/**
 * @param {unknown} value the DB_TARGET setting
 * @param {string} deployEnv "production", "staging", "development", ...
 * @returns {"postgres" | "d1"}
 */
export function parseDbTarget(value, deployEnv) {
  if (typeof value !== "string") return "postgres";
  if (value.trim() !== "d1") return "postgres";
  if (deployEnv === "production") return "postgres";
  return "d1";
}
