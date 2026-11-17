import test from "node:test";
import assert from "node:assert/strict";
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
