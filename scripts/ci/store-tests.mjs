// Runs every store test of the D1 move in one CI step (OPS-170).
//
// Why: each D1 step used to add its own "... store tests" step to ci.yml, so every merge made
// every other waiting pull request conflict in that file. A new store now adds a test file that
// matches a pattern below and touches no workflow line.
//
// Guard: REQUIRED lists the files CI ran as separate steps before this script existed. If one is
// not found (renamed, deleted or no longer matching a pattern) the run fails with its name, so a
// test cannot drop out unseen. A step that renames or removes a test edits this list on purpose.
//
// Usage: node scripts/ci/store-tests.mjs          run the tests
//        node scripts/ci/store-tests.mjs --list   print the files and the count, run nothing

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A file matches when its path (with / separators, relative to the repo root) matches one of these.
export const PATTERNS = [
  /(^|\/)store-d1\.test\.ts$/,
  /(^|\/)store\.test\.ts$/,
  /-store-d1\.test\.ts$/,
  /-store\.test\.ts$/,
  /^src\/lib\/[^/]*-d1\.test\.ts$/,
  /^src\/app\/admin\/settings\/reports\/period\.test\.ts$/,
];

// The files CI ran in the 19 "... store tests" steps of ci.yml on main 0e54034.
export const REQUIRED = [
  "src/app/admin/settings/reports/period.test.ts",
  "src/domain/agent/store-d1.test.ts",
  "src/domain/agent/store.test.ts",
  "src/domain/approvals/store-d1.test.ts",
  "src/domain/approvals/store.test.ts",
  "src/domain/blog/store-d1.test.ts",
  "src/domain/blog/store.test.ts",
  "src/domain/contact/store-d1.test.ts",
  "src/domain/contact/store.test.ts",
  "src/domain/empty-legs/store-d1.test.ts",
  "src/domain/empty-legs/watchlist-store-d1.test.ts",
  "src/domain/history/store-d1.test.ts",
  "src/domain/history/store.test.ts",
  "src/domain/invoices/store-d1.test.ts",
  "src/domain/invoices/store.test.ts",
  "src/domain/members/store-d1.test.ts",
  "src/domain/members/store.test.ts",
  "src/domain/messages/store-d1.test.ts",
  "src/domain/messages/store.test.ts",
  "src/domain/payments/store-d1.test.ts",
  "src/domain/payments/store.test.ts",
  "src/domain/quotes/store-d1.test.ts",
  "src/domain/quotes/store.test.ts",
  "src/domain/reference/store-d1.test.ts",
  "src/domain/reports/store-d1.test.ts",
  "src/domain/reports/store.test.ts",
  "src/domain/requests/store-d1.test.ts",
  "src/domain/requests/store.test.ts",
  "src/domain/settings/store-d1.test.ts",
  "src/domain/settings/store.test.ts",
  "src/domain/trips/store-d1.test.ts",
  "src/domain/trips/store.test.ts",
  "src/domain/voice-agents/store-d1.test.ts",
  "src/domain/voice-agents/store.test.ts",
  "src/domain/voice/call-notes-store-d1.test.ts",
  "src/domain/voice/call-notes-store.test.ts",
  "src/lib/api-key-store/store-d1.test.ts",
  "src/lib/api-key-store/store.test.ts",
  "src/lib/audit-store.test.ts",
  "src/lib/rate-limit-d1.test.ts",
];

export function matchesStoreTest(path) {
  return PATTERNS.some((re) => re.test(path));
}

// Names in `required` that are not in `found`.
export function missingRequired(found, required = REQUIRED) {
  const have = new Set(found);
  return required.filter((p) => !have.has(p));
}

function walk(dir, root, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, root, out);
    else {
      const rel = relative(root, full).split(sep).join("/");
      if (matchesStoreTest(rel)) out.push(rel);
    }
  }
}

export function discover(root) {
  const out = [];
  walk(join(root, "src"), root, out);
  return out.sort();
}

function main() {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const files = discover(root);
  const missing = missingRequired(files);
  console.log(`D1 store tests: ${files.length} files`);
  for (const f of files) console.log(`  ${f}`);
  if (missing.length > 0) {
    console.error(`\nFAIL: ${missing.length} test file(s) CI ran before are not found:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }
  if (process.argv.includes("--list")) return;
  const run = spawnSync("pnpm", ["exec", "tsx", "--test", ...files], { cwd: root, stdio: "inherit" });
  process.exit(run.status ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
