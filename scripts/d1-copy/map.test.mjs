import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIRM_PRODUCTION,
  PRODUCTION_DB,
  REPLACE_PRODUCTION,
  STAGING_DB,
  TARGETS,
  assertProductionLoad,
  assertStaging,
  assertTarget,
  STATEMENT_LIMIT,
  canonicalLine,
  checksumLines,
  constraintDetail,
  deleteStatement,
  heldLine,
  insertStatement,
  mapValue,
  parseWranglerJson,
  reportLine,
  resultRows,
  sqlLiteral,
  statementTooLong,
} from "./map.mjs";
import { applyMigrations, failLine, fkLine, foreignKeyReport, loadTable, openMemoryDb } from "./preflight.mjs";

test("timestamps become UTC milliseconds", () => {
  assert.equal(mapValue("SQLiteTimestamp", new Date("2026-11-16T20:00:00.123Z")), 1794859200123);
  assert.equal(mapValue("SQLiteTimestamp", "2026-11-16T20:00:00Z"), 1794859200000);
  assert.equal(mapValue("SQLiteTimestamp", 5), 5);
  assert.equal(mapValue("SQLiteTimestamp", null), null);
  assert.throws(() => mapValue("SQLiteTimestamp", new Date("nope")), /invalid date/);
  assert.throws(() => mapValue("SQLiteTimestamp", "nope"), /unparsable/);
});

test("booleans become 0 or 1", () => {
  assert.equal(mapValue("SQLiteBoolean", true), 1);
  assert.equal(mapValue("SQLiteBoolean", false), 0);
  assert.equal(mapValue("SQLiteBoolean", "t"), 1);
  assert.equal(mapValue("SQLiteBoolean", "f"), 0);
  assert.throws(() => mapValue("SQLiteBoolean", {}), /cannot map object/);
});

test("integers: numbers stay, int8 digits stay exact, nothing else passes", () => {
  assert.equal(mapValue("SQLiteInteger", 42), 42);
  assert.equal(mapValue("SQLiteInteger", "9007199254740993"), "9007199254740993");
  assert.equal(mapValue("SQLiteInteger", 12n), "12");
  assert.equal(mapValue("SQLiteInteger", true), 1);
  assert.throws(() => mapValue("SQLiteInteger", 1.5), /cannot map number/);
  assert.throws(() => mapValue("SQLiteInteger", "12abc"), /cannot map string/);
});

test("json and arrays become JSON text", () => {
  assert.equal(mapValue("SQLiteTextJson", { a: [1, "x"] }), '{"a":[1,"x"]}');
  assert.equal(mapValue("SQLiteTextJson", ["a", "b"]), '["a","b"]');
  assert.equal(mapValue("SQLiteTextJson", []), "[]");
  assert.equal(mapValue("SQLiteTextJson", null), null);
});

test("text keeps strings exact, numeric text included", () => {
  assert.equal(mapValue("SQLiteText", "12345.670000"), "12345.670000");
  assert.equal(mapValue("SQLiteText", "2026-11-16"), "2026-11-16");
  assert.equal(mapValue("SQLiteText", "héllo 日本語 \u{1F600}"), "héllo 日本語 \u{1F600}");
  assert.equal(mapValue("SQLiteText", 7), "7");
});

test("an unknown column type is refused, and the error never holds the value", () => {
  assert.throws(() => mapValue("SQLiteBlob", "secret-value"), (e) => /unknown D1 column type/.test(e.message) && !/secret-value/.test(e.message));
  assert.throws(() => mapValue("SQLiteBoolean", "secret-value"), (e) => !/secret-value/.test(e.message));
});

test("literals: quotes doubled, NULL, numbers", () => {
  assert.equal(sqlLiteral("it's"), "'it''s'");
  assert.equal(sqlLiteral("a\nb"), "'a\nb'");
  assert.equal(sqlLiteral(null), "NULL");
  assert.equal(sqlLiteral(0), "0");
  assert.throws(() => sqlLiteral(Number.NaN), /not finite/);
  assert.equal(sqlLiteral("'; DROP TABLE users; --"), "'''; DROP TABLE users; --'");
});

