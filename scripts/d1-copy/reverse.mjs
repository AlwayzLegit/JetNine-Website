// The reverse copy: production D1 back into Postgres, for the way back after the cutover (OPS-200).
//
//   pnpm exec tsx scripts/d1-copy/reverse.mjs                     mode preflight: read both sides, print the differences, write nothing
//   pnpm exec tsx scripts/d1-copy/reverse.mjs --pg-only-times     preflight, and one "pg only:" line (table, key, creation time) per row only Postgres holds (OPS-257)
//   CONFIRM=copy-d1-to-postgres pnpm exec tsx scripts/d1-copy/reverse.mjs --mode load
//                                                                 replace the plan's Postgres tables with D1's rows (owner's yes, way back only)
//   pnpm exec tsx scripts/d1-copy/reverse.mjs --mode rehearse     CI only: a throwaway local Postgres, a round trip, no Cloudflare
//
// Reads production D1 as ONE export (`wrangler d1 export jetnine-production --remote`, top-level config, no
// --env; the pair is checked with map.mjs assertTarget before the call) into an in-memory SQLite database,
// so every table comes from the same moment. Reads Postgres with DATABASE_URL.
//
// Preflight writes nothing: Postgres is read in one read-only snapshot, D1 is only exported. It prints, per
// table, the Postgres and D1 counts and how many rows exist only in D1, only in Postgres or differ (by primary
// key and by the key line: pk and updated_at or created_at, to the millisecond). It prints the Postgres major,
// whether `session_replication_role = replica` is allowed for this login (tested inside a read-only
// transaction that is rolled back), the columns Postgres will reset to their default, and, if a load would be
// refused, why. It never runs the delete or the insert: that would lock every table of the live Postgres.
//
// Load needs CONFIRM exactly copy-d1-to-postgres (from the environment, never argv), checked before any call.
// Then ONE transaction: triggers off (session_replication_role = replica, so audit, code and updated_at
// triggers and foreign key triggers stay quiet), delete every plan table children first, insert parents first
// from the D1 snapshot in batches (`jsonb_populate_recordset`, typed and parameterised), move the identity
// sequence, then read back inside the same transaction the counts and key checksums with the forward copy's
// comparison. Any difference throws and the transaction rolls back: "Postgres not changed". Commit only at 0.
//
// What does not come back: users.banned_until (bans stay in auth.users), request_rate_limits (neither
// deleted nor written), and microseconds (D1 keeps milliseconds). Postgres-only columns take their default.
//
// Personal data: rows exist only in memory and in the temp folder, deleted in finally. Output is table names,
// counts, yes or no. Errors print a code and names only, never a server message or a statement.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { PRODUCTION_DB, TARGETS, assertTarget, canonicalLine, checksumLines, constraintDetail, insertStatement, mapValue } from "./map.mjs";
import { D1_ONLY_COLUMNS, PRODUCTION_SELECT, copyPlan } from "./tables.ts";
import { applyMigrations, openMemoryDb, readMigrations } from "./preflight.mjs";
import { assertLocalDatabase } from "./rehearsal/local.mjs";
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
  pgOnlyLine,
  quoteIdent as q,
  reverseDeleteSql,
  reverseDiffLine,
  reverseRefusals,
  reverseReportLine,
  setvalSql,
} from "./reverse-map.mjs";

const MIGRATIONS = join(fileURLToPath(new URL(".", import.meta.url)), "../../src/db/d1/migrations");

function parseArgs(argv) {
  const a = { mode: "preflight", pgOnlyTimes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pg-only-times") a.pgOnlyTimes = true;
    else if (argv[i] === "--mode") a.mode = argv[++i];
    else if (argv[i].startsWith("--mode=")) a.mode = argv[i].slice("--mode=".length);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!["preflight", "load", "rehearse"].includes(a.mode)) throw new Error(`unknown mode ${JSON.stringify(a.mode)}`);
  if (a.pgOnlyTimes && a.mode !== "preflight") throw new Error("unknown argument --pg-only-times (preflight only)");
  return a;
}

