import { beforeEach, describe, expect, it, vi } from "vitest";
import { vars } from "../src/env.js";
import { classifyProviderError, isMarkedUnrecoverable, isUnrecoverableProviderError } from "../src/llm/errors.js";

// OPS-235: a key, access or credit failure passes the call on at the first
// failed turn; a rate limit or server error keeps the two-turn behaviour.
vars.PUBLIC_HOST = "voice.example.com";

// A plain function, not vi.fn(): vitest's call tracking leaves the rejected
// promise of a throwing mock unhandled under workerd and fails the test run.
const turn = { error: null as unknown, calls: 0 };
vi.mock("../src/llm/agent.js", () => ({
  runTurn: async () => {
    turn.calls += 1;
    throw turn.error;
  },
}));
vi.mock("../src/db/queries.js", () => ({
  activeTrips: () => [],
  createCall: async () => "call-1",
  finalizeCall: async () => undefined,
  lookupCaller: async () => ({ lead: null, trips: [] }),
  updateCall: async () => undefined,
}));
vi.mock("../src/escalation.js", () => ({
  leadSummarySms: () => "",
  sendAlertSms: async () => undefined,
  startRecording: async () => undefined,
}));

const { CallSession } = await import("../src/relay/session.js");
const { makeLogger } = await import("../src/log.js");

const TRANSFER = "I am having trouble on my end. Let me connect you with our on-call broker.";
const CALLBACK = "I am having trouble on my end. We have your number, and a broker will call you back shortly. Thank you for calling JetNine.";
const MISSED = "Sorry, I missed that. Could you say it once more?";

type Out = { type: string; token?: string; handoffData?: string };

function newSession(opts: { noTransfer?: boolean } = {}) {
  const sent: Out[] = [];
  const ws = { readyState: 1, send: (d: string) => sent.push(JSON.parse(d) as Out) };
  const logged: { level: string; obj: unknown; msg?: string }[] = [];
  const base = makeLogger();
  const log = {
    ...base,
    warn: (obj: unknown, msg?: string) => logged.push({ level: "warn", obj, msg }),
    error: (obj: unknown, msg?: string) => logged.push({ level: "error", obj, msg }),
    info: () => undefined,
    child: () => log,
  };
  const session = new CallSession(ws, log as never);
  const setup = {
    type: "setup",
    callSid: "CA" + "1".repeat(32),
    from: "+13105550100",
    to: "+18185550100",
    customParameters: opts.noTransfer ? { noTransfer: "1" } : {},
  };
  return { session, sent, logged, setup };
}

async function say(s: ReturnType<typeof newSession>, text: string) {
  s.session.handle(JSON.stringify({ type: "prompt", voicePrompt: text, last: true }));
  // The turn chain is internal; give it time to settle.
  await vi.waitFor(() => expect(turn.calls).toBeGreaterThan(0), { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 50));
}

const spoken = (sent: Out[]) => sent.filter((m) => m.type === "text" && m.token).map((m) => m.token);
const ended = (sent: Out[]) => sent.filter((m) => m.type === "end");

function apiError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

describe("classifying provider errors", () => {
  it("marks 401, 403 and an Anthropic low credit balance as unrecoverable", () => {
    expect(isUnrecoverableProviderError(apiError(401, "invalid x-api-key"))).toBe(true);
    expect(isUnrecoverableProviderError(apiError(403, "forbidden"))).toBe(true);
    expect(
      isUnrecoverableProviderError(
        apiError(400, '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}'),
      ),
    ).toBe(true);
    expect(isUnrecoverableProviderError(apiError(429, "quota", { code: "insufficient_quota" }))).toBe(true);
  });

  it("leaves rate limits, server errors and other 400s as they were", () => {
    expect(isUnrecoverableProviderError(apiError(429, "rate limited"))).toBe(false);
    expect(isUnrecoverableProviderError(apiError(500, "boom"))).toBe(false);
    expect(isUnrecoverableProviderError(apiError(529, "overloaded"))).toBe(false);
    expect(isUnrecoverableProviderError(apiError(400, "messages: text content blocks must be non-empty"))).toBe(false);
    expect(isUnrecoverableProviderError(new Error("fetch failed"))).toBe(false);
    expect(isUnrecoverableProviderError(undefined)).toBe(false);
  });

  it("carries only the provider and the status, not the message of a key problem", () => {
    const marked = classifyProviderError(apiError(401, "invalid key sk-ant-secret"), "anthropic");
    expect(isMarkedUnrecoverable(marked)).toBe(true);
    if (isMarkedUnrecoverable(marked)) {
      expect(marked.provider).toBe("anthropic");
      expect(marked.providerStatus).toBe(401);
    }
    const plain = apiError(500, "boom");
    expect(classifyProviderError(plain, "openai")).toBe(plain);
    expect(isMarkedUnrecoverable(plain)).toBe(false);
  });
});

describe("a turn that fails because the provider is unavailable", () => {
  beforeEach(() => {
    turn.calls = 0;
    turn.error = null;
  });

  it("passes the call to the broker on the first failure, without 'I missed that'", async () => {
    turn.error = classifyProviderError(apiError(401, "invalid x-api-key"), "anthropic");
    const s = newSession();
    await s.session.handle(JSON.stringify(s.setup));
    await say(s, "I need a quote for a flight to Aspen");
    expect(spoken(s.sent)).toEqual([TRANSFER]);
    const end = ended(s.sent);
    expect(end).toHaveLength(1);
    expect(JSON.parse(end[0]!.handoffData!)).toMatchObject({ action: "escalate", reason: "agent_failing" });
    const line = s.logged.find((l) => l.msg === "turn: provider unavailable, passing the call on");
    expect(line?.obj).toEqual({ provider: "anthropic", status: 401 });
    expect(s.logged.some((l) => l.msg === "turn: model call failed")).toBe(false);
  });

  it("on a no-transfer call, promises the callback and hangs up at once", async () => {
    turn.error = classifyProviderError(apiError(403, "forbidden"), "openai");
    const s = newSession({ noTransfer: true });
    await s.session.handle(JSON.stringify(s.setup));
    await say(s, "Hello");
    await vi.waitFor(() => expect(ended(s.sent)).toHaveLength(1), { timeout: 8000 });
    expect(spoken(s.sent)).toEqual([CALLBACK]);
    expect(JSON.parse(ended(s.sent)[0]!.handoffData!)).toMatchObject({ action: "hangup" });
  });

  it("keeps the two-turn behaviour for a 429 or a 500", async () => {
    turn.error = apiError(500, "boom");
    const s = newSession();
    await s.session.handle(JSON.stringify(s.setup));
    await say(s, "first");
    expect(spoken(s.sent)).toEqual([MISSED]);
    expect(ended(s.sent)).toHaveLength(0);
    s.session.handle(JSON.stringify({ type: "prompt", voicePrompt: "second", last: true }));
    await vi.waitFor(() => expect(ended(s.sent)).toHaveLength(1), { timeout: 5000 });
    expect(spoken(s.sent)).toEqual([MISSED, TRANSFER]);
    expect(s.logged.filter((l) => l.msg === "turn: model call failed")).toHaveLength(2);
  });
});
