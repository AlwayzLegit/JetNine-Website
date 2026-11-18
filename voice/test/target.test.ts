import { describe, expect, it } from "vitest";
import { PRODUCTION_CUTOVER, parseDbTarget } from "../src/db/target.js";

// The same cases as the site's src/db/target.test.mjs: the voice Worker's rule is a copy of it.
describe("parseDbTarget", () => {
  it("missing, empty or unknown means postgres", () => {
    expect(parseDbTarget(undefined, "staging")).toBe("postgres");
    expect(parseDbTarget(null, "staging")).toBe("postgres");
    expect(parseDbTarget("", "staging")).toBe("postgres");
    expect(parseDbTarget("sqlite", "staging")).toBe("postgres");
    expect(parseDbTarget(1, "staging")).toBe("postgres");
  });

  it("postgres stays postgres", () => {
    expect(parseDbTarget("postgres", "staging")).toBe("postgres");
    expect(parseDbTarget("postgres", "production")).toBe("postgres");
  });

  it("d1 is honoured outside production", () => {
    expect(parseDbTarget("d1", "staging")).toBe("d1");
    expect(parseDbTarget("d1", "development")).toBe("d1");
  });

  it("production refuses d1 without the second setting", () => {
    expect(parseDbTarget("d1", "production")).toBe("postgres");
    expect(parseDbTarget("d1", "production", undefined)).toBe("postgres");
    expect(parseDbTarget("d1", "production", "")).toBe("postgres");
  });

  it("production uses d1 only with DB_TARGET d1 and DB_CUTOVER exactly production-d1", () => {
    expect(PRODUCTION_CUTOVER).toBe("production-d1");
    expect(parseDbTarget("d1", "production", "production-d1")).toBe("d1");
    expect(parseDbTarget(" d1 ", "production", "production-d1")).toBe("d1");
  });

  it("a wrong word for DB_CUTOVER keeps production on postgres", () => {
    for (const word of ["d1", "yes", "true", "1", "production", " production-d1 ", "production-d1 ", "Production-D1", "PRODUCTION-D1", "production_d1", 1, true, null]) {
      expect(parseDbTarget("d1", "production", word)).toBe("postgres");
    }
  });

  it("DB_CUTOVER alone does not move production, and without d1 it never does", () => {
    expect(parseDbTarget(undefined, "production", "production-d1")).toBe("postgres");
    expect(parseDbTarget("postgres", "production", "production-d1")).toBe("postgres");
    expect(parseDbTarget("sqlite", "production", "production-d1")).toBe("postgres");
  });

  it("the second setting changes nothing outside production", () => {
    expect(parseDbTarget("d1", "staging", "production-d1")).toBe("d1");
    expect(parseDbTarget("d1", "staging", "anything")).toBe("d1");
    expect(parseDbTarget("postgres", "staging", "production-d1")).toBe("postgres");
    expect(parseDbTarget(undefined, "development", "production-d1")).toBe("postgres");
  });

  it("a missing environment is not production, so d1 is honoured (same as the site)", () => {
    expect(parseDbTarget("d1", undefined)).toBe("d1");
  });

  it("capital letters do not count as d1", () => {
    expect(parseDbTarget("D1", "staging")).toBe("postgres");
  });
});
