// The final export of the Supabase Postgres database (OPS-257, part 1 of the move off Supabase, OPS-93).
//
//   MODE=preflight node scripts/supabase-export/export.mjs   dump and list, check, upload NOTHING (the default)
//   MODE=export CONFIRM=export-supabase-final node scripts/supabase-export/export.mjs
//                                                             the same, then upload to R2 and read each file back
//
// Started by hand from .github/workflows/supabase-export.yml, from main only. Nothing here runs on a schedule.
//
// Order: (a) refuse if the R2 bucket jetnine-media is public, before Postgres is touched; (b) connect with
// DATABASE_URL (a transaction pooler port 6543 is swapped to the session port 5432, where pg_dump is reliable);
// (c) pg_dump 17 (the server's major) of public, auth and storage in custom format, plus a schema-only SQL file;
// (d) the list of Storage objects, read from storage.objects in one read-only transaction (no Storage key);
// (e) check the dump with pg_restore --list; (f) preflight stops; (g) export uploads the three files under
// backups/supabase-final-[UTC date]/ and gets each back to compare sha256. Any "no" fails the run.
//
// The backup holds personal data and password hashes. The log never does: it prints names, counts, sizes, the
// first 12 characters of a checksum, and yes or no. The database URL travels in the environment, never argv.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIRM_EXPORT = "export-supabase-final";
export const BUCKET = "jetnine-media";
export const MAX_BYTES = 300 * 1024 * 1024; // wrangler's single object limit
export const FILES = { dump: "supabase-final.dump", schema: "supabase-final-schema.sql", storage: "storage-objects.csv" };

/** Throws unless mode is preflight or export, and for export unless confirm is exactly the typed word. */
export function assertRun({ mode, confirm }) {
  if (mode !== "preflight" && mode !== "export") throw new Error(`refused: unknown mode ${JSON.stringify(mode)}`);
  if (mode === "export" && confirm !== CONFIRM_EXPORT) throw new Error(`refused: an export needs CONFIRM set to exactly ${CONFIRM_EXPORT}`);
}

/**
 * Port 6543 is Supabase's transaction pooler, where pg_dump is unreliable: use the session port 5432 on the same
 * host. Returns the URL to use and a fixed label. The host and the password are never returned in the label.
 */
export function sessionUrl(databaseUrl) {
  let u;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error("refused: DATABASE_URL is not a URL");
  }
  const pooler = u.hostname.includes("pooler");
  if (u.port === "6543") {
    u.port = "5432";
    return { url: u.toString(), label: "connection: session pooler" };
  }
  return { url: databaseUrl, label: pooler ? "connection: session pooler" : "connection: direct" };
}

/** Is the bucket public? Reads the two wrangler answers; fails closed when it cannot tell. Returns null or the refusal. */
export function publicBucketRefusal({ devUrl, domains }) {
  if (devUrl.status !== 0 || domains.status !== 0) return "refused: could not read whether jetnine-media is public";
  const dev = `${devUrl.stdout}\n${devUrl.stderr}`;
  const dom = `${domains.stdout}\n${domains.stderr}`;
  if (/https?:\/\/\S*r2\.dev/i.test(dev) || (/\benabled\b/i.test(dev) && !/\bdisabled\b/i.test(dev))) return "refused: jetnine-media is public (r2.dev address on)";
  if (!/\bdisabled\b/i.test(dev)) return "refused: could not read whether jetnine-media is public";
  // Anything left after the CLI's own banner lines, other than a plain "none", is read as a connected domain.
  const left = dom.split("\n").filter((l) => l.trim() && !/warning|wrangler|proxy|^[\s─-╿▲]*$|listing|⛅/i.test(l)).join(" ").trim();
  if (left && !/\bno (custom )?domains?\b|^none$|^\[\s*\]$|\b0 (custom )?domains?\b/i.test(left)) return "refused: jetnine-media is public (custom domain)";
  return null;
}

/** CSV of the storage.objects list: bucket_id, name, bytes, created_at. Quotes doubled; a leading = + - @ is guarded. */
export function storageCsv(rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return ["bucket_id,name,bytes,created_at", ...rows.map((r) => [r.bucket_id, r.name, r.bytes, r.created_at].map(cell).join(","))].join("\n") + "\n";
}

/** Per bucket lines, "storage bucket [id]: [n] objects, [bytes] bytes". Bucket ids only, never object names. */
export function bucketLines(rows) {
  const by = new Map();
  for (const r of rows) {
    const b = by.get(r.bucket_id) ?? { n: 0, bytes: 0n };
    b.n += 1;
    b.bytes += BigInt(r.bytes ?? 0);
    by.set(r.bucket_id, b);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, b]) => `storage bucket ${id}: ${b.n} objects, ${b.bytes} bytes`);
}

const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * The whole run, with every outside call passed in so a test can fake them.
 * deps: wrangler(args) pg_dump({url, dir}) pgRestoreList(dir, file) queryStorage(url) dir now() log()
 */
