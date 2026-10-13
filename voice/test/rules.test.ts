import { describe, expect, it } from "vitest";

process.env.PUBLIC_HOST = "voice.example.com";
const { HUMAN_ASK } = await import("../src/relay/session.js");
const { withinFortyEightHours } = await import("../src/llm/tools.js");
const { leadSummarySms } = await import("../src/escalation.js");

describe("human-ask safety net", () => {
  it.each([
    "Can I talk to a real person?",
    "I want to speak with someone",
    "get me a human",
    "transfer me to a broker please",
    "operator",
    "are you a bot? I'd rather talk to an actual person",
  ])("transfers on: %s", (line) => {
    expect(HUMAN_ASK.test(line)).toBe(true);
  });
  it.each([
    "I need a jet from Los Angeles to Aspen tomorrow for four people",
    "my travel agent usually books this",
    "is the broker fee included in the quote",
  ])("does not fire on: %s", (line) => {
    expect(HUMAN_ASK.test(line)).toBe(false);
  });
});

describe("48-hour rule", () => {
  const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  it("today and tomorrow are hot", () => {
    expect(withinFortyEightHours(iso(0))).toBe(true);
    expect(withinFortyEightHours(iso(1))).toBe(true);
  });
  it("a week out is not", () => {
    expect(withinFortyEightHours(iso(7))).toBe(false);
  });
  it("garbage is not", () => {
    expect(withinFortyEightHours("next friday")).toBe(false);
    expect(withinFortyEightHours(undefined)).toBe(false);
  });
});

describe("alert SMS", () => {
  it("leads with HOT for escalations and includes the caller", () => {
    const body = leadSummarySms({
      from: "+15551234567",
      summary: "LA to Aspen tomorrow, 4 pax",
      transcript: [],
      escalated: true,
      escalationReason: "departure_within_48h",
    });
    expect(body.startsWith("JetNine HOT CALL")).toBe(true);
    expect(body).toContain("departure within 48h");
    expect(body).toContain("+15551234567");
  });
  it("flags a missed broker", () => {
    const body = leadSummarySms({ from: "+1", summary: "x", transcript: [], escalated: true, brokerAnswered: false });
    expect(body).toContain("broker missed");
  });
});

describe("no-transfer calls (ring-first already rang the team)", async () => {
  const { runTool } = await import("../src/llm/tools.js");
  const { callContext } = await import("../src/llm/prompt.js");
  const ctx = () => ({
    callId: "",
    callerNumber: "+15550001111",
    leadId: null,
    tripId: null,
    requestedEscalation: null,
    requestedEnd: null,
    outcomeHint: null,
    noTransfer: true,
  });
  it("the escalate tool refuses and never starts a transfer", async () => {
    const c = ctx();
    const r = await runTool("escalate", { reason: "caller_requested_human", summary: "x" }, c);
    expect(c.requestedEscalation).toBeNull();
    expect(r.result).toMatch(/not available/);
  });
  it("an ordinary call still transfers", async () => {
    const c = { ...ctx(), noTransfer: false };
    await runTool("escalate", { reason: "caller_requested_human", summary: "x" }, c);
    expect(c.requestedEscalation).not.toBeNull();
  });
  it("the call context overrides the escalation rules", () => {
    const block = callContext({ from: "+15550001111", to: "+15550002222", lead: null, activeTrips: [], recordingEnabled: true, nowIso: "2026-10-13T00:00:00Z", noTransfer: true });
    expect(block).toMatch(/NO-TRANSFER CALL/);
    expect(block).toMatch(/Never call the escalate tool/);
    const normal = callContext({ from: "+15550001111", to: "+15550002222", lead: null, activeTrips: [], recordingEnabled: true, nowIso: "2026-10-13T00:00:00Z" });
    expect(normal).not.toMatch(/NO-TRANSFER/);
  });
});
