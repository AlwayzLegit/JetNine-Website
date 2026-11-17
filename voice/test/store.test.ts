import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { vars } from "../src/env.js";
import { dbBindingName, dbConfigured, dbHealth, dbTarget, store } from "../src/db/store.js";
import { pgStore } from "../src/db/store-pg.js";

// The switch itself: which side is chosen, and that D1 with no binding fails loudly.
afterEach(() => {
  vars.DB_TARGET = undefined;
  vars.DEPLOY_ENV = "production";
});

describe("store()", () => {
  it("picks Postgres with no DB_TARGET", () => {
    expect(dbTarget()).toBe("postgres");
    expect(store()).toBe(pgStore);
    expect(dbBindingName()).toBe("HYPERDRIVE");
  });

  it("production refuses d1 even when asked", () => {
    vars.DB_TARGET = "d1";
    vars.DEPLOY_ENV = "production";
    expect(dbTarget()).toBe("postgres");
    expect(store()).toBe(pgStore);
  });

  it("staging with d1 picks the D1 side and needs the DB binding", () => {
    vars.DB_TARGET = "d1";
    vars.DEPLOY_ENV = "staging";
    expect(dbTarget()).toBe("d1");
    expect(store()).not.toBe(pgStore);
    expect(dbBindingName()).toBe("DB");
    expect(dbConfigured()).toBe(true);
  });

  it("d1 with no DB binding throws instead of reading an empty database", async () => {
    vars.DB_TARGET = "d1";
    vars.DEPLOY_ENV = "staging";
    const bindings = env as unknown as { DB?: D1Database };
    const saved = bindings.DB;
    try {
      Object.defineProperty(bindings, "DB", { value: undefined, configurable: true, writable: true });
      expect(dbConfigured()).toBe(false);
      expect(() => store()).toThrow(/DB binding/);
      expect(await dbHealth()).toEqual({ target: "d1", ok: false });
    } finally {
      Object.defineProperty(bindings, "DB", { value: saved, configurable: true, writable: true });
    }
  });
});