/** Only an error code and a constraint's kind and names, never wrangler's text (a D1 error can quote a statement). */
function wranglerCode(text) {
  const m = String(text).match(/\b(D1_[A-Z_]+|SQLITE_[A-Z_]+|\[code: \d+\])/);
  const code = m ? m[1] : "no code in the answer";
  const detail = constraintDetail(text);
  return detail === "no detail" ? code : `${code}: ${detail}`;
}

/** The plan: the production plan of the forward copy, minus the tables the reverse never touches. */
function reversePlan() {
  return copyPlan("production").filter((t) => !REVERSE_SKIP[t.name]);
}

/** One Postgres client; the types keep timestamps exact as the forward copy reads them. */
function connect(url) {
  return postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 30,
    onnotice: () => {},
    types: {
      dateOnly: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x },
      tsNoZone: { to: 1114, from: [1114], serialize: (x) => x, parse: (x) => new Date(`${x.replace(" ", "T")}Z`) },
    },
  });
}

/** One export of production D1 into an in-memory SQLite database. Returns the open database. */
async function exportD1(dir) {
  // The guard runs before the call: the database and env wrangler gets come from the production pair.
  assertTarget({ target: "production", database: PRODUCTION_DB, env: TARGETS.production.env });
  const out = join(dir, "d1.sql");
  const r = spawnSync("pnpm", ["exec", "wrangler", "d1", "export", PRODUCTION_DB, "--remote", "--output", out], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    env: process.env,
  });
  if (r.status !== 0) throw new Error(`wrangler failed (exit ${r.status}, ${wranglerCode(`${r.stdout}\n${r.stderr}`)})`);
  const db = await openMemoryDb();
  try {
    db.exec(readFileSync(out, "utf8"));
  } catch (err) {
    db.close();
    throw new Error(`the D1 export did not load (${constraintDetail(err?.message ?? "")})`);
  }
  return db;
}

/** The D1 side as read: which plan tables exist, the user count. */
function d1Facts(db, plan) {
  const have = new Set(db.prepare("select name from sqlite_master where type = 'table'").all().map((r) => r.name));
  const missingTables = plan.filter((t) => !have.has(t.name)).map((t) => t.name);
  const d1Users = have.has("users") ? Number(db.prepare("select count(*) as c from users").get().c) : 0;
  return { missingTables, d1Users };
}

/** Rows of one D1 table with the plan's columns, integers as BigInt so nothing rounds. */
function* d1Rows(db, table, columns) {
  const stmt = db.prepare(`select ${columns.map((c) => q(c.name)).join(", ")} from ${q(table)}`);
  stmt.setReadBigInts(true);
  for (const row of stmt.iterate()) yield row;
}

/** Key lines of the D1 table: Map from primary key to canonical line (raw values; digits equal on both sides). */
function d1KeyMap(db, t) {
  const stmt = db.prepare(`select ${t.keyColumns.map(q).join(", ")} from ${q(t.name)}`);
  stmt.setReadBigInts(true);
  const m = new Map();
  for (const row of stmt.iterate()) {
    const line = canonicalLine(t.keyColumns.map((k) => row[k]));
    m.set(String(row[t.pk]), line);
  }
  return m;
}

/** Key lines of the Postgres table, mapped by the D1 column types with the forward copy's mapValue. */
async function pgKeyMap(tx, t) {
  const types = t.keyColumns.map((k) => t.columns.find((c) => c.name === k).columnType);
  const res = await tx.unsafe(`select ${t.keyColumns.map(q).join(", ")} from public.${q(t.name)}`);
  const m = new Map();
  for (const row of res) {
    const vals = t.keyColumns.map((k, i) => mapValue(types[i], row[k]));
    m.set(String(vals[0]), canonicalLine(vals));
  }
  return m;
}

