// Tests of the copy rehearsal's guards (OPS-198): it can never run against Supabase or a pooler,
// never with target production, and never print the connection string. No database is needed:
// every refusal happens before a connection is tried.
//
//   node --test scripts/d1-copy/rehearsal/local.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalDatabase, assertRehearse, FIXTURE_TABLES, missingFixtureTables } from "./local.mjs";
import { journalTags } from "./apply.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET = "not-a-real-password-7f3a";
const SUPABASE = `postgresql://postgres.abc:${SECRET}@db.abcdefgh.supabase.co:5432/postgres`;
const POOLER = `postgresql://postgres.abc:${SECRET}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
const LOCAL = "postgresql://ci:ci@localhost:5432/ci";

test("assertLocalDatabase allows localhost and 127.0.0.1 only", () => {
  assert.equal(assertLocalDatabase(LOCAL), "localhost");
  assert.equal(assertLocalDatabase("postgresql://ci:ci@127.0.0.1:5433/ci"), "127.0.0.1");
  for (const bad of [SUPABASE, POOLER, "postgresql://ci:ci@localhost.evil.example:5432/ci", "postgresql://ci:ci@10.0.0.5:5432/ci", "postgresql://localhost@db.supabase.co/ci"]) {
    assert.throws(() => assertLocalDatabase(bad), /refused/);
  }
  assert.throws(() => assertLocalDatabase(undefined), /refused/);
  assert.throws(() => assertLocalDatabase("not a url"), /refused/);
});

test("a refusal never carries the connection string or its password", () => {
  for (const bad of [SUPABASE, POOLER, "not a url"]) {
    try {
      assertLocalDatabase(bad);
      assert.fail("should have refused");
    } catch (err) {
      assert.doesNotMatch(err.message, new RegExp(SECRET));
      assert.doesNotMatch(err.message, /supabase|pooler/i);
    }
  }
});

test("assertRehearse needs target staging and a local database", () => {
  assert.doesNotThrow(() => assertRehearse({ target: "staging", databaseUrl: LOCAL }));
  assert.throws(() => assertRehearse({ target: "production", databaseUrl: LOCAL }), /refused/);
  assert.throws(() => assertRehearse({ target: undefined, databaseUrl: LOCAL }), /refused/);
  assert.throws(() => assertRehearse({ target: "staging", databaseUrl: SUPABASE }), /refused/);
});

test("the fixture check names the tables with no rows, and passes over held-back and filled ones", () => {
  const all = FIXTURE_TABLES.map((name) => ({ table: { name }, pgCount: 1 }));
  assert.deepEqual(missingFixtureTables(all), []);
  const one = all.map((r) => (r.table.name === "api_requests" ? { ...r, pgCount: 0 } : r));
  assert.deepEqual(missingFixtureTables(one), ["api_requests"]);
  assert.deepEqual(missingFixtureTables([]), FIXTURE_TABLES);
  // a held-back table has no count, so it never counts as filled
  assert.deepEqual(missingFixtureTables([{ table: { name: "users" }, held: "x" }]).includes("users"), true);
});

test("the journal lists the 58 migrations in order, each with a file", () => {
  const tags = journalTags();
  assert.equal(tags.length, 58);
  assert.equal(tags[0].slice(0, 4), "0000");
  assert.equal(tags.at(-1).slice(0, 4), "0057");
  assert.deepEqual([...tags].sort(), [...tags]);
  for (const tag of tags) assert.ok(existsSync(join(HERE, "../../../src/db/migrations", `${tag}.sql`)), `${tag}.sql exists`);
});

function run(args, env) {
  return spawnSync(args[0], args.slice(1), { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, timeout: 60000 });
}

test("apply.mjs refuses Supabase, a pooler and no URL, before connecting, and prints no password", () => {
  const script = join(HERE, "apply.mjs");
  for (const url of [SUPABASE, POOLER, undefined]) {
    const r = run([process.execPath, script], url ? { DATABASE_URL: url } : {});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refused/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(SECRET));
  }
});

test("copy.mjs --mode rehearse refuses a non-local host, target production, and --check", () => {
  const script = join(HERE, "../copy.mjs");
  const base = ["pnpm", "exec", "tsx", script];
  const nonLocal = run([...base, "--target", "staging", "--mode", "rehearse"], { DATABASE_URL: SUPABASE });
  assert.equal(nonLocal.status, 1);
  assert.match(nonLocal.stderr, /refused/);
  assert.doesNotMatch(nonLocal.stdout + nonLocal.stderr, new RegExp(SECRET));

  const production = run([...base, "--target", "production", "--mode", "rehearse"], { DATABASE_URL: LOCAL });
  assert.equal(production.status, 1);
  assert.match(production.stderr, /refused/);

  const check = run([...base, "--target", "staging", "--mode", "rehearse", "--check"], { DATABASE_URL: LOCAL });
  assert.equal(check.status, 1);
  assert.match(check.stderr, /does not combine/);

  const unknown = run([...base, "--target", "staging", "--mode", "restore"], { DATABASE_URL: LOCAL });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown mode/);
});
