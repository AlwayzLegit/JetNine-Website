import { afterEach, describe, expect, it } from "vitest";

// No Supabase in tests: routing must resolve from the environment key alone,
// and say so, without touching the network.
process.env.PUBLIC_HOST = "voice.example.com";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.ANTHROPIC_MODEL = "claude-test";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { resolveRouting, describeRouting, resetRoutingCache } = await import("../src/llm/providers.js");

describe("LLM routing without a database", () => {
  afterEach(() => resetRoutingCache());

  it("falls back to ANTHROPIC_API_KEY", async () => {
    const r = await resolveRouting();
    expect(r.primary).toEqual({
      provider: "anthropic",
      label: "Anthropic (env)",
      apiKey: "sk-ant-test",
      model: "claude-test",
      source: "env",
    });
    expect(r.fallback).toBeNull();
    expect(r.note).toMatch(/Supabase not configured/);
  });

  it("never exposes key material in the loggable view", () => {
    const view = describeRouting({
      primary: { provider: "openai", label: "OpenAI", apiKey: "sk-secret", model: "gpt-x", source: "db" },
      fallback: null,
      note: "n",
    });
    expect(JSON.stringify(view)).not.toContain("sk-secret");
    expect(view.primary).toEqual({ provider: "openai", model: "gpt-x", label: "OpenAI", source: "db" });
  });
});
