import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGING_DB,
  assertStaging,
  canonicalLine,
  checksumLines,
  deleteStatement,
  heldLine,
  insertStatement,
  mapValue,
  parseWranglerJson,
  reportLine,
  resultRows,
  sqlLiteral,
} from "./map.mjs";

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