export async function run({ mode, confirm, databaseUrl, deps }) {
  const { wrangler, pgDump, pgRestoreList, queryStorage, dir, log } = deps;
  assertRun({ mode, confirm });
  if (!databaseUrl) throw new Error("refused: DATABASE_URL is not set");

  // (a) the guard, before Postgres is touched
  const refusal = publicBucketRefusal({ devUrl: wrangler(["r2", "bucket", "dev-url", "get", BUCKET]), domains: wrangler(["r2", "bucket", "domain", "list", BUCKET]) });
  if (refusal) throw new Error(refusal);
  log(`bucket ${BUCKET}: not public`);

  // (b) the connection
  const conn = sessionUrl(databaseUrl);
  log(conn.label);

  // (c) the dump and the schema-only file
  const d = pgDump({ url: conn.url, dir });
  if (d.status !== 0) throw new Error(`pg_dump failed (exit ${d.status})`);

  // (d) the Storage object list
  const rows = await queryStorage(conn.url);
  writeFileSync(join(dir, FILES.storage), storageCsv(rows));
  for (const l of bucketLines(rows)) log(l);
  log(`storage objects: ${rows.length}`);

  // (e) check the dump
  const size = statSync(join(dir, FILES.dump)).size;
  const list = pgRestoreList(dir, FILES.dump);
  if (list.status !== 0) throw new Error(`pg_restore --list failed (exit ${list.status})`);
  const tables = list.stdout.split("\n").filter((l) => /\bTABLE DATA\b/.test(l)).length;
  log(`dump: ${size} bytes, ${tables} TABLE DATA entries, sha256 ${sha(join(dir, FILES.dump)).slice(0, 12)}`);
  if (tables === 0) throw new Error("refused: the dump holds no table data");
  for (const f of Object.values(FILES)) {
    if (statSync(join(dir, f)).size > MAX_BYTES) throw new Error(`refused: ${f} is above 300 MiB, wrangler cannot upload it in one object`);
  }

  // (f) preflight stops here
  if (mode === "preflight") {
    log("preflight: nothing uploaded");
    return { uploaded: false };
  }

  // (g) upload and read back
  const prefix = `backups/supabase-final-${deps.now().toISOString().slice(0, 10)}`;
  let bad = 0;
  for (const f of Object.values(FILES)) {
    const key = `${BUCKET}/${prefix}/${f}`;
    const put = wrangler(["r2", "object", "put", key, "--file", join(dir, f), "--remote"]);
    if (put.status !== 0) throw new Error(`upload of ${f} failed (exit ${put.status})`);
    const back = join(dir, `readback-${f}`);
    const get = wrangler(["r2", "object", "get", key, "--file", back, "--remote"]);
    const equal = get.status === 0 && sha(back) === sha(join(dir, f));
    log(`read back ${f}: sha256 equal ${equal ? "yes" : "no"}`);
    if (!equal) bad++;
  }
  if (bad > 0) throw new Error(`the read-back failed for ${bad} file(s)`);
  log(`export verified: 3 files in ${prefix}/`);
  return { uploaded: true, prefix };
}

// ---- the real calls -------------------------------------------------------------------------------------------

function realDeps(dir) {
  const wrangler = (args) => spawnSync("pnpm", ["exec", "wrangler", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: process.env });
  const mount = ["--user", `${process.getuid()}:${process.getgid()}`, "-v", `${dir}:/out`];
  return {
    wrangler,
    // The URL goes in by environment name only, so no process list shows it.
    pgDump: ({ url }) => {
      const env = { ...process.env, PGDUMP_URL: url };
      const flags = "--no-owner --no-privileges --schema=public --schema=auth --schema=storage";
      const dump = (extra) =>
        spawnSync("docker", ["run", "--rm", "-e", "PGDUMP_URL", ...mount, "postgres:17", "sh", "-c", `pg_dump "$PGDUMP_URL" ${flags} ${extra}`], { env, encoding: "utf8", stdio: ["ignore", "ignore", "ignore"] });
      const a = dump(`--format=custom --file=/out/${FILES.dump}`);
      return a.status !== 0 ? a : dump(`--schema-only --format=plain --file=/out/${FILES.schema}`);
    },
    pgRestoreList: (d, file) => spawnSync("docker", ["run", "--rm", ...mount, "postgres:17", "pg_restore", "--list", `/out/${file}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }),
    queryStorage: async (url) => {
      const { default: postgres } = await import("postgres");
      const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 30 });
      try {
        return await sql.begin("isolation level repeatable read read only", (tx) =>
          tx.unsafe("select bucket_id, name, (metadata->>'size')::bigint as bytes, created_at from storage.objects order by bucket_id, name"),
        );
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    dir,
    now: () => new Date(),
    log: (l) => console.log(l),
  };
}

async function main() {
  const mode = process.env.MODE || "preflight";
  assertRun({ mode, confirm: process.env.CONFIRM });
  for (const v of ["DATABASE_URL", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!process.env[v]) throw new Error(`${v} is not set`);
  }
  const dir = mkdtempSync(join(tmpdir(), "supabase-export-"));
  try {
    await run({ mode, confirm: process.env.CONFIRM, databaseUrl: process.env.DATABASE_URL, deps: realDeps(dir) });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    // Refusals and exit codes only; a driver message can quote a host or a row.
    const msg = typeof err?.message === "string" && /^(refused|pg_dump failed|pg_restore|upload of|the read-back|DATABASE_URL|CLOUDFLARE_)/.test(err.message) ? err.message : `failed (${typeof err?.code === "string" ? err.code : "no code"})`;
    console.error(`supabase-export ${msg}`);
    process.exit(1);
  });
}
