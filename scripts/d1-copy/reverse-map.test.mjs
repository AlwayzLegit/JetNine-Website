import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  BATCH_ROWS,
  CONFIRM_REVERSE,
  REVERSE_SKIP,
  assertConfirm,
  assertReverseLoad,
  columnPlan,
  compareKeyMaps,
  insertSql,
  pgErrorCode,
  pgJsonValue,
  quoteIdent,
  reverseDeleteSql,
  reverseDiffLine,
  reverseRefusals,
  reverseReportLine,
  setvalSql,
} from "./reverse-map.mjs";

test("the confirm word is exactly copy-d1-to-postgres", () => {
  assert.equal(CONFIRM_REVERSE, "copy-d1-to-postgres");
  assert.doesNotThrow(() => assertConfirm("copy-d1-to-postgres"));
  for (const bad of [undefined, "", "yes", "copy-d1-to-postgres ", "COPY-D1-TO-POSTGRES", "copy-to-production"]) {
    assert.throws(() => assertConfirm(bad), /refused: a load into Postgres needs CONFIRM/);
  }
});

test("assertReverseLoad refuses a wrong confirm, an empty D1 and a missing table, with names and counts only", () => {
  const ok = { confirm: CONFIRM_REVERSE, d1Users: 3, missingTables: [] };
  assert.doesNotThrow(() => assertReverseLoad(ok));
  assert.throws(() => assertReverseLoad({ ...ok, confirm: "x" }), /needs CONFIRM/);
  assert.throws(() => assertReverseLoad({ ...ok, d1Users: 0 }), /holds no users/);
  assert.throws(() => assertReverseLoad({ ...ok, missingTables: ["quotes", "trips"] }), /no table quotes, trips/);
});

test("reverseRefusals lists the same reasons for the preflight", () => {
  assert.deepEqual(reverseRefusals({ d1Users: 2, missingTables: [] }), []);
  assert.deepEqual(reverseRefusals({ d1Users: 0, missingTables: [] }), ["production D1 holds no users"]);
  assert.deepEqual(reverseRefusals({ d1Users: 0, missingTables: ["a"] }), ["production D1 holds no users", "the D1 export has no table a"]);
});

test("the rate limiter's counters are skipped", () => {
  assert.ok(REVERSE_SKIP.request_rate_limits);
  assert.ok(REVERSE_SKIP.chat_daily); // OPS-242: D1 only, no Postgres table
  assert.equal(BATCH_ROWS, 500);
});

test("timestamps become ISO strings ending in Z, to the millisecond", () => {
  assert.equal(pgJsonValue("SQLiteTimestamp", 1794859200123n), "2026-11-16T20:00:00.123Z");
  assert.equal(pgJsonValue("SQLiteTimestamp", 1794859200123), "2026-11-16T20:00:00.123Z");
  assert.equal(pgJsonValue("SQLiteTimestamp", null), null);
  assert.throws(() => pgJsonValue("SQLiteTimestamp", "2026-11-16"), /timestamp: cannot map string/);
  assert.throws(() => pgJsonValue("SQLiteTimestamp", 8.64e15 + 1), /invalid milliseconds/);
});

test("booleans come back from 0 and 1 only", () => {
  assert.equal(pgJsonValue("SQLiteBoolean", 1n), true);
  assert.equal(pgJsonValue("SQLiteBoolean", 0n), false);
  assert.equal(pgJsonValue("SQLiteBoolean", 1), true);
  assert.equal(pgJsonValue("SQLiteBoolean", "0"), false);
  assert.throws(() => pgJsonValue("SQLiteBoolean", 2n), /boolean: cannot map bigint/);
});

test("integers stay exact: a safe BigInt is a number, a large one stays digits", () => {
  assert.equal(pgJsonValue("SQLiteInteger", 42n), 42);
  assert.equal(pgJsonValue("SQLiteInteger", -7), -7);
  assert.equal(pgJsonValue("SQLiteInteger", 9007199254740993n), "9007199254740993");
  assert.equal(pgJsonValue("SQLiteInteger", "123456789012345678"), "123456789012345678");
  assert.throws(() => pgJsonValue("SQLiteInteger", 1.5), /integer: cannot map number/);
  assert.throws(() => pgJsonValue("SQLiteInteger", "12ab"), /integer: cannot map string/);
});

test("json text is parsed so jsonb stays an object and text[] an array", () => {
  assert.deepEqual(pgJsonValue("SQLiteTextJson", '{"a":[1,2]}'), { a: [1, 2] });
  assert.deepEqual(pgJsonValue("SQLiteTextJson", '["x","y"]'), ["x", "y"]);
  assert.equal(pgJsonValue("SQLiteTextJson", '"plain"'), "plain");
  assert.throws(() => pgJsonValue("SQLiteTextJson", "{not json"), /json: unparsable text/);
  assert.throws(() => pgJsonValue("SQLiteTextJson", 5), /json: cannot map number/);
});

