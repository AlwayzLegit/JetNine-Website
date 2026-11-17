// The local dry load of the Postgres to D1 copy (OPS-115). Before staging's D1 is touched,
// the whole load is run against an in-memory SQLite database that has the same tables
// (the repo's own D1 migrations). A rule that real data does not meet is then named here,
// by table and rule, and staging D1 stays as it was. No imports from the network or from
// Cloudflare. Nothing printed from here carries a row value: only table names, constraint
// kinds and names, and counts. SQLite's own message is reduced by constraintDetail().
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { constraintDetail } from "./map.mjs";

/** node:sqlite is built into Node 22 (the workflow uses 22). Throws a short message if it is missing. */
export async function openMemoryDb() {
  let mod;
  try {
    mod = await import("node:sqlite");
  } catch {
    throw new Error("node:sqlite is not available in this Node, so the preflight cannot run");
  }
  // Foreign keys off while loading, as with D1's deferred keys; they are checked at the end.
  return new mod.DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
}

/** Every .sql file of the D1 migrations folder, in name order (0000_ first). */
export function readMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"));
}

export function applyMigrations(db, sqls) {
  for (const s of sqls) db.exec(s);
}

/**
 * Run one table's INSERT text. Returns { ok: true } or { ok: false, detail } where detail
 * is the constraint kind and its schema names.
 */
export function loadTable(db, sqlText) {
  try {
    db.exec(sqlText);
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: constraintDetail(err?.message ?? "") };
  }
}

/**
 * Foreign keys that the loaded rows break, grouped by child table and parent table:
 * [{ table, parent, rows }]. Names and counts only.
 */
export function foreignKeyReport(db) {
  const rows = db.prepare("PRAGMA foreign_key_check").all();
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.table}\u0000${r.parent}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([k, rowsCount]) => {
      const [table, parent] = k.split("\u0000");
      return { table, parent, rows: rowsCount };
    })
    .sort((a, b) => (a.table + a.parent).localeCompare(b.table + b.parent));
}

export const failLine = (table, detail) => `preflight FAIL ${table}: ${detail}`;
export const fkLine = ({ table, parent, rows }) =>
  `preflight FAIL ${table}: FOREIGN KEY ${table} -> ${parent}: ${rows} row${rows === 1 ? "" : "s"}`;
