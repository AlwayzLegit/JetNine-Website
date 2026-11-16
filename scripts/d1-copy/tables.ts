// What the Postgres to D1 copy (OPS-105) copies: every table of the D1 schema,
// in the D1 column order, with the column type that decides the mapping and the
// key columns the check compares. Read from the Drizzle D1 schema, so the list can
// never drift from the tables OPS-100 defined. Run through tsx (it reads TypeScript).
import { is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import * as ns from "../../src/db/d1/schema/index";

/**
 * Tables that hold credential material. The copy wipes them in staging's D1 and loads
 * nothing into them, and it never reads them from Postgres. Moving password hashes is
 * the owner's yes (OPS-93, "Rows still to file", item 3), and the same reasoning holds
 * for session, API key and AI provider key material.
 */
export const HELD_BACK: Record<string, string> = {
  user_credentials: "password hashes",
  user_sessions: "session token hashes",
  api_keys: "API key hashes",
  ai_providers: "encrypted provider keys",
};

export type CopyColumn = { name: string; columnType: string };
export type CopyTable = {
  exportName: string;
  name: string;
  columns: CopyColumn[];
  pk: string;
  /** Primary key, then updated_at (else created_at) when the table has one. */
  keyColumns: string[];
};

// Under tsx the namespace import of a TypeScript module can arrive as { default }.
const schema: Record<string, unknown> = ((ns as unknown as { default?: Record<string, unknown> }).default ?? ns) as Record<string, unknown>;

export function copyPlan(): CopyTable[] {
  const out: CopyTable[] = [];
  for (const [exportName, t] of Object.entries(schema)) {
    if (!is(t, SQLiteTable)) continue;
    const cfg = getTableConfig(t as SQLiteTable);
    const columns = cfg.columns.map((c) => ({ name: c.name, columnType: c.columnType }));
    const pks = cfg.columns.filter((c) => c.primary).map((c) => c.name);
    if (pks.length !== 1 || cfg.primaryKeys.length !== 0) {
      throw new Error(`${cfg.name}: the copy needs exactly one single-column primary key`);
    }
    const names = new Set(columns.map((c) => c.name));
    const stamp = names.has("updated_at") ? "updated_at" : names.has("created_at") ? "created_at" : null;
    out.push({
      exportName,
      name: cfg.name,
      columns,
      pk: pks[0],
      keyColumns: stamp && stamp !== pks[0] ? [pks[0], stamp] : [pks[0]],
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