test("text passes through, numbers as exact text, nothing else", () => {
  assert.equal(pgJsonValue("SQLiteText", "12.50"), "12.50");
  assert.equal(pgJsonValue("SQLiteText", 7n), "7");
  assert.equal(pgJsonValue("SQLiteText", ""), "");
  assert.throws(() => pgJsonValue("SQLiteText", {}), /text: cannot map object/);
  assert.throws(() => pgJsonValue("SQLiteBlob", "x"), /unknown D1 column type SQLiteBlob/);
});

test("an error names the type and never the value", () => {
  const secret = "secret-value-123";
  for (const [type, v] of [["SQLiteTimestamp", secret], ["SQLiteBoolean", secret], ["SQLiteInteger", secret], ["SQLiteTextJson", 5], ["SQLiteText", { s: secret }]]) {
    try {
      pgJsonValue(type, v);
      assert.fail("expected a throw");
    } catch (err) {
      assert.ok(!String(err.message).includes(secret), `${type} message leaks the value`);
    }
  }
  try {
    pgJsonValue("SQLiteTextJson", `{${secret}`);
    assert.fail("expected a throw");
  } catch (err) {
    assert.ok(!String(err.message).includes(secret));
  }
});

test("names are quoted", () => {
  assert.equal(quoteIdent('we"ird'), '"we""ird"');
  assert.equal(reverseDeleteSql("quotes"), 'delete from public."quotes"');
  assert.equal(reverseDeleteSql('a"b'), 'delete from public."a""b"');
});

test("the INSERT carries no value, one jsonb parameter, and the identity clause only when asked", () => {
  assert.equal(
    insertSql("quotes", ["id", "notes"]),
    'insert into public."quotes" ("id", "notes") select "id", "notes" from jsonb_populate_recordset(null::public."quotes", $1::text::jsonb)',
  );
  assert.equal(
    insertSql("api_requests", ["id", "route"], { identity: true }),
    'insert into public."api_requests" ("id", "route") overriding system value select "id", "route" from jsonb_populate_recordset(null::public."api_requests", $1::text::jsonb)',
  );
  assert.match(insertSql('t"x', ['c"y']), /"t""x"/);
  assert.ok(!insertSql("quotes", ["id"]).includes("overriding"));
});

test("the sequence statement moves to the largest id and leaves an empty table at its start", () => {
  const s = setvalSql("api_requests", "id");
  assert.match(s, /setval\(pg_get_serial_sequence\('public\."api_requests"', 'id'\), coalesce\(max\("id"\), 1\), max\("id"\) is not null\)/);
});

const pgCols = (extra = []) => [
  { name: "id", notNull: true, hasDefault: false, identity: "", generated: "" },
  { name: "email", notNull: true, hasDefault: false, identity: "", generated: "" },
  ...extra,
];

test("columnPlan writes the columns both sides have", () => {
  const r = columnPlan("users", pgCols(), ["id", "email"]);
  assert.deepEqual(r.write, ["id", "email"]);
  assert.deepEqual(r.resetToDefault, []);
  assert.deepEqual(r.identity, []);
});

test("columnPlan drops a D1-only column on purpose and refuses any other", () => {
  assert.deepEqual(columnPlan("users", pgCols(), ["id", "email", "banned_until"], ["banned_until"]).write, ["id", "email"]);
  const r = columnPlan("users", pgCols(), ["id", "email", "banned_until"]);
  assert.equal(r.refusal, "users.banned_until exists in D1 and not in Postgres");
});

test("columnPlan resets a Postgres-only column with a default and refuses one that is NOT NULL without", () => {
  const withDefault = pgCols([{ name: "note", notNull: true, hasDefault: true, identity: "", generated: "" }]);
  assert.deepEqual(columnPlan("t", withDefault, ["id", "email"]).resetToDefault, ["note"]);
  const nullable = pgCols([{ name: "x", notNull: false, hasDefault: false, identity: "", generated: "" }]);
  assert.deepEqual(columnPlan("t", nullable, ["id", "email"]).resetToDefault, ["x"]);
  const hard = pgCols([{ name: "must", notNull: true, hasDefault: false, identity: "", generated: "" }]);
  assert.match(columnPlan("t", hard, ["id", "email"]).refusal, /t\.must is NOT NULL without a default/);
});

