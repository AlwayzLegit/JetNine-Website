// What the Postgres to D1 copy (OPS-105) copies: every table of the D1 schema,
// in the D1 column order, with the column type that decides the mapping and the
// key columns the check compares. Read from the Drizzle D1 schema, so the list can
// never drift from the tables OPS-100 defined. Run through tsx (it reads TypeScript).
import { is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import * as ns from "../../src/db/d1/schema/index";

/**
 * Tables the copy never reads from Postgres: credential material, the rate limiter's
 * counters and the site chat's daily counters (D1 only, OPS-242). The copy wipes them in staging's D1 and loads nothing into them. Moving password
 * hashes is the owner's yes (OPS-93, "Rows still to file", item 3), and the same reasoning
 * holds for session, API key and AI provider key material. The counters (OPS-123) live for
 * minutes and their columns differ from the Postgres table, so there is nothing to carry over.
 */
export const HELD_BACK: Record<string, string> = {
  user_credentials: "password hashes",
  user_sessions: "session token hashes",
  api_keys: "API key hashes",
  ai_providers: "encrypted provider keys",
  request_rate_limits: "short-lived rate-limit counters, never copied",
  chat_daily: "D1 only (OPS-242): the site chat's daily counters, no Postgres table to copy from",
  lead_desk: "D1 only (OPS-373): one pointer row per lead sent to the Crew's Leads board, no Postgres table to copy from",
};

/**
 * What a production load holds back (OPS-197): only the rate limiter's counters. The credential tables are
 * copied as stored (hashed or sealed), because on cutover day every client must keep their password, every
 * API client its key and the voice line its AI provider. A production load runs only with the typed confirm,
 * on the owner's yes (map.mjs assertProductionLoad).
 */
export const HELD_BACK_PRODUCTION: Record<string, string> = {
  request_rate_limits: "short-lived rate-limit counters, never copied",
  chat_daily: "D1 only (OPS-242): the site chat's daily counters, no Postgres table to copy from",
  lead_desk: "D1 only (OPS-373): one pointer row per lead sent to the Crew's Leads board, no Postgres table to copy from",
};

export type CopyTarget = "staging" | "production";

/** The held-back tables of a target. */
export function heldBackFor(target: CopyTarget = "staging"): Record<string, string> {
  return target === "production" ? HELD_BACK_PRODUCTION : HELD_BACK;
}

/**
 * Where a production load reads a table when it is not `select * from public.X` (OPS-197). The password
 * hash is what the site's sign-in reads today on Postgres (store-pg.ts): the site's own credential row,
 * else Supabase's. A ban is auth.users.banned_until. Extra columns (`from_site`) are read for counts only
 * and never written: the load writes the D1 columns of the plan. Staging never uses these.
 */
export const PRODUCTION_SELECT: Record<string, string> = {
  users:
    "select u.*, a.banned_until from public.users u left join auth.users a on a.id = u.id",
  user_credentials:
    "select u.id as user_id, coalesce(c.password_hash, a.encrypted_password) as password_hash, " +
    "coalesce(c.updated_at, a.updated_at, a.created_at) as updated_at, (c.password_hash is not null) as from_site " +
    "from public.users u left join public.user_credentials c on c.user_id = u.id " +
    "left join auth.users a on a.id = u.id where coalesce(c.password_hash, a.encrypted_password, '') <> ''",
};

/**
 * Columns D1 has and Postgres does not, by table name. The copy neither reads nor writes them: they load
 * as NULL on staging. users.banned_until (OPS-174): on Postgres a ban is auth.users.banned_until, read in
 * place; D1 has no auth schema. A production load carries real bans across (PRODUCTION_SELECT); staging never does.
 */
export const D1_ONLY_COLUMNS: Record<string, string[]> = {
  users: ["banned_until"],
};

export type CopyColumn = { name: string; columnType: string };
export type CopyTable = {
  exportName: string;
  name: string;
  columns: CopyColumn[];
  pk: string;
  /** Primary key, then updated_at (else created_at) when the table has one. */
  keyColumns: string[];
  /** Tables this one has a foreign key to (itself left out), by name. */
  parents: string[];
  /**
   * Columns with a foreign key into a HELD_BACK table. Those tables load empty, so a
   * real value here would break the key: the copy writes NULL (OPS-115). All such
   * columns are nullable; copyPlan() throws if one is not.
   */
  nullRefs: string[];
};

// Under tsx the namespace import of a TypeScript module can arrive as { default }.
const schema: Record<string, unknown> = ((ns as unknown as { default?: Record<string, unknown> }).default ?? ns) as Record<string, unknown>;

/**
 * Parents before children (a load order that honours every foreign key), ties by name so
 * the order is stable. Throws, naming the tables, if the keys ever form a cycle.
 */
export function referentialOrder(tables: { name: string; parents: string[] }[]): string[] {
  const names = new Set(tables.map((t) => t.name));
  const waiting = new Map<string, Set<string>>();
  for (const t of tables) waiting.set(t.name, new Set(t.parents.filter((p) => names.has(p) && p !== t.name)));
  const order: string[] = [];
  while (waiting.size > 0) {
    const ready = [...waiting.entries()].filter(([, w]) => w.size === 0).map(([n]) => n).sort();
    if (ready.length === 0) {
      throw new Error(`foreign keys form a cycle between: ${[...waiting.keys()].sort().join(", ")}`);
    }
    // One table at a time keeps the order the plain sort of the ready names.
    const next = ready[0];
    order.push(next);
    waiting.delete(next);
    for (const w of waiting.values()) w.delete(next);
  }
  return order;
}

export function copyPlan(target: CopyTarget = "staging"): CopyTable[] {
  const held = heldBackFor(target);
  const out: CopyTable[] = [];
  for (const [exportName, t] of Object.entries(schema)) {
    if (!is(t, SQLiteTable)) continue;
    const cfg = getTableConfig(t as SQLiteTable);
    const skip = target === "production" ? [] : (D1_ONLY_COLUMNS[cfg.name] ?? []);
    const columns = cfg.columns.filter((c) => !skip.includes(c.name)).map((c) => ({ name: c.name, columnType: c.columnType }));
    const pks = cfg.columns.filter((c) => c.primary).map((c) => c.name);
    if (pks.length !== 1 || cfg.primaryKeys.length !== 0) {
      throw new Error(`${cfg.name}: the copy needs exactly one single-column primary key`);
    }
    const names = new Set(columns.map((c) => c.name));
    const stamp = names.has("updated_at") ? "updated_at" : names.has("created_at") ? "created_at" : null;
    const parents = new Set<string>();
    const nullRefs: string[] = [];
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const parent = getTableConfig(ref.foreignTable as SQLiteTable).name;
      if (parent !== cfg.name) parents.add(parent);
      // A held-back parent loads empty. A held-back child loads nothing, so it has no rows to break.
      if (held[parent] && !held[cfg.name]) {
        for (const col of ref.columns) {
          if (col.notNull) {
            throw new Error(`${cfg.name}.${col.name} is NOT NULL and points to the held-back table ${parent}: hold ${cfg.name} back too (the owner's call)`);
          }
          if (!nullRefs.includes(col.name)) nullRefs.push(col.name);
        }
      }
    }
    out.push({
      exportName,
      name: cfg.name,
      columns,
      pk: pks[0],
      keyColumns: stamp && stamp !== pks[0] ? [pks[0], stamp] : [pks[0]],
      parents: [...parents].sort(),
      nullRefs: nullRefs.sort(),
    });
  }
  const byName = new Map(out.map((t) => [t.name, t]));
  return referentialOrder(out).map((n) => byName.get(n)!);
}
