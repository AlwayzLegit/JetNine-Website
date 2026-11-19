// Build a throwaway Postgres from the repo's own migrations (OPS-198).
//
//   DATABASE_URL=postgresql://ci:ci@localhost:5432/ci node scripts/d1-copy/rehearsal/apply.mjs
//
// Runs supabase-stubs.sql, then every migration of src/db/migrations in the order of
// meta/_journal.json, each in its own transaction, and prints "migrations applied: N".
// Refuses any host but localhost or 127.0.0.1 (local.mjs), before connecting. On a failure
// it prints the file name and the error code only, never the SQL or the server's message.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { assertLocalDatabase } from "./local.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "../../../src/db/migrations");

/** The migration tags of the journal, in order. */
export function journalTags(dir = MIGRATIONS) {
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  return journal.entries.map((e) => e.tag);
}

async function main() {
  assertLocalDatabase(process.env.DATABASE_URL);
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 30, onnotice: () => {} });
  let applied = 0;
  try {
    // A second run on the same database would half-apply: the bed is built once, on an empty database.
    const [{ tables }] = await sql`select count(*)::int as tables from information_schema.tables where table_schema = 'public'`;
    if (tables > 0) throw Object.assign(new Error("not empty"), { code: "database_not_empty" });
    await sql.unsafe(readFileSync(join(HERE, "supabase-stubs.sql"), "utf8"));
    for (const tag of journalTags()) {
      const text = readFileSync(join(MIGRATIONS, `${tag}.sql`), "utf8");
      try {
        // One simple-protocol call holds all statements of the file; begin/commit makes it one unit.
        await sql.begin((tx) => tx.unsafe(text));
      } catch (err) {
        console.error(`migration ${tag} failed: ${err?.code ?? "no error code"}`);
        process.exitCode = 1;
        return;
      }
      applied++;
    }
    console.log(`migrations applied: ${applied}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // The guard's own refusal is fixed text with no URL in it. Anything else: the code only,
    // because a database message can quote a statement.
    const refusal = typeof err?.message === "string" && err.message.startsWith("refused:") ? err.message : null;
    console.error(`rehearsal apply failed: ${refusal ?? err?.code ?? "no error code"}`);
    process.exit(1);
  });
}