test("insert and delete statements", () => {
  const cols = [
    { name: "id", columnType: "SQLiteText" },
    { name: "n", columnType: "SQLiteInteger" },
    { name: "big", columnType: "SQLiteInteger" },
    { name: "on", columnType: "SQLiteBoolean" },
    { name: "at", columnType: "SQLiteTimestamp" },
    { name: "j", columnType: "SQLiteTextJson" },
    { name: "note", columnType: "SQLiteText" },
  ];
  const row = {
    id: "a'b",
    n: 3,
    big: "9007199254740993",
    on: true,
    at: new Date("2026-01-01T00:00:00Z"),
    j: ["x"],
    note: null,
  };
  assert.equal(
    insertStatement("quotes", cols, row),
    `INSERT INTO "quotes" ("id", "n", "big", "on", "at", "j", "note") VALUES ('a''b', 3, 9007199254740993, 1, 1767225600000, '["x"]', NULL);`,
  );
  assert.equal(deleteStatement("quotes"), 'DELETE FROM "quotes";');
});

test("canonical lines agree whether a number or its digits come in", () => {
  assert.equal(canonicalLine(["id1", 1767225600000]), canonicalLine(["id1", "1767225600000"]));
  assert.notEqual(canonicalLine(["id1", null]), canonicalLine(["id1", "null"]));
});

