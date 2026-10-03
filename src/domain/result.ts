/**
 * Domain results. Commands and queries never throw across the boundary;
 * they return a Result whose `code` maps to an HTTP status in the API and
 * to a plain sentence in the admin UI.
 */

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "rate_limited"
  | "unavailable"
  | "internal";

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; code: ErrorCode; error: string; details?: unknown };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (code: ErrorCode, error: string, details?: unknown): Err => ({ ok: false, code, error, details });

export const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 422,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

/**
 * The first validation issue as a desk sentence, e.g.
 * "Year of make: Too big: expected number to be <=2100". Null when the
 * error carries no issues.
 */
export function issueWords(r: Err): string | null {
  const issue = (r.details as { path?: PropertyKey[]; message?: string }[] | undefined)?.[0];
  if (!issue?.message) return null;
  const field = issue.path?.filter((k): k is string => typeof k === "string").join(".");
  const words = field ? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()) : null;
  return words ? `${words}: ${issue.message}` : issue.message;
}
