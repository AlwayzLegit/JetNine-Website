// Verify post-migration state: tables, RLS enabled, policy counts, helper fns, triggers.
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
});

try {
  const tables = await sql`
    select tablename, rowsecurity
    from pg_tables where schemaname = 'public'
    order by tablename`;
  console.log("Tables (public):");
  for (const t of tables) console.log(`  ${t.tablename.padEnd(28)} rls=${t.rowsecurity}`);

  const policies = await sql`
    select tablename, count(*)::int as policy_count
    from pg_policies where schemaname = 'public'
    group by tablename order by tablename`;
  console.log("\nPolicies per table:");
  for (const p of policies) console.log(`  ${p.tablename.padEnd(28)} ${p.policy_count}`);

  const fns = await sql`
    select proname from pg_proc
    where pronamespace = (select oid from pg_namespace where nspname='public')
      and proname in (
        'current_user_role','is_staff','is_admin','set_updated_at',
        'handle_new_auth_user','enforce_user_role_immutable',
        'next_member_code','members_set_default_member_code'
      )
    order by proname`;
  console.log("\nHelper functions:", fns.map((f) => f.proname).join(", "));

  const trig = await sql`
    select tgname, tgrelid::regclass::text as on_table
    from pg_trigger
    where tgname = 'on_auth_user_created'`;
  console.log(
    "\nAuth trigger:",
    trig.length === 0 ? "MISSING ❌" : `${trig[0].tgname} on ${trig[0].on_table} ✓`,
  );
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
