import { describe, expect, it } from "vitest";
import { parseDbTarget } from "../src/db/target.js";

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

  it("production refuses d1 until the cutover row changes it", () => {
    expect(parseDbTarget("d1", "production")).toBe("postgres");
  });

  it("a missing environment is not production, so d1 is honoured (same as the site)", () => {
    expect(parseDbTarget("d1", undefined)).toBe("d1");
  });

  it("capital letters do not count as d1", () => {
    expect(parseDbTarget("D1", "staging")).toBe("postgres");
  });
});
