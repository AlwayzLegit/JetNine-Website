import { afterEach, describe, expect, it } from "vitest";
import { vars } from "../src/env.js";

// No Supabase in tests: routing must resolve from the environment key alone,
// and say so, without touching the network.
vars.PUBLIC_HOST = "voice.example.com";
vars.ANTHROPIC_API_KEY = "sk-ant-test";
vars.ANTHROPIC_MODEL = "claude-test";
delete vars.SUPABASE_URL;
delete vars.SUPABASE_SERVICE_ROLE_KEY;

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
