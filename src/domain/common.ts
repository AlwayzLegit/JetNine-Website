import { sql, type SQL } from "drizzle-orm";
import { quotes } from "@/db/schema/quotes";

/**
 * Bits shared by the domain query modules. Keep this file free of
 * server-only imports: scripts/check-api.mts loads the route registry
 * under tsx, where `server-only` does not resolve.
 */

/** Post-deploy smoke tests submit real quotes flagged by a "[SMOKE]" first name or a smoke+ email. */
export const NOT_SMOKE: SQL = sql`not (
  ${quotes.contactSnapshot}->>'firstName' ilike '[SMOKE]%'
  or ${quotes.contactSnapshot}->>'email' ilike 'smoke+%'
)`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Escape a user search term for `ilike` and wrap it in wildcards. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Raw sql`` parameters bypass the column serializers, and the postgres-js
 * driver rejects Date objects there. Use this for any date in a raw template.
 */
export function isoParam(d: Date): string {
  return d.toISOString();
}

/** Cut a free-text query to a sane length. */
export function searchTerm(v: string | undefined, max = 80): string {
  return (v ?? "").trim().slice(0, max);
}