/** Postgres side of the plan: columns, identity, generated, triggers, foreign keys from outside. Names only. */
async function readPgShape(tx, plan) {
  const names = plan.map((t) => `'${t.name.replace(/'/g, "''")}'`).join(", ");
  const attrs = await tx.unsafe(
    `select c.relname as t, a.attname as n, a.attnotnull as nn, a.atthasdef as hd, a.attidentity as ident, a.attgenerated as gen,
            format_type(a.atttypid, a.atttypmod) as typ
       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped and c.relname in (${names})
      order by c.relname, a.attnum`,
  );
  const byTable = new Map();
  for (const r of attrs) {
    if (!byTable.has(r.t)) byTable.set(r.t, []);
    byTable.get(r.t).push({ name: r.n, notNull: r.nn, hasDefault: r.hd, identity: r.ident, generated: r.gen, type: r.typ });
  }
  // A trigger enabled for replica or always still fires with session_replication_role = replica.
  const trig = await tx.unsafe(
    `select c.relname as t, g.tgname as n from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and not g.tgisinternal and g.tgenabled in ('R', 'A') and c.relname in (${names})`,
  );
  // With the triggers off, a table outside the plan that points into a plan table would be left dangling.
  const outside = await tx.unsafe(
    `select cc.relname as child, pc.relname as parent
       from pg_constraint k join pg_class cc on cc.oid = k.conrelid join pg_class pc on pc.oid = k.confrelid join pg_namespace ps on ps.oid = pc.relnamespace
      where k.contype = 'f' and ps.nspname = 'public' and pc.relname in (${names}) and cc.relname not in (${names})`,
  );
  return { byTable, triggers: trig.map((r) => `${r.t}.${r.n}`), outside: outside.map((r) => `${r.child} -> ${r.parent}`) };
}

/** The write plan of every table, or the refusals. */
function writePlans(plan, shape) {
  const refusals = [];
  const out = new Map();
  for (const t of plan) {
    const pgCols = shape.byTable.get(t.name);
    if (!pgCols) {
      refusals.push(`${t.name} does not exist in Postgres`);
      continue;
    }
    const r = columnPlan(t.name, pgCols, t.columns.map((c) => c.name), D1_ONLY_COLUMNS[t.name] ?? []);
    if (r.refusal) refusals.push(r.refusal);
    else out.set(t.name, { ...r, pgTypes: new Map(pgCols.map((c) => [c.name, c.type])) });
  }
  for (const x of shape.triggers) refusals.push(`trigger ${x} is enabled for replica or always, so it would fire in a load`);
  for (const x of shape.outside) refusals.push(`table ${x} has a foreign key into the plan from outside it`);
  return { refusals, out };
}

/** Is `set local session_replication_role = replica` allowed for this login? Tested in a read-only transaction that rolls back. */
async function replicaAllowed(sql) {
  const stop = new Error("rollback");
  try {
    await sql.begin("read only", async (tx) => {
      await tx.unsafe("set local session_replication_role = replica");
      const [{ r }] = await tx.unsafe("select current_setting('session_replication_role') as r");
      if (r !== "replica") throw new Error("not replica");
      throw stop;
    });
  } catch (err) {
    return err === stop;
  }
  return false;
}

/** Compare both sides of every table. Returns lines and the number of tables that differ. Names and counts only. */
async function compareSides(tx, db, plan, { pgOnlyTimes = false } = {}) {
  const lines = [];
  const pgOnly = [];
  let differing = 0;
  for (const t of plan) {
    const d1 = d1KeyMap(db, t);
    const pg = await pgKeyMap(tx, t);
    const c = compareKeyMaps(d1, pg);
    if (c.onlyD1 + c.onlyPg + c.changed > 0) differing++;
    lines.push(reverseDiffLine({ table: t.name, pgCount: pg.size, d1Count: d1.size, ...c }));
    if (pgOnlyTimes && c.onlyPg > 0) pgOnly.push(...(await pgOnlyRows(tx, t, d1)));
  }
  return { lines, differing, pgOnly };
}

/**
 * The rows only Postgres holds, as "pg only:" lines (OPS-257): table, key and creation time (updated_at where the
 * table has no created_at). Only those two columns are read; the key is printed only when it is an id.
 */
