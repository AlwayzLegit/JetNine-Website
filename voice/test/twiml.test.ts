import { describe, expect, it } from "vitest";

process.env.PUBLIC_HOST = "voice.example.com";
process.env.TWILIO_NUMBER = "+15550001111";
process.env.ESCALATION_PHONE = "+15550002222";
process.env.RECORDING_ENABLED = "true";

const { relayTwiml, escalationDialTwiml, escalationFallbackTwiml, escalationScreenTwiml, GREETING, RECONNECT_GREETING, RELAY_FAILED_LINE, callbackReassuranceTwiml } =
  await import("../src/twiml.js");

describe("relay TwiML", () => {
  const xml = relayTwiml();
  it("connects to the relay WebSocket with an action URL", () => {
    expect(xml).toContain('<ConversationRelay url="wss://voice.example.com/relay"');
    expect(xml).toContain('<Connect action="https://voice.example.com/relay/action">');
  });
  it("uses documented provider/model names", () => {
    expect(xml).toContain('ttsProvider="ElevenLabs"');
    expect(xml).toContain('transcriptionProvider="Deepgram"');
    expect(xml).toContain('speechModel="nova-3-general"');
    expect(xml).toContain('interruptible="any"');
  });
  it("discloses recording in the greeting when enabled", () => {
    expect(GREETING).toMatch(/recorded/);
    expect(xml).toContain(`welcomeGreeting="${GREETING}"`);
  });
});

describe("ring-first (no-transfer) TwiML", () => {
  it("uses the normal greeting and marks the session no-transfer", () => {
    const xml = relayTwiml({ missed: true });
    expect(xml).toContain(`welcomeGreeting="${GREETING}"`);
    expect(xml).not.toMatch(/unavailable|couldn|holding/i);
    expect(xml).toContain('<Parameter name="noTransfer" value="1" />');
    expect(xml).toContain('<Connect action="https://voice.example.com/relay/action?missed=1">');
  });
  it("a reconnect apologises for the drop and is marked as the retry", () => {
    const xml = relayTwiml({ missed: true, reconnect: true });
    expect(xml).toContain(`welcomeGreeting="${RECONNECT_GREETING}"`);
    expect(xml).toContain("/relay/action?missed=1&amp;reconnect=1");
  });
  it("an ordinary call has no parameter and a bare action", () => {
    const xml = relayTwiml();
    expect(xml).not.toContain("<Parameter");
    expect(xml).toContain('<Connect action="https://voice.example.com/relay/action">');
  });
  it("the last resort reassures without a transfer", () => {
    const xml = callbackReassuranceTwiml();
    expect(xml).toMatch(/call you back/);
    expect(xml).not.toContain("<Dial");
  });
});

describe("escalation TwiML", () => {
  it("dials the broker with caller ID and a result callback", () => {
    const xml = escalationDialTwiml("CA123");
    expect(xml).toContain(">+15550002222</Number>");
    expect(xml).toContain('callerId="+15550001111"');
    expect(xml).toContain("/escalation/result?callSid=CA123");
  });
  it("asks the broker to press 1 before connecting", () => {
    const xml = escalationDialTwiml("CA123");
    expect(xml).toContain('<Number url="https://voice.example.com/escalation/screen" method="POST">+15550002222</Number>');
    const screen = escalationScreenTwiml();
    expect(screen.match(/<Gather input="dtmf" numDigits="1"/g)).toHaveLength(2);
    expect(screen).toContain('action="https://voice.example.com/escalation/screen/answer"');
    expect(screen).toMatch(/<Hangup\/><\/Response>$/);
    expect(screen).not.toContain("<Dial");
  });
  it("a failed relay apologises, then transfers with press 1", () => {
    const xml = escalationDialTwiml("CA9", RELAY_FAILED_LINE);
    expect(xml).toContain("lost the connection");
    expect(xml).toContain('<Number url="https://voice.example.com/escalation/screen" method="POST">');
  });
  it("fallback reassures and hangs up", () => {
    expect(escalationFallbackTwiml()).toMatch(/call you back.*<Hangup\/>/s);
  });
});
