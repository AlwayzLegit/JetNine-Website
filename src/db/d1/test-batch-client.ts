import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// A D1-shaped drizzle client on a real SQLite (node:sqlite), for contract tests
// only (OPS-113). Like the client OPS-112 adds (src/db/d1/test-client.ts) it
// applies the repo's own D1 migrations with foreign keys on, as D1 does, and it
// adds what D1 has and a plain proxy client lacks: db.batch(), which here runs
// its statements in one transaction and rolls all of them back when one fails,
// as D1's batch does. Once OPS-112 is on main, the two can become one file.

const MIGRATIONS = new URL("./migrations/", import.meta.url);

type Call = { sql: string; params: unknown[]; method: "run" | "all" | "values" | "get" };

export function freshD1WithBatch(): { sqlite: DatabaseSync; client: DrizzleD1Database } {
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

  const exec = (c: Call): { rows: unknown } => {
    const stmt = sqlite.prepare(c.sql);
    const bound = c.params as never[];
    if (c.method === "run") {
      stmt.run(...bound);
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    if (c.method === "get") {
      return { rows: stmt.get(...bound) as unknown[] | undefined };
    }
    return { rows: stmt.all(...bound) as unknown as unknown[][] };
  };

  const client = drizzle(
    async (query, params, method) => exec({ sql: query, params, method }) as never,
    async (queries) => {
      // One transaction for the whole batch: all of it or none of it.
      sqlite.exec("BEGIN");
      try {
        const out = queries.map((q) => exec(q as Call));
        sqlite.exec("COMMIT");
        return out as never;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  ) as unknown as DrizzleD1Database;
  return { sqlite, client };
}
