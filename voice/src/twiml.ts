import { config, urls } from "./config.js";
import { DEFAULT_GREETING, spokenGreeting, voiceAttribute } from "./agent-config.js";
import { builtInAgent, type LoadedAgent } from "./agent-store.js";

// Hand-built TwiML: the shapes are small and the attribute set for
// <ConversationRelay> moves faster than SDK typings do.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The built-in greeting (no live agent), recording notice included. */
export const GREETING = spokenGreeting(DEFAULT_GREETING, config.voice.recordingEnabled);

/** The line dropped and the agent reconnected (a no-transfer call cannot go to the broker). */
export const RECONNECT_GREETING = "Sorry about that, the line dropped for a moment. Could you tell me again how I can help with your flight?";

/**
 * TwiML for the inbound call: connect the caller to our relay WebSocket,
 * with the voice, listening and greeting settings of `agent` (the live
 * voice agent, or the built-in defaults).
 *
 * `missed`: the site's ring-first routing already rang the team, so this is
 * a no-transfer call; the session is told through a <Parameter>.
 * `reconnect`: the previous relay failed and this is the one retry.
 */
export function relayTwiml(opts: { missed?: boolean; reconnect?: boolean; agent?: LoadedAgent } = {}): string {
  const agent = opts.agent ?? builtInAgent();
  const c = agent.config;
  const attrs: Record<string, string> = {
    url: urls.wss,
    welcomeGreeting: opts.reconnect ? RECONNECT_GREETING : spokenGreeting(c.profile.greeting, config.voice.recordingEnabled),
    welcomeGreetingInterruptible: c.speech.greetingInterruptible ? "any" : "none",
    ttsProvider: c.voice.provider,
    transcriptionProvider: c.speech.provider,
    speechModel: c.speech.model,
    language: c.profile.language,
    interruptible: "any",
    interruptSensitivity: c.speech.interruptSensitivity,
    ignoreBackchannel: c.speech.ignoreBackchannel ? "true" : "false",
    dtmfDetection: "true",
    reportInputDuringAgentSpeech: "none",
  };
  const voice = voiceAttribute(c.voice);
  if (voice) attrs.voice = voice;
  if (c.speech.speechTimeoutMs) attrs.speechTimeout = String(c.speech.speechTimeoutMs);
  if (c.speech.hints.trim()) attrs.hints = c.speech.hints.trim();
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(" ");
  const q = new URLSearchParams();
  if (opts.missed) q.set("missed", "1");
  if (opts.reconnect) q.set("reconnect", "1");
  const action = urls.https(`/relay/action${q.size ? `?${q}` : ""}`);
  const params: string[] = [];
  if (opts.missed) params.push(`<Parameter name="noTransfer" value="1" />`);
  if (agent.id) params.push(`<Parameter name="agentId" value="${esc(agent.id)}" />`);
  const inner = params.length ? `\n      ${params.join("\n      ")}\n    ` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="${esc(action)}">
    <ConversationRelay ${attrString}>${inner}</ConversationRelay>
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
  to: string = config.escalation.phone,
): string {
  const result = urls.https(`/escalation/result?callSid=${encodeURIComponent(callSid)}`);
  const screen = urls.https("/escalation/screen");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">${esc(line)}</Say>
  <Dial timeout="${config.escalation.dialTimeoutSeconds}" callerId="${esc(config.twilio.number)}" action="${esc(result)}" method="POST">
    <Number url="${esc(screen)}" method="POST">${esc(to || config.escalation.phone)}</Number>
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

/** A no-transfer call whose relay failed twice: reassure and hang up. Lead + alert already saved. */
export function callbackReassuranceTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Sorry, we are having trouble with the line. We have your number and a broker will call you back shortly. Thank you for calling JetNine.</Say>
  <Hangup/>
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

/** Service booted without its credentials: never leave a caller in silence. */
export function unavailableTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Thank you for calling JetNine. Our line is temporarily unavailable. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
}