test("columnPlan skips a generated column and reports identity columns", () => {
  const cols = [
    { name: "id", notNull: true, hasDefault: true, identity: "a", generated: "" },
    { name: "total", notNull: false, hasDefault: false, identity: "", generated: "s" },
    { name: "route", notNull: true, hasDefault: false, identity: "", generated: "" },
  ];
  const r = columnPlan("api_requests", cols, ["id", "total", "route"]);
  assert.deepEqual(r.write, ["id", "route"]);
  assert.deepEqual(r.identity, ["id"]);
});

test("compareKeyMaps counts rows only in D1, only in Postgres and changed", () => {
  const d1 = new Map([["a", "1"], ["b", "2"], ["c", "3"]]);
  const pg = new Map([["a", "1"], ["b", "9"], ["d", "4"]]);
  assert.deepEqual(compareKeyMaps(d1, pg), { onlyD1: 1, onlyPg: 1, changed: 1 });
  assert.deepEqual(compareKeyMaps(new Map(), new Map()), { onlyD1: 0, onlyPg: 0, changed: 0 });
  assert.deepEqual(compareKeyMaps(d1, d1), { onlyD1: 0, onlyPg: 0, changed: 0 });
});

test("report lines carry names and numbers only", () => {
  assert.match(reverseDiffLine({ table: "quotes", pgCount: 3, d1Count: 4, onlyD1: 1, onlyPg: 0, changed: 0 }), /^DIFF quotes\s+postgres=\s+3 d1=\s+4 only in d1=1 only in postgres=0 changed=0$/);
  assert.match(reverseDiffLine({ table: "quotes", pgCount: 3, d1Count: 3, onlyD1: 0, onlyPg: 0, changed: 0 }), /^same quotes/);
  assert.match(reverseReportLine({ table: "trips", pgCount: 2, d1Count: 2, checksumEqual: true }), /^ok   trips .* checksum equal yes$/);
  assert.match(reverseReportLine({ table: "trips", pgCount: 2, d1Count: 3, checksumEqual: true }), /^FAIL trips/);
  assert.match(reverseReportLine({ table: "trips", pgCount: 2, d1Count: 2, checksumEqual: false }), /checksum equal no$/);
});

test("a Postgres error is reduced to its code and names, never its message or detail", () => {
  const err = { code: "23505", table_name: "users", constraint_name: "users_email_key", message: "duplicate key value (secret@example.com)", detail: "Key (email)=(secret@example.com) already exists." };
  assert.equal(pgErrorCode(err), "23505, table users, constraint users_email_key");
  assert.ok(!pgErrorCode(err).includes("secret"));
  assert.equal(pgErrorCode({ code: "22P02" }), "22P02");
  assert.equal(pgErrorCode(new Error("boom (secret)")), "no sqlstate");
  assert.equal(pgErrorCode({ code: "23505", table_name: "us ers; drop", constraint_name: "x'y" }), "23505");
});

// The tool refuses before it touches anything: no Cloudflare variable, no database, no network.
const REVERSE = fileURLToPath(new URL("./reverse.mjs", import.meta.url));
const runReverse = (args, env) =>
  spawnSync(process.execPath, ["--import", "tsx", REVERSE, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    timeout: 60000,
  });

test("a load without the typed confirm is refused before any call", () => {
  for (const confirm of [undefined, "", "copy-to-production", "copy-d1-to-postgres!"]) {
    const r = runReverse(["--mode", "load"], { DATABASE_URL: "postgresql://x:y@db.invalid:5432/z", ...(confirm === undefined ? {} : { CONFIRM: confirm }) });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refused: a load into Postgres needs CONFIRM set to exactly copy-d1-to-postgres/);
    assert.ok(!r.stdout.includes("d1 export"), "no export before the confirm");
  }
});

test("the rehearsal refuses any host but localhost, and never prints the URL", () => {
  const r = runReverse(["--mode", "rehearse"], { DATABASE_URL: "postgresql://user:hunter2@db.example.supabase.co:5432/postgres" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused: the rehearsal runs only against localhost or 127.0.0.1/);
  assert.ok(!`${r.stdout}${r.stderr}`.includes("hunter2"));
});

test("an unknown mode or argument is refused", () => {
  assert.match(runReverse(["--mode", "wipe"], {}).stderr, /unknown mode "wipe"/);
  assert.match(runReverse(["--target", "production"], {}).stderr, /unknown argument --target/);
});

test("preflight without the Cloudflare variables stops before any call", () => {
  const r = runReverse([], { DATABASE_URL: "postgresql://x:y@db.invalid:5432/z" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CLOUDFLARE_API_TOKEN is not set/);
});
