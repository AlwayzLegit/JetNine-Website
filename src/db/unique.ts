/**
 * True when an insert failed on a unique index, on either database: Postgres reports SQLSTATE
 * 23505, D1 (SQLite) a message that starts "UNIQUE constraint failed". drizzle and the D1 driver
 * wrap errors, so the cause chain is read (four levels at most).
 */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e && typeof e === "object"; depth++) {
    const { code, message, cause } = e as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "23505") return true;
    if (typeof message === "string" && /UNIQUE constraint failed/i.test(message)) return true;
    e = cause;
  }
  return false;
}
