import { config, urls } from "./config.js";

// Hand-built TwiML: the shapes are small and the attribute set for
// <ConversationRelay> moves faster than SDK typings do.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GREETING = config.voice.recordingEnabled
  ? "Thank you for calling JetNine. This call may be recorded. How can I help with your flight?"
  : "Thank you for calling JetNine. How can I help with your flight?";

/** TwiML for the inbound call: connect the caller to our relay WebSocket. */
export function relayTwiml(): string {
  const attrs: Record<string, string> = {
    url: urls.wss,
    welcomeGreeting: GREETING,
    welcomeGreetingInterruptible: "true",
    ttsProvider: config.voice.ttsProvider,
    transcriptionProvider: config.voice.sttProvider,
    speechModel: config.voice.sttModel,
    language: config.voice.language,
    interruptible: "true",
    dtmfDetection: "true",
    reportInputDuringAgentSpeech: "none",
  };
  if (config.voice.ttsVoice) attrs.voice = config.voice.ttsVoice;
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="${esc(urls.https("/relay/action"))}">
    <ConversationRelay ${attrString} />
  </Connect>
</Response>`;
}

/** Warm transfer: ring the on-call broker; the result URL decides the fallback. */
export function escalationDialTwiml(callSid: string): string {
  const result = urls.https(`/escalation/result?callSid=${encodeURIComponent(callSid)}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Connecting you with our on-call broker now.</Say>
  <Dial timeout="${config.escalation.dialTimeoutSeconds}" callerId="${esc(config.twilio.number)}" action="${esc(result)}" method="POST">
    <Number>${esc(config.escalation.phone)}</Number>
  </Dial>
</Response>`;
}

/** Broker did not answer: reassure and hang up. Lead + alert already saved. */
export function escalationFallbackTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Our broker is on another call. We have your details and will call you back within minutes.</Say>
  <Hangup/>
</Response>`;
}

export function hangupTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
}
