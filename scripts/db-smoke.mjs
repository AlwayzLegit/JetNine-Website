// One-off connection smoke test. Run with: node --env-file=.env.local scripts/db-smoke.mjs
import postgres from "postgres";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL or DATABASE_URL set");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

try {
  const [{ now, version }] = await sql`select now(), version()`;
  console.log("OK — connected");
  console.log("  now    :", now.toISOString());
  console.log("  version:", String(version).split(" ").slice(0, 2).join(" "));
  // Check schema state
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`  public tables: ${tables.length === 0 ? "(none — clean slate)" : tables.map((t) => t.table_name).join(", ")}`);
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
