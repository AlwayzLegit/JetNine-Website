// Which database the data layer uses (OPS-99, OPS-176). A plain module, like
// src/lib/session/core.mjs, so `node --test` can load it without a build.
//
// Anything that is not exactly "d1" means Postgres. Outside production "d1" is
// honoured. Production needs TWO settings (OPS-176): DB_TARGET "d1" AND
// DB_CUTOVER exactly "production-d1". The second key is set by the cutover
// row and nowhere else, so a stray DB_TARGET can never move production, and
// the way back is the same flip (remove DB_CUTOVER).

/** The only value of DB_CUTOVER that lets production use D1. Compared exactly: no trim, no case folding. */
export const PRODUCTION_CUTOVER = "production-d1";

/**
 * @param {unknown} value the DB_TARGET setting
 * @param {string} deployEnv "production", "staging", "development", ...
 * @param {unknown} [cutover] the DB_CUTOVER setting; read only in production
 * @returns {"postgres" | "d1"}
 */
export function parseDbTarget(value, deployEnv, cutover) {
  if (typeof value !== "string") return "postgres";
  if (value.trim() !== "d1") return "postgres";
  if (deployEnv === "production") return cutover === PRODUCTION_CUTOVER ? "d1" : "postgres";
  return "d1";
}
