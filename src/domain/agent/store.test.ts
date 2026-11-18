import test from "node:test";
import assert from "node:assert/strict";
import { agentStore } from "./store";

// OPS-142: when the target is d1 and the DB binding is missing, the store fails
// loudly. It never falls back to Postgres by itself.

test("target d1 with no DB binding throws", () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = "d1";
  process.env.DEPLOY_ENV = "staging";
  try {
    assert.throws(() => agentStore(), /DB_TARGET is d1 but the DB binding is missing/);
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});

test("production never gets the d1 store, whatever DB_TARGET says", () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = "d1";
  process.env.DEPLOY_ENV = "production";
  try {
    // The Postgres adapter is returned (building it opens no connection).
    assert.equal(typeof agentStore().addItemGuarded, "function");
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});

test("the default target is Postgres", () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  delete process.env.DB_TARGET;
  process.env.DEPLOY_ENV = "staging";
  try {
    assert.equal(typeof agentStore().latestPlaybook, "function");
  } finally {
    if (before.t !== undefined) process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});