async function pgOnlyRows(tx, t, d1Map) {
  const stampName = t.columns.some((c) => c.name === "created_at") ? "created_at" : (t.keyColumns[1] ?? null);
  const cols = [t.pk, ...(stampName ? [stampName] : [])];
  const pkType = t.columns.find((c) => c.name === t.pk).columnType;
  const stampType = stampName ? t.columns.find((c) => c.name === stampName).columnType : null;
  const res = await tx.unsafe(`select ${cols.map(q).join(", ")} from public.${q(t.name)}`);
  const lines = [];
  for (const row of res) {
    const key = mapValue(pkType, row[t.pk]);
    if (d1Map.has(String(key))) continue;
    let stamp = null;
    try {
      stamp = stampName ? mapValue(stampType, row[stampName]) : null;
    } catch {
      stamp = null;
    }
    lines.push({ ms: typeof stamp === "number" ? stamp : Infinity, line: pgOnlyLine({ table: t.name, key, stampName, stamp }) });
  }
  return lines.sort((a, b) => a.ms - b.ms).map((l) => l.line);
}

/** The lines of a preflight, in order. Writes nothing. */
async function preflight({ sql, db, plan, pgOnlyTimes = false }) {
  const out = [];
  const facts = d1Facts(db, plan);
  let ok = true;
  await sql.begin("isolation level repeatable read read only", async (tx) => {
    const [{ major }] = await tx.unsafe("select (current_setting('server_version_num')::int / 10000) as major");
    out.push(`postgres major: ${major}`);
    const shape = await readPgShape(tx, plan);
    const wp = writePlans(plan, shape);
    for (const r of wp.refusals) {
      out.push(`preflight FAIL ${r}`);
      ok = false;
    }
    for (const t of plan) {
      const w = wp.out.get(t.name);
      if (w && w.resetToDefault.length > 0) out.push(`reset to default: ${t.name}: ${w.resetToDefault.join(", ")}`);
    }
    const cmp = await compareSides(tx, db, plan, { pgOnlyTimes });
    out.push(...cmp.lines);
    out.push(`${plan.length} tables, ${cmp.differing} with a difference`);
    if (pgOnlyTimes) {
      out.push(...cmp.pgOnly);
      out.push(`pg only rows: ${cmp.pgOnly.length}`);
    }
    // Bans: counts only, and the note that they are not written back.
    const bannedD1 = Number(db.prepare("select count(*) as c from users where banned_until > ?").get(Date.now()).c);
    const [{ c: bannedAuth }] = await tx.unsafe("select count(*)::int as c from auth.users where banned_until > now()");
    out.push(`users banned now: d1=${bannedD1} auth.users=${bannedAuth} (bans are not written back)`);
  });
  out.push(`replica mode allowed: ${(await replicaAllowed(sql)) ? "yes" : "no"}`);
  const refused = reverseRefusals(facts);
  out.push(refused.length > 0 ? `a load would be refused: ${refused.join("; ")}` : "a load would pass the D1 checks (the typed confirm is checked at load)");
  return { out, ok };
}

/**
 * The load: one transaction. Returns the lines to print after the commit; throws before the commit on any
 * difference, which rolls the transaction back.
 */
