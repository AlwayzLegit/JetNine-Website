import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { PATTERNS, REQUIRED, discover, matchesStoreTest, missingRequired } from "./store-tests.mjs";

test("store test files match, other tests do not", () => {
  assert.ok(matchesStoreTest("src/domain/trips/store-d1.test.ts"));
  assert.ok(matchesStoreTest("src/domain/trips/store.test.ts"));
  assert.ok(matchesStoreTest("src/domain/voice/call-notes-store-d1.test.ts"));
  assert.ok(matchesStoreTest("src/lib/api-key-store/store.test.ts"));
  assert.ok(matchesStoreTest("src/lib/rate-limit-d1.test.ts"));
  assert.ok(matchesStoreTest("src/app/admin/settings/reports/period.test.ts"));
  assert.ok(!matchesStoreTest("src/lib/session/core.test.mjs"));
  assert.ok(!matchesStoreTest("src/db/d1/parity.test.ts"));
  assert.ok(!matchesStoreTest("src/domain/trips/store.ts"));
  assert.ok(!matchesStoreTest("scripts/d1-copy/tables.test.ts"));
  assert.equal(PATTERNS.length, 6);
});

test("missingRequired names exactly what is absent", () => {
  assert.deepEqual(missingRequired(["a", "b"], ["a", "b"]), []);
  assert.deepEqual(missingRequired(["a"], ["a", "b", "c"]), ["b", "c"]);
});

test("the repo still has every file CI ran before, and no duplicates in the list", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const found = discover(root);
  assert.deepEqual(missingRequired(found), []);
  assert.equal(new Set(REQUIRED).size, REQUIRED.length);
  assert.ok(found.length >= REQUIRED.length);
});
