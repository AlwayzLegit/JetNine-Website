import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/sqlite-core";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

// Defaults and checks that Postgres ran in the database, now run in the app
// (OPS-100). Used only by src/db/d1/schema/*.

/** uuid column default: a random v4 uuid as text. */
export const newId = (): string => crypto.randomUUID();

/** timestamp column default: the instant of the insert (stored as UTC ms). */
export const nowDate = (): Date => new Date();

/** timestamp column default: now plus a number of milliseconds. */
export const inFuture = (ms: number): Date => new Date(Date.now() + ms);

/** date column default: today's date in UTC, "YYYY-MM-DD". */
export const todayText = (): string => new Date().toISOString().slice(0, 10);

/** 24 random bytes as 48 hex characters (the old encode(gen_random_bytes(24), 'hex')). */
export const hexToken24 = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * CHECK that a text column holds one of an enum's values. Drizzle's sqlite
 * `enum` option is only a TypeScript type, so the database needs this too.
 * NULL passes, as it does for a Postgres enum column.
 */
export function enumCheck(name: string, column: SQLiteColumn, values: readonly string[]) {
  const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return check(name, sql`${column} in (${sql.raw(list)})`);
}

/** D1 allows 100 bound values per statement, so every id list is read or written in chunks of this size. */
export const ID_CHUNK = 50;

/** Split a list into chunks of ID_CHUNK (OPS-154: moved here from the member store, now shared). */
export function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
  return out;
}
