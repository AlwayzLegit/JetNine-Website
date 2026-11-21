import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apiKeyAdminStore, apiKeyRuntimeStore } from "./store";

// OPS-138: when the target is d1 and the DB binding is missing, the store fails
// loudly. It never falls back to Postgres by itself.

function withEnv(target: string, env: string, fn: () => void) {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = target;
  process.env.DEPLOY_ENV = env;
  try {
    fn();
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
}

test("target d1 with no DB binding throws", () => {
  withEnv("d1", "staging", () => {
    assert.throws(() => apiKeyRuntimeStore(), /DB_TARGET is d1 but the DB binding is missing/);
    assert.throws(() => apiKeyAdminStore(), /DB_TARGET is d1 but the DB binding is missing/);
  });
});

test("production never gets the d1 store, whatever DB_TARGET says", () => {
  withEnv("d1", "production", () => {
    // The Postgres adapter is returned (building it opens no connection).
    assert.equal(typeof apiKeyRuntimeStore().keyForAuth, "function");
    assert.equal(typeof apiKeyAdminStore().createIfUnderCap, "function");
  });
});

// OPS-213 (Codex security review): after the cutover the users domain is in D1, so the D1 key store must
// take the key's authority from the D1 users row. Passing a Postgres role lookup would leave a person
// removed or demoted in D1 with their old authority. The wiring is in apiKeyStore(); the behaviour is
// tested in store-d1.test.ts ("no canonical role source").
test("the d1 key store is built without a Postgres role source", () => {
  const source = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  assert.match(source, /return d1ApiKeyStore\(client\);/);
  assert.doesNotMatch(source, /pgUserRole/);
});
