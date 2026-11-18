import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A guard for the database move to D1 (OPS-99). It lists every file that still reaches Postgres,
// compares the list to src/db/postgres-left.json and prints how many call sites are left outside
// adapters. A new Postgres call site without an entry fails; an entry whose file no longer reaches
// Postgres is printed as a stale entry (delete it when a file moves to D1) and does not fail.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(path);
  }
  return out;
}

function reachesPostgres(file: string, text: string): boolean {
  if (/from\s+["'](postgres|drizzle-orm\/postgres-js)["']/.test(text)) return true;
  for (const m of text.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s*from\s*["']@\/db["']/g)) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("type "))
      .map((s) => s.split(/\s+as\s+/)[0]);
    if (names.includes("db") || names.includes("sql")) return true;
  }
  return (
    file.startsWith("voice/") &&
    /from\s+["'](\.\/client|\.\.\/db\/client|\.\/db\/client)["']/.test(text) &&
    /\b(withDb|sql)\b/.test(text)
  );
}

function found(): string[] {
  const files: string[] = [];
  for (const root of ["src", "voice/src"]) {
    for (const abs of walk(join(ROOT, root))) {
      const rel = abs.slice(ROOT.length).split("\\").join("/");
      if (rel.startsWith("src/db/")) continue; // the clients themselves
      if (reachesPostgres(rel, readFileSync(abs, "utf8"))) files.push(rel);
    }
  }
  return files.sort();
}

const listed = JSON.parse(readFileSync(join(ROOT, "src/db/postgres-left.json"), "utf8")).files as Record<
  string,
  string
>;

test("every file that reaches Postgres is listed", () => {
  const missing = found().filter((f) => !(f in listed));
  assert.deepEqual(missing, [], `Postgres call sites not in src/db/postgres-left.json: ${missing.join(", ")}`);
});

test("stale entries are printed, not failed", () => {
  const now = new Set(found());
  const stale = Object.keys(listed).filter((f) => !now.has(f));
  for (const f of stale) console.log(`stale entry (file no longer reaches Postgres, delete it): ${f}`);
  assert.ok(Array.isArray(stale));
});

test("entries are adapter or left", () => {
  const bad = Object.entries(listed).filter(([, v]) => v !== "adapter" && v !== "left");
  assert.deepEqual(bad, []);
});

test("count of Postgres call sites left outside adapters", () => {
  const left = Object.values(listed).filter((v) => v === "left").length;
  console.log(`Postgres call sites left outside adapters: ${left}`);
  assert.ok(left >= 0);
});