test("the checksum ignores order and sees any change", async () => {
  const a = await checksumLines(["b", "a", "c"]);
  assert.equal(a, await checksumLines(["c", "b", "a"]));
  assert.notEqual(a, await checksumLines(["a", "b", "d"]));
  assert.notEqual(a, await checksumLines(["a", "b"]));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("only staging's own database is accepted", () => {
  assert.doesNotThrow(() => assertStaging({ target: "staging", database: STAGING_DB, env: "staging" }));
  assert.throws(() => assertStaging({ target: "production", database: STAGING_DB, env: "staging" }), /refused/);
  assert.throws(() => assertStaging({ target: "staging", database: "jetnine-production", env: "staging" }), /refused/);
  assert.throws(() => assertStaging({ target: "staging", database: STAGING_DB, env: "production" }), /refused/);
  assert.throws(() => assertStaging({ target: "staging", database: STAGING_DB, env: undefined }), /refused/);
  assert.throws(() => assertStaging({}), /refused/);
});

test("assertTarget accepts exactly the two pairs and refuses every mix (OPS-197)", () => {
  assert.doesNotThrow(() => assertTarget({ target: "staging", database: STAGING_DB, env: "staging" }));
  assert.doesNotThrow(() => assertTarget({ target: "production", database: PRODUCTION_DB, env: undefined }));
  assert.equal(PRODUCTION_DB, "jetnine-production");
  assert.deepEqual(Object.keys(TARGETS).sort(), ["production", "staging"]);
  // production's database with staging's env, staging's database with no env, and the crossed pairs
  assert.throws(() => assertTarget({ target: "production", database: PRODUCTION_DB, env: "staging" }), /refused/);
  assert.throws(() => assertTarget({ target: "production", database: PRODUCTION_DB, env: "production" }), /refused/);
  assert.throws(() => assertTarget({ target: "production", database: STAGING_DB, env: undefined }), /refused/);
  assert.throws(() => assertTarget({ target: "staging", database: PRODUCTION_DB, env: "staging" }), /refused/);
  assert.throws(() => assertTarget({ target: "staging", database: STAGING_DB, env: undefined }), /refused/);
  // anything else, including a different database that looks alike
  assert.throws(() => assertTarget({ target: "prod", database: PRODUCTION_DB, env: undefined }), /refused/);
  assert.throws(() => assertTarget({ target: "production", database: "jetnine-production-2", env: undefined }), /refused/);
  assert.throws(() => assertTarget({ target: "production", database: "jetnine-tag-cache", env: undefined }), /refused/);
  assert.throws(() => assertTarget({}), /refused/);
});

test("assertStaging still refuses production, even with production's own pair", () => {
  assert.throws(() => assertStaging({ target: "production", database: PRODUCTION_DB, env: undefined }), /refused/);
});

test("a production load needs the typed confirm, exactly (OPS-197)", () => {
  assert.equal(CONFIRM_PRODUCTION, "copy-to-production");
  const ok = { confirm: CONFIRM_PRODUCTION, replace: undefined, d1RowsBefore: 0 };
  assert.doesNotThrow(() => assertProductionLoad(ok));
  for (const confirm of [undefined, "", "yes", "true", "copy-to-production ", "COPY-TO-PRODUCTION", "replace-production-d1"]) {
    assert.throws(() => assertProductionLoad({ ...ok, confirm }), /refused/, `confirm ${JSON.stringify(confirm)}`);
  }
});

test("a production D1 that holds rows is wiped only with the second typed input (OPS-197)", () => {
  assert.equal(REPLACE_PRODUCTION, "replace-production-d1");
  const base = { confirm: CONFIRM_PRODUCTION, d1RowsBefore: 3 };
  assert.throws(() => assertProductionLoad({ ...base, replace: undefined }), /holds 3 rows/);
  assert.throws(() => assertProductionLoad({ ...base, replace: "" }), /refused/);
  assert.throws(() => assertProductionLoad({ ...base, replace: "copy-to-production" }), /refused/);
  assert.throws(() => assertProductionLoad({ ...base, replace: "replace-production-d1 " }), /refused/);
  assert.doesNotThrow(() => assertProductionLoad({ ...base, replace: REPLACE_PRODUCTION }));
  // the replace key alone never opens a load
  assert.throws(() => assertProductionLoad({ confirm: undefined, replace: REPLACE_PRODUCTION, d1RowsBefore: 3 }), /refused/);
  // an empty production D1 needs no replace
  assert.doesNotThrow(() => assertProductionLoad({ confirm: CONFIRM_PRODUCTION, replace: undefined, d1RowsBefore: 0 }));
});

test("wrangler output: a banner before the JSON, rows of the first statement", () => {
  const parsed = parseWranglerJson(' ⛅️ wrangler 4\n[{"results":[{"c":3}],"success":true}]');
  assert.deepEqual(resultRows(parsed), [{ c: 3 }]);
  assert.throws(() => parseWranglerJson("no json here"), /no JSON/);
  assert.throws(() => resultRows([{ success: false }]), /did not succeed/);
});

test("the report line holds names and numbers only, and flags any difference", () => {
  assert.match(reportLine({ table: "users", pgCount: 2, d1Count: 2, checksumEqual: true }), /^ok\s+users\s+postgres=\s+2 d1=\s+2 checksum equal yes$/);
  assert.match(reportLine({ table: "users", pgCount: 2, d1Count: 1, checksumEqual: true }), /^FAIL/);
  assert.match(reportLine({ table: "users", pgCount: 2, d1Count: 2, checksumEqual: false }), /^FAIL.*checksum equal no$/);
});

test("a held-back table must be empty in D1", () => {
  assert.match(heldLine({ table: "user_credentials", reason: "password hashes", d1Count: 0 }), /^held\s+user_credentials\s+not copied \(password hashes\); d1=\s+0$/);
  assert.match(heldLine({ table: "user_credentials", reason: "password hashes", d1Count: 2 }), /^FAIL/);
});

// OPS-115: the load names the rule it breaks, and writes NULL where a key points into a held-back table.

test("constraintDetail gives the kind and the schema names of the four SQLite messages", () => {
  assert.equal(constraintDetail("D1_ERROR: UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT"), "UNIQUE users.email");
  assert.equal(constraintDetail("UNIQUE constraint failed: quote_legs.quote_id, quote_legs.position"), "UNIQUE quote_legs.quote_id, quote_legs.position");
  assert.equal(constraintDetail("NOT NULL constraint failed: members.full_name: SQLITE_CONSTRAINT"), "NOT NULL members.full_name");
  assert.equal(constraintDetail("CHECK constraint failed: agent_memory_kind_check: SQLITE_CONSTRAINT"), "CHECK agent_memory_kind_check");
  assert.equal(constraintDetail("FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"), "FOREIGN KEY");
});

test("constraintDetail returns no detail for anything else and never a quoted value", () => {
  assert.equal(constraintDetail("something went wrong"), "no detail");
  assert.equal(constraintDetail(""), "no detail");
  assert.equal(constraintDetail(undefined), "no detail");
  // A message that also quotes a value: only the schema names come back.
  const out = constraintDetail("UNIQUE constraint failed: users.email: 'jane@example.com' already exists");
  assert.equal(out, "UNIQUE users.email");
  assert.ok(!out.includes("jane"));
  // A name with anything but word characters and dots is refused, not echoed.
  assert.equal(constraintDetail("CHECK constraint failed: 'x; drop table y'"), "no detail");
  assert.equal(constraintDetail("NOT NULL constraint failed: 'secret value'"), "no detail");
});

test("insertStatement writes NULL for a reference into a held-back table", () => {
  const cols = [
    { name: "id", columnType: "SQLiteText" },
    { name: "key_id", columnType: "SQLiteText" },
    { name: "n", columnType: "SQLiteInteger" },
  ];
  const row = { id: "a", key_id: "k-1", n: 3 };
  assert.equal(insertStatement("api_requests", cols, row), `INSERT INTO "api_requests" ("id", "key_id", "n") VALUES ('a', 'k-1', 3);`);
  assert.equal(insertStatement("api_requests", cols, row, ["key_id"]), `INSERT INTO "api_requests" ("id", "key_id", "n") VALUES ('a', NULL, 3);`);
  // A column that is already null stays null, and an unrelated column is not touched.
  assert.equal(insertStatement("api_requests", cols, { id: "b", key_id: null, n: 0 }, ["key_id"]), `INSERT INTO "api_requests" ("id", "key_id", "n") VALUES ('b', NULL, 0);`);
});

test("statementTooLong is false at the limit and true one byte over, counting bytes not characters", () => {
  assert.equal(STATEMENT_LIMIT, 100000);
  assert.equal(statementTooLong("x".repeat(STATEMENT_LIMIT)), false);
  assert.equal(statementTooLong("x".repeat(STATEMENT_LIMIT + 1)), true);
  // 2-byte characters: 50,001 of them are 100,002 bytes.
  assert.equal(statementTooLong("\u00e9".repeat(50001)), true);
  assert.equal(statementTooLong("\u00e9".repeat(50000)), false);
});

// OPS-115: the preflight, a dry load into an in-memory SQLite database.

// Two made-up tables, no real data: a parent, and a child with a foreign key, a unique
// code, a not null column and a check.
const SCHEMA = `
CREATE TABLE parent (id text PRIMARY KEY NOT NULL);
CREATE TABLE child (
  id text PRIMARY KEY NOT NULL,
  parent_id text,
  code text NOT NULL,
  kind text NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES parent(id),
  CONSTRAINT child_kind_check CHECK(kind in ('a','b'))
);
CREATE UNIQUE INDEX child_code_unique ON child (code);
`;

async function fixture() {
  const db = await openMemoryDb();
  applyMigrations(db, [SCHEMA]);
  return db;
}

test("a clean fixture loads and reports no broken key", async () => {
  const db = await fixture();
  assert.deepEqual(loadTable(db, `INSERT INTO parent (id) VALUES ('p1');`), { ok: true });
  assert.deepEqual(loadTable(db, `INSERT INTO child (id, parent_id, code, kind) VALUES ('c1', 'p1', 'X1', 'a');`), { ok: true });
  assert.deepEqual(foreignKeyReport(db), []);
  db.close();
});

test("a child row with a missing parent is reported as table, parent and row count", async () => {
  const db = await fixture();
  loadTable(db, `INSERT INTO child (id, parent_id, code, kind) VALUES ('c1', 'gone', 'X1', 'a');\nINSERT INTO child (id, parent_id, code, kind) VALUES ('c2', 'gone', 'X2', 'a');`);
  const report = foreignKeyReport(db);
  assert.deepEqual(report, [{ table: "child", parent: "parent", rows: 2 }]);
  assert.equal(fkLine(report[0]), "preflight FAIL child: FOREIGN KEY child -> parent: 2 rows");
  assert.equal(fkLine({ table: "child", parent: "parent", rows: 1 }), "preflight FAIL child: FOREIGN KEY child -> parent: 1 row");
  db.close();
});

test("a duplicate code is reported as UNIQUE with the column, and never its value", async () => {
  const db = await fixture();
  const res = loadTable(
    db,
    `INSERT INTO child (id, parent_id, code, kind) VALUES ('c1', NULL, 'SECRET-CODE', 'a');\nINSERT INTO child (id, parent_id, code, kind) VALUES ('c2', NULL, 'SECRET-CODE', 'a');`,
  );
  assert.equal(res.ok, false);
  assert.equal(res.detail, "UNIQUE child.code");
  assert.equal(failLine("child", res.detail), "preflight FAIL child: UNIQUE child.code");
  assert.ok(!failLine("child", res.detail).includes("SECRET"));
  db.close();
});

test("a value outside a check and a null in a not null column are named by rule", async () => {
  const db = await fixture();
  const check = loadTable(db, `INSERT INTO child (id, parent_id, code, kind) VALUES ('c1', NULL, 'X1', 'zzz');`);
  assert.deepEqual(check, { ok: false, detail: "CHECK child_kind_check" });
  const notNull = loadTable(db, `INSERT INTO child (id, parent_id, code, kind) VALUES ('c2', NULL, NULL, 'a');`);
  assert.deepEqual(notNull, { ok: false, detail: "NOT NULL child.code" });
  db.close();
});

test("a failing statement can contain a quote and a newline inside a value and still load", async () => {
  const db = await fixture();
  const res = loadTable(db, `INSERT INTO parent (id) VALUES ('it''s\nok');`);
  assert.deepEqual(res, { ok: true });
  db.close();
});
