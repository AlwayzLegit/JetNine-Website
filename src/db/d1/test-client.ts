import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// A D1-shaped drizzle client on a real SQLite (node:sqlite), for contract tests
// only (OPS-112). It applies the repo's own D1 migrations, so the CHECKs, the
// unique indexes, the foreign keys and the stored forms (JSON text, UTC
// milliseconds) are the real ones. Foreign keys are switched on first, as D1
// does; plain SQLite leaves them off.

const MIGRATIONS = new URL("./migrations/", import.meta.url);

export function freshD1(): { sqlite: DatabaseSync; client: DrizzleD1Database } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const text = readFileSync(new URL(f, MIGRATIONS), "utf8");
    for (const stmt of text.split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  const client = drizzle(async (query, params, method) => {
    const stmt = sqlite.prepare(query);
    const bound = params as never[];
    if (method === "run") {
      stmt.run(...bound);
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    if (method === "get") {
      const row = stmt.get(...bound) as unknown[] | undefined;
      return { rows: row as never };
    }
    return { rows: stmt.all(...bound) as unknown as unknown[][] };
  }) as unknown as DrizzleD1Database;
  return { sqlite, client };
}
