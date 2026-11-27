// OPS-257: the final Supabase export, run against fakes. No network, no Docker, no Cloudflare, no database.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BUCKET, CONFIRM_EXPORT, FILES, assertRun, bucketLines, publicBucketRefusal, run, sessionUrl, storageCsv } from "./export.mjs";

const URL_SECRET = "postgresql://postgres.abc:hunter2-secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
const PRIVATE_DEV = ok("Public Development URL is disabled.");
const NO_DOMAINS = ok("");

function fakeDeps({ dev = PRIVATE_DEV, domains = NO_DOMAINS, corruptReadBack = false, tables = 3, rows } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "export-test-"));
  const store = new Map();
  const calls = [];
  const logs = [];
  const deps = {
    dir,
    log: (l) => logs.push(l),
    now: () => new Date("2026-11-27T20:00:00Z"),
    wrangler: (args) => {
      calls.push(["wrangler", ...args]);
      if (args[1] === "bucket" && args[2] === "dev-url") return dev;
      if (args[1] === "bucket" && args[2] === "domain") return domains;
      const file = args[args.indexOf("--file") + 1];
      if (args[2] === "put") store.set(args[3], readFileSync(file));
      if (args[2] === "get") writeFileSync(file, corruptReadBack ? Buffer.from("corrupt") : store.get(args[3]));
      return ok();
    },
    pgDump: ({ url, dir: d }) => {
      calls.push(["pg_dump", url]);
      writeFileSync(join(d, FILES.dump), Buffer.from("PGDMP fake dump bytes"));
      writeFileSync(join(d, FILES.schema), "create table t ();\n");
      return ok();
    },
    pgRestoreList: () => ok(Array.from({ length: tables }, (_, i) => `${i}; 0 1 TABLE DATA public t${i} owner`).join("\n")),
    queryStorage: async (url) => {
      calls.push(["storage", url]);
      return (
        rows ?? [
          { bucket_id: "hero", name: "a.webp", bytes: "100", created_at: new Date("2026-01-01T00:00:00Z") },
          { bucket_id: "hero", name: "b,\"c\".webp", bytes: "50", created_at: null },
          { bucket_id: "docs", name: "=cmd.pdf", bytes: null, created_at: null },
        ]
      );
    },
  };
  return { deps, dir, store, calls, logs };
}

test("the confirm word is exactly export-supabase-final, and only an export needs it", () => {
  assert.equal(CONFIRM_EXPORT, "export-supabase-final");
  assert.doesNotThrow(() => assertRun({ mode: "preflight", confirm: "" }));
  assert.doesNotThrow(() => assertRun({ mode: "export", confirm: CONFIRM_EXPORT }));
  for (const bad of [undefined, "", "yes", "export-supabase-final ", "EXPORT-SUPABASE-FINAL"]) {
    assert.throws(() => assertRun({ mode: "export", confirm: bad }), /needs CONFIRM set to exactly export-supabase-final/);
  }
  assert.throws(() => assertRun({ mode: "wipe", confirm: CONFIRM_EXPORT }), /unknown mode "wipe"/);
});

test("a transaction pooler port is swapped to the session port, and the label never carries the host or a password", () => {
  const s = sessionUrl(URL_SECRET);
  assert.equal(new URL(s.url).port, "5432");
  assert.equal(s.label, "connection: session pooler");
  assert.doesNotMatch(s.label, /hunter2|supabase|abc/);
  assert.equal(sessionUrl("postgresql://u:p@db.abc.supabase.co:5432/postgres").label, "connection: direct");
  assert.throws(() => sessionUrl("not a url"), /DATABASE_URL is not a URL/);
});

