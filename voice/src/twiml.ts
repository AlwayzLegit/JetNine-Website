import { config, urls } from "./config.js";

// Hand-built TwiML: the shapes are small and the attribute set for
// <ConversationRelay> moves faster than SDK typings do.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GREETING = config.voice.recordingEnabled
  ? "Thank you for calling JetNine. This call may be recorded. How can I help with your flight?"
  : "Thank you for calling JetNine. How can I help with your flight?";

/** After the team's phones rang out (the site's ring-first routing sends `?missed=1`). */
export const MISSED_GREETING = config.voice.recordingEnabled
  ? "Thanks for holding. The team couldn't get to the phone, so this is JetNine's virtual assistant. This call may be recorded. How can I help with your flight?"
  : "Thanks for holding. The team couldn't get to the phone, so this is JetNine's virtual assistant. How can I help with your flight?";

/** TwiML for the inbound call: connect the caller to our relay WebSocket. */
export function relayTwiml(opts: { missed?: boolean } = {}): string {
  const attrs: Record<string, string> = {
    url: urls.wss,
    welcomeGreeting: opts.missed ? MISSED_GREETING : GREETING,
    welcomeGreetingInterruptible: "true",
    ttsProvider: config.voice.ttsProvider,
    transcriptionProvider: config.voice.sttProvider,
    speechModel: config.voice.sttModel,
    language: config.voice.language,
    interruptible: "any",
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

/**
 * Warm transfer: ring the on-call broker; the result URL decides the
 * fallback. Press 1 to accept: whoever answers hears escalationScreenTwiml()
 * and the caller is connected only after they press 1, so the broker's own
 * voicemail cannot take the call.
 */
export function escalationDialTwiml(
  callSid: string,
  line = "Connecting you with our on-call broker now.",
): string {
  const result = urls.https(`/escalation/result?callSid=${encodeURIComponent(callSid)}`);
  const screen = urls.https("/escalation/screen");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">${esc(line)}</Say>
  <Dial timeout="${config.escalation.dialTimeoutSeconds}" callerId="${esc(config.twilio.number)}" action="${esc(result)}" method="POST">
    <Number url="${esc(screen)}" method="POST">${esc(config.escalation.phone)}</Number>
  </Dial>
</Response>`;
}

/**
 * Played to the broker's phone before the transfer connects. Only 1
 * connects; any other key, no key (a voicemail) or hanging up ends this leg
 * unbridged, and /escalation/result treats the transfer as unanswered.
 */
export function escalationScreenTwiml(): string {
  const action = esc(urls.https("/escalation/screen/answer"));
  const ask = (text: string) =>
    `<Gather input="dtmf" numDigits="1" timeout="5" action="${action}" method="POST"><Say voice="Polly.Matthew-Neural">${esc(text)}</Say></Gather>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>${ask("JetNine transfer. A caller is asking for a broker. Press 1 to accept.")}${ask("Press 1 to accept the transfer.")}<Hangup/></Response>`;
}

/** Pressed 1: an empty document ends screening and bridges the transfer. */
export function escalationAcceptTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
}

/** The agent's session failed mid-call: apologise and transfer rather than drop the caller. */
export const RELAY_FAILED_LINE = "Sorry, I lost the connection on my end. Let me connect you with our broker now.";

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

/** Service booted without its credentials: never leave a caller in silence. */
export function unavailableTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Thank you for calling JetNine. Our line is temporarily unavailable. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
}
