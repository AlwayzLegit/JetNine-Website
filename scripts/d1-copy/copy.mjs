// Copy JetNine's Postgres into STAGING's own D1 database and check the copy (OPS-105).
//
//   pnpm exec tsx scripts/d1-copy/copy.mjs --target staging            wipe, load, check
//   pnpm exec tsx scripts/d1-copy/copy.mjs --target staging --check    check only
//   pnpm exec tsx scripts/d1-copy/copy.mjs --list                      print the tables, no network
//
// Reads Postgres with DATABASE_URL in one read-only snapshot transaction. Writes only
// to the D1 database jetnine-staging through `wrangler d1 execute --env staging
// --remote`; every other target is refused before any call (map.mjs assertStaging).
// Needs DATABASE_URL, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
//
// Personal data: rows exist only in memory and in one SQL file in the runner's temp
// folder, which is deleted at the end. Nothing from a row is printed: the output is
// table names, counts and "checksum equal yes or no". Wrangler's own output is not
// echoed (a D1 error can quote a statement); a failure prints an error code only.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import {
  STAGING_DB,
  STAGING_ENV,
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
} from "./map.mjs";
import { HELD_BACK, copyPlan } from "./tables.ts";

const PAGE = 20000;

function parseArgs(argv) {
  const a = { target: undefined, check: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") a.target = argv[++i];
    else if (argv[i].startsWith("--target=")) a.target = argv[i].slice("--target=".length);
    else if (argv[i] === "--check") a.check = true;
    else if (argv[i] === "--list") a.list = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return a;
}

const q = (n) => `"${n.replace(/"/g, '""')}"`;

/** Only an error code, never wrangler's text: a D1 error can quote the failing statement. */
function errorCode(text) {
  const m = String(text).match(/\b(D1_[A-Z_]+|SQLITE_[A-Z_]+|\[code: \d+\])/);
  return m ? m[1] : "no code in the answer";
}

function wrangler(args) {
  const r = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`wrangler failed (exit ${r.status}, ${errorCode(`${r.stdout}\n${r.stderr}`)})`);
  }
  return r.stdout;
}

function d1Query(command) {
  const out = wrangler(["d1", "execute", STAGING_DB, "--env", STAGING_ENV, "--remote", "--json", "--command", command]);
  return resultRows(parseWranglerJson(out));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = copyPlan();

  if (args.list) {
    for (const t of plan) {
      console.log(`${t.name.padEnd(30)} key: ${t.keyColumns.join(", ")}  columns: ${t.columns.length}${HELD_BACK[t.name] ? `  HELD BACK (${HELD_BACK[t.name]})` : ""}`);
    }
    console.log(`${plan.length} tables`);
    return;
  }

  assertStaging({ target: args.target, database: STAGING_DB, env: STAGING_ENV });
  for (const v of ["DATABASE_URL", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!process.env[v]) throw new Error(`${v} is not set`);
  }

  // Keep dates exact: date stays "YYYY-MM-DD" text, timestamp without time zone is UTC.
  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 30,
    onnotice: () => {},
    types: {
      dateOnly: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x },
      tsNoZone: { to: 1114, from: [1114], serialize: (x) => x, parse: (x) => new Date(`${x.replace(" ", "T")}Z`) },
    },
  });

  const dir = mkdtempSync(join(tmpdir(), "d1-copy-"));
  const file = join(dir, "load.sql");
  const results = [];

  try {
    // One snapshot, read only: the counts and the keys all describe the same instant.
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      if (!args.check) {
        writeFileSync(file, "PRAGMA defer_foreign_keys = on;\n");
        for (const t of plan) appendFileSync(file, `${deleteStatement(t.name)}\n`);
      }
      for (const t of plan) {
        if (HELD_BACK[t.name]) {
          results.push({ table: t, held: HELD_BACK[t.name] });
          continue;
        }
        const res = await tx.unsafe(`select * from public.${q(t.name)}`);
        const have = new Set((res.columns ?? []).map((c) => c.name));
        for (const c of t.columns) {
          if (!have.has(c.name)) throw new Error(`${t.name}: Postgres has no column ${c.name}`);
        }
        const keyTypes = t.keyColumns.map((k) => t.columns.find((c) => c.name === k).columnType);
        const lines = [];
        let chunk = [];
        for (const row of res) {
          lines.push(canonicalLine(t.keyColumns.map((k, i) => mapValue(keyTypes[i], row[k]))));
          if (!args.check) {
            chunk.push(insertStatement(t.name, t.columns, row));
            if (chunk.length >= 500) {
              appendFileSync(file, `${chunk.join("\n")}\n`);
              chunk = [];
            }
          }
        }
        if (chunk.length) appendFileSync(file, `${chunk.join("\n")}\n`);
        results.push({ table: t, pgCount: res.length, pgChecksum: await checksumLines(lines) });
      }
    });

    if (!args.check) {
      console.log(`Loading ${results.length} tables into ${STAGING_DB} (wipes it first)`);
      wrangler(["d1", "execute", STAGING_DB, "--env", STAGING_ENV, "--remote", "--file", file, "--yes"]);
    }

    // Read back and compare: row count, then a checksum of the key columns per table.
    let failures = 0;
    for (const r of results) {
      const t = r.table;
      const d1Count = Number(d1Query(`select count(*) as c from ${q(t.name)}`)[0]?.c ?? -1);
      if (r.held) {
        if (d1Count !== 0) failures++;
        console.log(heldLine({ table: t.name, reason: r.held, d1Count }));
        continue;
      }
      const keys = t.keyColumns.map(q).join(", ");
      const lines = [];
      for (let offset = 0; offset < Math.max(d1Count, 1); offset += PAGE) {
        const rows = d1Query(`select ${keys} from ${q(t.name)} order by ${q(t.pk)} limit ${PAGE} offset ${offset}`);
        for (const row of rows) lines.push(canonicalLine(t.keyColumns.map((k) => row[k])));
      }
      const d1Checksum = await checksumLines(lines);
      const checksumEqual = d1Checksum === r.pgChecksum;
      if (r.pgCount !== d1Count || !checksumEqual) failures++;
      console.log(reportLine({ table: t.name, pgCount: r.pgCount, d1Count, checksumEqual }));
    }
    const held = results.filter((r) => r.held).length;
    console.log(`${results.length} tables (${results.length - held} copied, ${held} held back), ${failures} with a difference`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  // Name and message only; messages here never carry row values (map.mjs says so).
  console.error(`d1-copy failed: ${err?.message ?? "unknown error"}`);
  process.exit(1);
});