test("a public bucket is refused, and so is an answer that cannot be read", () => {
  assert.equal(publicBucketRefusal({ devUrl: PRIVATE_DEV, domains: NO_DOMAINS }), null);
  assert.equal(publicBucketRefusal({ devUrl: PRIVATE_DEV, domains: ok("There are no custom domains connected to this bucket.") }), null);
  assert.match(publicBucketRefusal({ devUrl: ok("Public Development URL: https://pub-123.r2.dev (enabled)"), domains: NO_DOMAINS }), /jetnine-media is public \(r2\.dev/);
  assert.match(publicBucketRefusal({ devUrl: ok("Public access is enabled"), domains: NO_DOMAINS }), /is public/);
  assert.match(publicBucketRefusal({ devUrl: PRIVATE_DEV, domains: ok("domain: media.example.com\nenabled: true") }), /is public \(custom domain\)/);
  assert.match(publicBucketRefusal({ devUrl: { status: 1, stdout: "", stderr: "boom" }, domains: NO_DOMAINS }), /could not read/);
  assert.match(publicBucketRefusal({ devUrl: ok("something unexpected"), domains: NO_DOMAINS }), /could not read/);
});

test("the CSV doubles quotes, guards a formula start and keeps the header", () => {
  const csv = storageCsv([{ bucket_id: "b", name: 'x,"y"', bytes: "1", created_at: new Date("2026-01-01T00:00:00Z") }, { bucket_id: "b", name: "=1+1", bytes: null, created_at: null }]);
  assert.equal(csv, `bucket_id,name,bytes,created_at\nb,"x,""y""",1,2026-01-01T00:00:00.000Z\nb,'=1+1,,\n`);
});

test("bucket lines carry the bucket id, a count and bytes, never an object name", () => {
  const lines = bucketLines([
    { bucket_id: "hero", name: "secret-name.webp", bytes: "100" },
    { bucket_id: "hero", name: "x", bytes: 50 },
    { bucket_id: "docs", name: "y", bytes: null },
  ]);
  assert.deepEqual(lines, ["storage bucket docs: 1 objects, 0 bytes", "storage bucket hero: 2 objects, 150 bytes"]);
});

test("a public bucket stops the run before Postgres is touched", async () => {
  const f = fakeDeps({ dev: ok("Public Development URL: https://pub-1.r2.dev enabled") });
  await assert.rejects(run({ mode: "preflight", databaseUrl: URL_SECRET, deps: f.deps }), /refused: jetnine-media is public/);
  assert.equal(f.calls.filter((c) => c[0] === "pg_dump" || c[0] === "storage").length, 0);
  rmSync(f.dir, { recursive: true, force: true });
});

test("preflight dumps, lists and checks, uploads nothing, and prints no host, key or object name", async () => {
  const f = fakeDeps();
  const res = await run({ mode: "preflight", databaseUrl: URL_SECRET, deps: f.deps });
  assert.equal(res.uploaded, false);
  const out = f.logs.join("\n");
  assert.match(out, /connection: session pooler/);
  assert.match(out, /storage bucket docs: 1 objects, 0 bytes/);
  assert.match(out, /storage bucket hero: 2 objects, 150 bytes/);
  assert.match(out, /dump: \d+ bytes, 3 TABLE DATA entries, sha256 [0-9a-f]{12}$/m);
  assert.match(out, /preflight: nothing uploaded/);
  assert.doesNotMatch(out, /hunter2|supabase\.com|a\.webp|cmd\.pdf|export verified/);
  assert.equal(f.calls.filter((c) => c[0] === "wrangler" && c[2] === "object").length, 0);
  // the dump was asked for on the session port
  assert.equal(new URL(f.calls.find((c) => c[0] === "pg_dump")[1]).port, "5432");
  rmSync(f.dir, { recursive: true, force: true });
});

test("export uploads three files, reads each back, and prints three 'sha256 equal yes' lines then 'export verified'", async () => {
  const f = fakeDeps();
  const res = await run({ mode: "export", confirm: CONFIRM_EXPORT, databaseUrl: URL_SECRET, deps: f.deps });
  assert.equal(res.prefix, "backups/supabase-final-2026-11-27");
  const out = f.logs.join("\n");
  for (const file of Object.values(FILES)) assert.match(out, new RegExp(`read back ${file.replace(".", "\\.")}: sha256 equal yes`));
  assert.equal((out.match(/sha256 equal yes/g) ?? []).length, 3);
  assert.equal(f.logs.at(-1), "export verified: 3 files in backups/supabase-final-2026-11-27/");
  assert.deepEqual([...f.store.keys()].sort(), Object.values(FILES).map((x) => `${BUCKET}/backups/supabase-final-2026-11-27/${x}`).sort());
  assert.ok(f.calls.filter((c) => c[2] === "put").every((c) => c.includes("--remote")));
  rmSync(f.dir, { recursive: true, force: true });
});

test("a read-back that differs prints 'no' and fails the run", async () => {
  const f = fakeDeps({ corruptReadBack: true });
  await assert.rejects(run({ mode: "export", confirm: CONFIRM_EXPORT, databaseUrl: URL_SECRET, deps: f.deps }), /the read-back failed for 3 file/);
  assert.equal((f.logs.join("\n").match(/sha256 equal no/g) ?? []).length, 3);
  assert.ok(!f.logs.some((l) => l.startsWith("export verified")));
  rmSync(f.dir, { recursive: true, force: true });
});

test("an export without the typed word, and a dump with no table data, are refused", async () => {
  const f = fakeDeps();
  await assert.rejects(run({ mode: "export", confirm: "", databaseUrl: URL_SECRET, deps: f.deps }), /needs CONFIRM/);
  assert.equal(f.calls.length, 0);
  const g = fakeDeps({ tables: 0 });
  await assert.rejects(run({ mode: "export", confirm: CONFIRM_EXPORT, databaseUrl: URL_SECRET, deps: g.deps }), /the dump holds no table data/);
  assert.equal(g.calls.filter((c) => c[2] === "put").length, 0);
  for (const x of [f, g]) rmSync(x.dir, { recursive: true, force: true });
});

test("the command line refuses a wrong confirm and missing variables before any call, and never prints the URL", () => {
  const script = fileURLToPath(new URL("./export.mjs", import.meta.url));
  const env = { PATH: process.env.PATH, MODE: "export", CONFIRM: "nope", DATABASE_URL: URL_SECRET };
  const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused: an export needs CONFIRM/);
  const r2 = spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, MODE: "preflight" }, encoding: "utf8" });
  assert.match(r2.stderr, /DATABASE_URL is not set/);
  assert.doesNotMatch(`${r.stdout}${r.stderr}${r2.stdout}${r2.stderr}`, /hunter2/);
});
