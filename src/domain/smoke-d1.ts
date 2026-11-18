import { sql, type SQL } from "drizzle-orm";
import { quotes } from "@/db/d1/schema/quotes";

/**
 * D1 twin of IS_SMOKE / NOT_SMOKE in common.ts (OPS-154): the quotes the post-deploy smoke
 * suite submits, flagged by a "[SMOKE]" first name or a smoke+ email. Kept apart from
 * common.ts so no Postgres module imports the D1 schema.
 *
 * json_extract reads the snapshot, which D1 keeps as JSON text. `like` is case-insensitive for
 * ASCII in SQLite and lower() makes that explicit; "[" is not special in SQLite LIKE, so
 * "[smoke]%" is the literal prefix. coalesce: a missing name or email makes `like` NULL, and
 * `not NULL` would hide the row from every desk list (the same trap as on Postgres).
 */
export const IS_SMOKE_D1: SQL = sql`(
  coalesce(lower(json_extract(${quotes.contactSnapshot}, '$.firstName')) like '[smoke]%', 0)
  or coalesce(lower(json_extract(${quotes.contactSnapshot}, '$.email')) like 'smoke+%', 0)
)`;
export const NOT_SMOKE_D1: SQL = sql`not ${IS_SMOKE_D1}`;
