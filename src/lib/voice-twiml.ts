/**
 * TwiML for the call path in front of the voice agent (src/app/api/voice/*).
 * Pure: builds strings, reads nothing. The agent itself (voice/ on Render)
 * builds its own TwiML once a call reaches it.
 */

import { ringSeconds } from "@/lib/voice-routing";

const SAY_VOICE = "Polly.Matthew-Neural";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const doc = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`;

const say = (text: string) => `<Say voice="${SAY_VOICE}">${esc(text)}</Say>`;

/**
 * Ring every number at once for `rings` rings. The caller hears ringing
 * throughout (answerOnBridge), and the person rung sees the caller's own
 * number. With `screen`, whoever answers first hears screenTwiml() and
 * must press 1 before the call connects. Whatever happens, Twilio then
 * posts the outcome to `action`.
 */
export function ringFirstTwiml(args: { numbers: string[]; rings: number; action: string; screen?: string }): string {
  const url = args.screen ? ` url="${esc(args.screen)}" method="POST"` : "";
  const numbers = args.numbers.map((n) => `<Number${url}>${esc(n)}</Number>`).join("");
  return doc(
    `<Dial timeout="${ringSeconds(args.rings)}" answerOnBridge="true" action="${esc(args.action)}" method="POST">${numbers}</Dial>`,
  );
}

/**
 * Press 1 to accept, played to the person who picked up (the caller still
 * hears ringing). A phone's own voicemail never presses 1, so the leg ends
 * unbridged and the call goes on to the agent. Asked twice, about 12 s.
 */
export function screenTwiml(args: { from: string; action: string }): string {
  const ask = (text: string) =>
    `<Gather input="dtmf" numDigits="1" timeout="5" action="${esc(args.action)}" method="POST">${say(text)}</Gather>`;
  return doc(
    ask(`JetNine call, press 1 to accept. Caller ${args.from}.`) +
      ask("Press 1 to accept the call.") +
      say("Sending it to the assistant.") +
      "<Hangup/>",
  );
}

/** Pressed 1: an empty document ends the screening and bridges the call. */
export function screenAcceptTwiml(): string {
  return doc("");
}

/** Hand the call to another TwiML document (the agent, or a retry of ours). */
export function redirectTwiml(url: string): string {
  return doc(`<Redirect method="POST">${esc(url)}</Redirect>`);
}

/** The agent is waking up: keep the caller company, then ask again. */
export function holdTwiml(args: { next: string; attempt: number }): string {
  const line =
    args.attempt === 0
      ? say("Thank you for calling JetNine. One moment while I connect you.")
      : args.attempt % 2 === 0
        ? say("Thank you for holding. Still connecting you.")
        : "";
  return doc(`${line}<Pause length="3"/><Redirect method="POST">${esc(args.next)}</Redirect>`);
}

/** Nobody can take the call: take a message. */
export function voicemailTwiml(action: string): string {
  return doc(
    say(
      "Thank you for calling JetNine. We could not get to the phone. Please leave your name, your number and your trip details after the tone, and we will call you right back.",
    ) +
      `<Record maxLength="180" timeout="6" playBeep="true" trim="trim-silence" action="${esc(action)}" method="POST"/>` +
      say("We did not hear a message. Please call us back or request a quote at jetnine.com. Goodbye.") +
      "<Hangup/>",
  );
}

export function voicemailThanksTwiml(): string {
  return doc(say("Thank you. We will call you back shortly. Goodbye.") + "<Hangup/>");
}

export function hangupTwiml(): string {
  return doc("<Hangup/>");
}

export function emptyTwiml(): string {
  return doc("");
}
