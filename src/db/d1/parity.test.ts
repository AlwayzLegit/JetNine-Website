import test from "node:test";
import assert from "node:assert/strict";
import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig as pgConfig } from "drizzle-orm/pg-core";
import { SQLiteTable, getTableConfig as sqliteConfig } from "drizzle-orm/sqlite-core";
import * as pgBarrel from "../schema";
import * as pgBlogSubscribers from "../schema/blog-subscribers";
import * as d1Schema from "./schema";

// The Postgres barrel (src/db/schema/index.ts) leaves blog-subscribers out, but drizzle-kit
// reads the whole folder, so it is a table too.
const pgSchema = { ...pgBarrel, ...pgBlogSubscribers };

// OPS-100: the D1 tables must stay a faithful twin of the Postgres ones. For
// every Postgres table: the D1 export of the same name exists and has the same
// SQL table name, column names, not-null flags, primary key, foreign key count
// and index count, and every Postgres enum column has a CHECK in D1.

// Postgres-only, with no D1 equal: the Supabase `auth` schema.
const NO_D1_TABLE = new Set(["authUsers"]);
// D1 tables whose Postgres twin is raw SQL only (OPS-129, migration 0038). Named here, exactly.
const RAW_SQL_ON_POSTGRES = ["voiceLeads", "voiceCalls", "voiceTripRequests", "voiceMessages"];
// D1 tables whose Postgres twin arrives in a pull request still open (OPS-101 adds
// memberCodeSequence to src/db/schema/members.ts). Remove the entry once it is on main.
const D1_AHEAD = new Set([
  "memberCodeSequence",
  // OPS-123: the rate limiter's counters. On Postgres the table is reached with raw SQL only and is in no
  // Drizzle schema, so there is no twin to compare. Short-lived counters, never copied.
  "requestRateLimits",
  // OPS-129: the phone line's call log. On Postgres these four tables are created by raw SQL only
  // (migration 0038_voice_agent.sql) and written by the voice Worker; they are in no Drizzle
  // schema, so there is no twin to compare. This set is the only exception: every other D1 table
  // still has to match a Postgres one.
  ...RAW_SQL_ON_POSTGRES,
]);
// Foreign keys that point into that schema are not carried over. None left: since OPS-94 the
// Postgres users table has no foreign key to auth.users either.
const FK_LEFT_OUT: Record<string, number> = {};

const pgTables = Object.entries(pgSchema).filter(
  (e) => is(e[1], PgTable) && !NO_D1_TABLE.has(e[0]),
) as [string, PgTable][];

test("the four voice call tables are D1 tables with no Drizzle twin on Postgres (OPS-129)", () => {
  const d1Names = new Set(Object.entries(d1Schema).filter((e) => is(e[1], SQLiteTable)).map((e) => e[0]));
  for (const name of RAW_SQL_ON_POSTGRES) {
    assert.ok(d1Names.has(name), `${name} is missing in D1`);
    assert.ok(!pgTables.some(([p]) => p === name), `${name} now has a Postgres Drizzle table: remove it from RAW_SQL_ON_POSTGRES so the parity check covers it`);
  }
  assert.deepEqual(
    RAW_SQL_ON_POSTGRES.map((n) => getTableName((d1Schema as unknown as Record<string, Parameters<typeof getTableName>[0]>)[n])),
    ["voice_leads", "voice_calls", "voice_trip_requests", "voice_messages"],
  );
});

test("every Postgres table has a D1 twin (50 tables at OPS-100, 51 with OPS-101)", () => {
  assert.ok(pgTables.length >= 50, `expected at least 50 Postgres tables, found ${pgTables.length}`);
  const d1Names = new Set(Object.entries(d1Schema).filter((e) => is(e[1], SQLiteTable)).map((e) => e[0]));
  const missing = pgTables.map(([n]) => n).filter((n) => !d1Names.has(n));
  assert.deepEqual(missing, []);
  const extra = [...d1Names].filter((n) => !D1_AHEAD.has(n) && !pgTables.some(([p]) => p === n));
  assert.deepEqual(extra, []);
});

for (const [exportName, pgTable] of pgTables) {
  test(`${exportName}: same shape in D1`, () => {
    const d1Table = (d1Schema as Record<string, unknown>)[exportName];
    assert.ok(is(d1Table, SQLiteTable), `${exportName} is missing in D1`);
    const a = pgConfig(pgTable);
    const b = sqliteConfig(d1Table as SQLiteTable);

    assert.equal(getTableName(d1Table as SQLiteTable), getTableName(pgTable), "table name");

    const cols = (c: { columns: { name: string; notNull: boolean; primary: boolean }[] }) =>
      c.columns.map((x) => `${x.name}|${x.notNull ? "nn" : "null"}|${x.primary ? "pk" : ""}`).sort();
    assert.deepEqual(cols(b), cols(a), "columns, not-null flags, primary key");

    assert.equal(b.foreignKeys.length, a.foreignKeys.length - (FK_LEFT_OUT[exportName] ?? 0), "foreign keys");
    assert.equal(b.indexes.length, a.indexes.length, "indexes");

    // D1 has no triggers: a Postgres column that the app keeps current on update
    // (`$onUpdate`, OPS-101) must do the same in D1.
    for (const col of a.columns) {
      if (col.onUpdateFn) {
        const twin = b.columns.find((c) => c.name === col.name);
        assert.ok(twin?.onUpdateFn, `${col.name} has $onUpdate in Postgres but not in D1`);
      }
    }

    const checkNames = new Set(b.checks.map((c) => c.name));
    for (const col of a.columns) {
      const enumValues = (col as { enumValues?: string[] }).enumValues;
      if (col.columnType === "PgEnumColumn" || (col as { isEnum?: boolean }).isEnum) {
        assert.ok(checkNames.has(`${a.name}_${col.name}_enum`), `enum column ${col.name} has no CHECK in D1`);
      } else if (enumValues && col.columnType !== "PgText") {
        assert.ok(checkNames.has(`${a.name}_${col.name}_enum`), `enum column ${col.name} has no CHECK in D1`);
      }
    }
  });
}
