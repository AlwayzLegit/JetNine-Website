import { describe, expect, it } from "vitest";

process.env.PUBLIC_HOST = "voice.example.com";
process.env.TWILIO_NUMBER = "+15550001111";
process.env.ESCALATION_PHONE = "+15550002222";
process.env.RECORDING_ENABLED = "true";

const ac = await import("../src/agent-config.js");
const { relayTwiml } = await import("../src/twiml.js");
const { checkCallbackNumber, runTool } = await import("../src/llm/tools.js");

const agent = (patch: (c: ReturnType<typeof ac.parseAgentConfig>) => void) => {
  const config = ac.parseAgentConfig({});
  patch(config);
  return { id: "11111111-1111-4111-8111-111111111111", name: "Test", version: 3, config };
};

describe("agent settings are read leniently", () => {
  it("empty or junk falls back to the defaults", () => {
    expect(ac.parseAgentConfig(null)).toEqual(ac.DEFAULT_AGENT_CONFIG);
    const c = ac.parseAgentConfig({ voice: { speed: 9, provider: "Nope" }, speech: { speechTimeoutMs: 50 }, profile: { greeting: "  " } });
    expect(c.voice.speed).toBe(1);
    expect(c.voice.provider).toBe("ElevenLabs");
    expect(c.speech.speechTimeoutMs).toBeNull();
    expect(c.profile.greeting).toBe(ac.DEFAULT_GREETING);
  });
  it("valid values are kept", () => {
    const c = ac.parseAgentConfig({ voice: { voiceId: "abc", speed: 0.9 }, calls: { transfers: { askForPerson: false } } });
    expect(c.voice.voiceId).toBe("abc");
    expect(c.voice.speed).toBe(0.9);
    expect(c.calls.transfers.askForPerson).toBe(false);
    expect(c.calls.transfers.enabled).toBe(true);
  });
});

describe("TwiML follows the agent", () => {
  it("voice, listening and greeting come from the agent; agentId is passed on", () => {
    const xml = relayTwiml({
      agent: agent((c) => {
        c.voice.voiceId = "21m00Tcm4TlvDq8ikWAM";
        c.voice.speed = 0.9;
        c.speech.speechTimeoutMs = 800;
        c.profile.greeting = "Hi, JetNine here. Where are you flying?";
      }),
    });
    expect(xml).toContain('voice="21m00Tcm4TlvDq8ikWAM-flash_v2_5-0.9_0.5_0.75"');
    expect(xml).toContain('speechTimeout="800"');
    expect(xml).toContain('welcomeGreeting="Hi, JetNine here. This call may be recorded. Where are you flying?"');
    expect(xml).toContain('welcomeGreetingInterruptible="none"');
    expect(xml).toContain('interruptSensitivity="medium"');
    expect(xml).toContain('ignoreBackchannel="true"');
    expect(xml).toContain('<Parameter name="agentId" value="11111111-1111-4111-8111-111111111111" />');
  });
  it("default voice sends no voice attribute", () => {
    expect(relayTwiml({ agent: agent(() => {}) })).not.toContain(" voice=");
  });
});

describe("transfer switches", () => {
  it("decide what the escalate tool accepts", () => {
    const c = agent((x) => (x.calls.transfers.departureWithin48h = false)).config;
    expect(ac.transferAllowed(c, "departure_within_48h", false)).toBe(false);
    expect(ac.transferAllowed(c, "caller_requested_human", false)).toBe(true);
    expect(ac.transferAllowed(c, "caller_requested_human", true)).toBe(false);
    const off = agent((x) => (x.calls.transfers.enabled = false)).config;
    expect(ac.transferAllowed(off, "caller_requested_human", false)).toBe(false);
  });
  it("are written into the prompt", () => {
    const p = ac.agentPersona(agent((x) => (x.calls.transfers.departureWithin48h = false)).config);
    expect(p).toMatch(/Do NOT transfer in these cases/);
    expect(p).toMatch(/forty-eight hours/);
    expect(ac.agentPersona(agent((x) => (x.calls.transfers.enabled = false)).config)).toMatch(/never transfers calls/);
  });
  it("the tool refuses a switched-off reason", async () => {
    const c = agent((x) => (x.calls.transfers.askForPerson = false)).config;
    const ctx = {
      callId: "", callerNumber: "+15550001111", leadId: null, tripId: null,
      requestedEscalation: null, requestedEnd: null, outcomeHint: null,
      canTransfer: (r: string) => ac.transferAllowed(c, r, false),
    };
    await runTool("escalate", { reason: "caller_requested_human", summary: "x" }, ctx);
    expect(ctx.requestedEscalation).toBeNull();
    await runTool("escalate", { reason: "departure_within_48h", summary: "x" }, ctx);
    expect(ctx.requestedEscalation).not.toBeNull();
  });
});

describe("callback numbers", () => {
  it.each([
    ["818 805 6780", "+18188056780"],
    ["1-818-805-6780", "+18188056780"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("accepts %s", (raw, e164) => {
    expect(checkCallbackNumber(raw)).toEqual({ ok: true, e164 });
  });
  it.each(["818 805 678", "805 6780", "818 805 67801"])("asks again for %s", (raw) => {
    expect(checkCallbackNumber(raw).ok).toBe(false);
  });
});