async function load({ sql, db, plan }) {
  const lines = [];
  let identityDone = 0;
  await sql.begin(async (tx) => {
    // Waiting forever on a lock or a timeout in the middle of the load helps nobody: fail and roll back.
    await tx.unsafe("set local lock_timeout = '30s'");
    await tx.unsafe("set local statement_timeout = '15min'");
    await tx.unsafe("set local session_replication_role = replica");
    const [{ r }] = await tx.unsafe("select current_setting('session_replication_role') as r");
    if (r !== "replica") throw new Error("session_replication_role is not replica; the load stops");

    const shape = await readPgShape(tx, plan);
    const wp = writePlans(plan, shape);
    if (wp.refusals.length > 0) throw new Error(`refused: ${wp.refusals.join("; ")}`);

    for (const t of [...plan].reverse()) await tx.unsafe(reverseDeleteSql(t.name));

    for (const t of plan) {
      const w = wp.out.get(t.name);
      const types = new Map(t.columns.map((c) => [c.name, c.columnType]));
      const cols = w.write.map((n) => ({ name: n, columnType: types.get(n) }));
      const stmt = insertSql(t.name, w.write, { identity: w.identity.length > 0 });
      let batch = [];
      for (const row of d1Rows(db, t.name, cols)) {
        const o = {};
        for (const c of cols) o[c.name] = pgJsonValue(c.columnType, row[c.name]);
        batch.push(o);
        if (batch.length >= BATCH_ROWS) {
          await tx.unsafe(stmt, [JSON.stringify(batch)]);
          batch = [];
        }
      }
      if (batch.length) await tx.unsafe(stmt, [JSON.stringify(batch)]);
      for (const col of w.identity) {
        await tx.unsafe(setvalSql(t.name, col));
        identityDone++;
      }
    }

    // Read back inside the same transaction: counts, then a checksum of the key lines, per table.
    let failures = 0;
    for (const t of plan) {
      const d1 = d1KeyMap(db, t);
      const pg = await pgKeyMap(tx, t);
      const checksumEqual = (await checksumLines([...d1.values()])) === (await checksumLines([...pg.values()]));
      const c = compareKeyMaps(d1, pg);
      if (d1.size !== pg.size || !checksumEqual || c.onlyD1 + c.onlyPg + c.changed > 0) failures++;
      lines.push(reverseReportLine({ table: t.name, pgCount: pg.size, d1Count: d1.size, checksumEqual }));
    }
    if (failures > 0) {
      for (const l of lines) console.log(l);
      throw new Error(`the read-back found ${failures} tables with a difference`);
    }
  });
  const [{ r }] = await sql.unsafe("select current_setting('session_replication_role') as r");
  lines.push(`session_replication_role after commit: ${r}`);
  lines.push(`${identityDone} identity sequences moved`);
  lines.push(`${plan.length} tables, 0 with a difference`);
  return lines;
}

// ---------------------------------------------------------------------------------------------------
// Rehearsal (CI only): the forward copy's data, a round trip back, on a throwaway local Postgres.

/** A fingerprint of one table: md5 over its rows by primary key, timestamps cut to milliseconds (D1 keeps milliseconds). */
async function fingerprint(sql, t, w) {
  const parts = w.write.map((n) => {
    const typ = w.pgTypes.get(n);
    const ref = q(n);
    return typ.startsWith("timestamp") ? `coalesce(date_trunc('milliseconds', ${ref})::text, '~null')` : `coalesce(${ref}::text, '~null')`;
  });
  const [{ h }] = await sql.unsafe(
    `select md5(coalesce(string_agg(concat_ws(chr(31), ${parts.join(", ")}), chr(10) order by ${q(t.pk)}::text), '')) as h from public.${q(t.name)}`,
  );
  return h;
}

/** The forward copy's INSERTs, from the local Postgres into a fresh in-memory D1 (production shape). */
async function buildMemoryD1(sql, plan) {
  const db = await openMemoryDb();
  applyMigrations(db, readMigrations(MIGRATIONS));
  await sql.begin("isolation level repeatable read read only", async (tx) => {
    for (const t of plan) {
      const res = await tx.unsafe(PRODUCTION_SELECT[t.name] || `select * from public.${q(t.name)}`);
      for (const row of res) db.exec(insertStatement(t.name, t.columns, row, []));
    }
  });
  return db;
}

