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
