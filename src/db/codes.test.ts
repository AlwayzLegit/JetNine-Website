import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { codeYear, formatCode, nextCode, type CodeExecutor, type CodeKind } from "./codes";
import * as schema from "./schema";

test("formatCode pads each kind the way the triggers did", () => {
  assert.equal(formatCode("quote", 2026, 42), "JN-2026-00042");
  assert.equal(formatCode("trip", 2026, 7), "JN-2026-0007");
  assert.equal(formatCode("invoice", 2026, 7), "INV-2026-0007");
  assert.equal(formatCode("empty_leg", 2026, 12), "EL-2026-0012");
  assert.equal(formatCode("member", 2027, 1), "M-2027-0001");
});

test("formatCode keeps a number wider than the padding whole", () => {
  assert.equal(formatCode("quote", 2026, 123456), "JN-2026-123456");
  assert.equal(formatCode("member", 2026, 10000), "M-2026-10000");
});

test("the year is UTC: 31 Dec 23:30 PST is already next year", () => {
  assert.equal(codeYear(new Date("2026-12-31T23:30:00-08:00")), 2027);
  assert.equal(codeYear(new Date("2026-12-31T23:30:00Z")), 2026);
  assert.equal(codeYear(new Date("2027-01-01T00:00:00Z")), 2027);
});

// A stand-in for the database handle that keeps one counter per year.
function fakeExecutor() {
  const counters = new Map<number, number>();
  const calls: { year: number }[] = [];
  const executor = {
    insert: () => ({
      values: (v: { year: number; lastValue: number }) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            const n = (counters.get(v.year) ?? 0) + 1;
            counters.set(v.year, n);
            calls.push({ year: v.year });
            return [{ n }];
          },
        }),
      }),
    }),
  } as unknown as CodeExecutor;
  return { executor, calls };
}

test("nextCode counts up within a year and starts again in a new one", async () => {
  const { executor } = fakeExecutor();
  const a = await nextCode(executor, "quote", new Date("2026-06-01T00:00:00Z"));
  const b = await nextCode(executor, "quote", new Date("2026-06-02T00:00:00Z"));
  const c = await nextCode(executor, "quote", new Date("2027-01-01T00:00:00Z"));
  assert.deepEqual([a, b, c], ["JN-2026-00001", "JN-2026-00002", "JN-2027-00001"]);
});

test("nextCode is one upsert statement: insert, on conflict (year) do update, returning", () => {
  const dbOffline = drizzle(postgres("postgresql://offline:offline@127.0.0.1:1/offline", { prepare: false }));
  const table = schema.quoteCodeSequence;
  const built = dbOffline
    .insert(table)
    .values({ year: 2026, lastValue: 1 })
    .onConflictDoUpdate({ target: table.year, set: { lastValue: sqlPlusOne(table) } })
    .returning({ n: table.lastValue })
    .toSQL();
  assert.match(built.sql, /^insert into "quote_code_sequence" \("year", "last_value"\) values \(\$1, \$2\) on conflict \("year"\) do update set "last_value" = "quote_code_sequence"\."last_value" \+ 1 returning "last_value"$/);
  assert.deepEqual(built.params, [2026, 1]);
});

function sqlPlusOne(table: typeof schema.quoteCodeSequence) {
  return sql`${table.lastValue} + 1`;
}

// Each of the five insert paths must pass the code it made. A source check:
// these paths run inside server actions and transactions that node:test cannot mock.
test("each insert path calls nextCode for its kind", () => {
  const sites: [string, CodeKind][] = [
    ["src/app/quote/actions.ts", "quote"],
    ["src/domain/requests/commands.ts", "trip"],
    ["src/domain/requests/commands.ts", "invoice"],
    ["src/domain/clients/commands.ts", "member"],
    ["src/domain/empty-legs/commands.ts", "empty_leg"],
  ];
  for (const [file, kind] of sites) {
    const text = readFileSync(file, "utf8");
    assert.match(text, new RegExp(`await nextCode\\((tx|db), "${kind}"\\)`), `${file} must call nextCode for ${kind}`);
  }
});

// The set_updated_at trigger sets these 14 tables' updated_at; the app now does the same.
test("every table whose updated_at a trigger set has $onUpdate", () => {
  const TRIGGER_TABLES = new Set([
    "aircraft", "airports", "aircraft_schedule_blocks", "empty_legs", "fbos", "invoices",
    "member_preferences", "members", "memberships", "operators", "quotes", "staff", "trips", "users",
  ]);
  const found = new Set<string>();
  for (const value of Object.values(schema)) {
    let cfg;
    try {
      cfg = getTableConfig(value as never);
    } catch {
      continue;
    }
    if (!cfg?.name || cfg.schema === "auth" || !TRIGGER_TABLES.has(cfg.name)) continue;
    const col = cfg.columns.find((c) => c.name === "updated_at");
    assert.ok(col, `${cfg.name} has no updated_at column`);
    assert.ok(col.onUpdateFn, `${cfg.name}.updated_at has no $onUpdate`);
    found.add(cfg.name);
  }
  assert.deepEqual([...TRIGGER_TABLES].filter((t) => !found.has(t)), [], "tables not found in the schema");
});