async function rehearse({ sql }) {
  const plan = reversePlan();
  const lines = [];
  let bad = 0;
  const check = (ok, text) => {
    lines.push(`${ok ? "ok  " : "FAIL"} ${text}`);
    if (!ok) bad++;
  };
  // Production-shaped D1 from the fixture (credential tables and bans carried, as the cutover load does).
  const db = await buildMemoryD1(sql, plan);
  try {
    const shape = await sql.begin("read only", (tx) => readPgShape(tx, plan));
    const wp = writePlans(plan, shape);
    if (wp.refusals.length > 0) {
      for (const r of wp.refusals) console.log(`rehearsal FAIL ${r}`);
      process.exitCode = 1;
      return;
    }
    const before = new Map();
    for (const t of plan) before.set(t.name, await fingerprint(sql, t, wp.out.get(t.name)));
    const [{ m: maxBefore }] = await sql.unsafe("select coalesce(max(id), 0)::int as m from public.api_requests");

    // Four scripted post-cutover writes, made in D1 only.
    const now = Date.now();
    const U = "00000000-0000-4000-8000-0000000000a1";
    db.exec(`insert into users (id, email, created_at, updated_at) values ('${U}', 'd1-user@example.com', ${now}, ${now})`);
    db.exec(`insert into user_credentials (user_id, password_hash, updated_at) values ('${U}', '$2a$10$notarealhashnotarealhashnotarealhashnotarealhash33', ${now})`);
    const quote = db.prepare("select id, status from quotes order by id limit 1").get();
    const nextStatus = quote.status === "cancelled" ? "submitted" : "cancelled";
    db.exec(`update quotes set status = '${nextStatus}', updated_at = ${now} where id = '${quote.id}'`);
    db.exec("delete from blog_posts where id = '00000000-0000-4000-8000-000000000060'");
    db.exec(`insert into api_requests (id, method, route, status, at) values (${maxBefore + 1}, 'GET', '/api/v1/d1-write', 200, ${now})`);
    const touched = new Set(["users", "user_credentials", "quotes", "blog_posts", "api_requests"]);

    // The preflight sees the four writes as differences and writes nothing at all.
    const pre = await preflight({ sql, db, plan });
    const diffOf = (table) => pre.out.find((l) => l.startsWith("DIFF") && l.split(/\s+/)[1] === table) ?? "";
    check(pre.ok, "preflight finds nothing to refuse");
    // --pg-only-times (OPS-257): the deleted post is listed with its key and creation time, nothing else.
    const timed = await preflight({ sql, db, plan, pgOnlyTimes: true });
    const pgOnlyLines = timed.out.filter((l) => l.startsWith("pg only: "));
    check(
      pgOnlyLines.length === 1 && /^pg only: blog_posts 00000000-0000-4000-8000-000000000060 created_at=\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(pgOnlyLines[0]),
      "preflight --pg-only-times: one line for the deleted post, key and creation time only",
    );
    check(timed.out.includes("pg only rows: 1"), "preflight --pg-only-times: the count of such rows");
    check(/only in d1=1 /.test(diffOf("users")), "preflight: the new user is only in D1");
    check(/changed=1$/.test(diffOf("quotes")), "preflight: the changed quote is a change");
    check(/only in postgres=1 /.test(diffOf("blog_posts")), "preflight: the deleted post is only in Postgres");
    check(/only in d1=1 /.test(diffOf("api_requests")), "preflight: the new api_requests row is only in D1");
    check(pre.out.includes("replica mode allowed: yes"), "preflight: replica mode allowed here");
    let unchanged = true;
    for (const t of plan) if ((await fingerprint(sql, t, wp.out.get(t.name))) !== before.get(t.name)) unchanged = false;
    check(unchanged, "preflight wrote nothing: every table fingerprint equal");

    // A load that fails halfway leaves Postgres as it was: one D1 row Postgres cannot take (an id that is no uuid).
    const bad1 = "not-a-uuid";
    db.exec(`insert into users (id, email, created_at, updated_at) values ('${bad1}', 'bad@example.com', ${now}, ${now})`);
    let failed = false;
    try {
      await load({ sql, db, plan });
    } catch {
      failed = true;
    }
    let intact = true;
    for (const t of plan) if ((await fingerprint(sql, t, wp.out.get(t.name))) !== before.get(t.name)) intact = false;
    check(failed && intact, "a load that fails rolls back: Postgres not changed");
    db.exec(`delete from users where id = '${bad1}'`);

    // The load path, with its own confirm (the typed word the owner would type).
    assertReverseLoad({ confirm: CONFIRM_REVERSE, ...d1Facts(db, plan) });
    for (const l of await load({ sql, db, plan })) lines.push(l);

    // Round trip: untouched tables equal, the four writes present, the sequence moved, triggers back on.
    for (const t of plan) {
      if (touched.has(t.name)) continue;
      const after = await fingerprint(sql, t, wp.out.get(t.name));
      check(after === before.get(t.name), `untouched ${t.name} equal`);
    }
    const [{ n: newUser }] = await sql.unsafe("select count(*)::int as n from public.users where id = $1", [U]);
    const [{ n: newCred }] = await sql.unsafe("select count(*)::int as n from public.user_credentials where user_id = $1", [U]);
    check(newUser === 1 && newCred === 1, "the user and credential written in D1 are in Postgres");
    const [{ s }] = await sql.unsafe("select status::text as s from public.quotes where id = $1", [quote.id]);
    check(s === nextStatus, "the quote changed in D1 is changed in Postgres");
    const [{ n: gone }] = await sql.unsafe("select count(*)::int as n from public.blog_posts where id = '00000000-0000-4000-8000-000000000060'");
    check(gone === 0, "the blog post deleted in D1 is gone from Postgres");
    const [{ n: reqRow }] = await sql.unsafe("select count(*)::int as n from public.api_requests where id = $1", [maxBefore + 1]);
    check(reqRow === 1, "the api_requests row written in D1 is in Postgres with its id");
    const stop = new Error("rollback");
    let nextId = null;
    try {
      await sql.begin(async (tx) => {
        const [r] = await tx.unsafe("insert into public.api_requests (method, route, status) values ('GET', '/rehearsal', 200) returning id");
        nextId = r.id;
        throw stop;
      });
    } catch (err) {
      if (err !== stop) throw err;
    }
    check(nextId !== null && nextId > maxBefore + 1, "an insert without an id gets an id above the copied maximum");
    const [{ r }] = await sql.unsafe("select current_setting('session_replication_role') as r");
    check(r === "origin", "session_replication_role is origin after the commit");
  } finally {
    db.close();
  }
  for (const l of lines) console.log(l);
  if (bad > 0) {
    console.log(`reverse rehearsal FAILED: ${bad} checks`);
    process.exitCode = 1;
    return;
  }
  console.log(`reverse rehearsal: ${plan.length} tables, 0 with a difference, round trip equal`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = reversePlan();

  if (args.mode === "rehearse") {
    // A throwaway Postgres on this machine and nothing else: no Cloudflare variable is read.
    assertLocalDatabase(process.env.DATABASE_URL);
    const sql = connect(process.env.DATABASE_URL);
    try {
      await rehearse({ sql });
    } finally {
      await sql.end({ timeout: 5 });
    }
    return;
  }

  // Preflight and load: the typed confirm (load only) is refused before any call to Cloudflare or Postgres.
  if (args.mode === "load") assertConfirm(process.env.CONFIRM);
  for (const v of ["DATABASE_URL", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!process.env[v]) throw new Error(`${v} is not set`);
  }
  const dir = mkdtempSync(join(tmpdir(), "d1-reverse-"));
  let db = null;
  let sql = null;
  try {
    db = await exportD1(dir);
    const facts = d1Facts(db, plan);
    console.log(`d1 export read: ${plan.length - facts.missingTables.length} of ${plan.length} plan tables, ${facts.d1Users} users`);
    // Before Postgres is touched in a load: every refusal, with the numbers just read.
    if (args.mode === "load") assertReverseLoad({ confirm: process.env.CONFIRM, ...facts });
    sql = connect(process.env.DATABASE_URL);
    if (args.mode === "preflight") {
      const { out, ok } = await preflight({ sql, db, plan, pgOnlyTimes: args.pgOnlyTimes });
      for (const l of out) console.log(l);
      console.log("preflight only: nothing written");
      if (!ok) process.exitCode = 1;
      return;
    }
    try {
      for (const l of await load({ sql, db, plan })) console.log(l);
    } catch (err) {
      console.log(`load failed: ${err?.message?.startsWith("refused") || err?.message?.startsWith("the read-back") || err?.message?.startsWith("session_replication") ? err.message : pgErrorCode(err)}`);
      console.log("Postgres not changed");
      process.exitCode = 1;
    }
  } finally {
    if (db) db.close();
    rmSync(dir, { recursive: true, force: true });
    if (sql) await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  // A refusal or a code and names only; messages here never carry row values.
  const msg = typeof err?.message === "string" && /^(refused|wrangler failed|the D1 export|DATABASE_URL|CLOUDFLARE_|unknown )/.test(err.message) ? err.message : pgErrorCode(err);
  console.error(`d1-reverse failed: ${msg}`);
  process.exit(1);
});
