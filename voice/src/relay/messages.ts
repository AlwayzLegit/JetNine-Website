// Twilio ConversationRelay WebSocket message shapes. Everything on the wire
// is JSON text frames; we never touch audio.
// Reference: https://www.twilio.com/docs/voice/twiml/connect/conversationrelay

// ── Inbound (Twilio → us) ──────────────────────────────────────────────
export type SetupMessage = {
  type: "setup";
  sessionId: string;
  callSid: string;
  parentCallSid?: string;
  from: string;
  to: string;
  forwardedFrom?: string;
  callerName?: string;
  direction: string;
  callType: string;
  callStatus: string;
  accountSid: string;
  applicationSid?: string;
  customParameters?: Record<string, string>;
};

export type PromptMessage = {
  type: "prompt";
  voicePrompt: string;
  lang: string;
  last: boolean;
};

export type InterruptMessage = {
  type: "interrupt";
  utteranceUntilInterrupt: string;
  durationUntilInterruptMs: number;
};

export type DtmfMessage = { type: "dtmf"; digit: string };
export type ErrorMessage = { type: "error"; description: string };
export type InfoMessage = { type: "info"; [k: string]: unknown };

export type InboundMessage =
  | SetupMessage
  | PromptMessage
  | InterruptMessage
  | DtmfMessage
  | ErrorMessage
  | InfoMessage;

// ── Outbound (us → Twilio) ─────────────────────────────────────────────
export type TextMessage = {
  type: "text";
  token: string;
  last: boolean;
  /** Whether the caller can barge in on this text. Defaults to the TwiML setting. */
  interruptible?: boolean;
  preemptible?: boolean;
};

export type PlayMessage = {
  type: "play";
  source: string;
  loop?: number;
  preemptible?: boolean;
};

export type SendDigitsMessage = { type: "sendDigits"; digits: string };
export type LanguageMessage = { type: "language"; ttsLanguage?: string; transcriptionLanguage?: string };

/** Ends the ConversationRelay session. Twilio then requests the <Connect action> URL with HandoffData. */
export type EndMessage = { type: "end"; handoffData?: string };

export type OutboundMessage = TextMessage | PlayMessage | SendDigitsMessage | LanguageMessage | EndMessage;

export type HandoffData = {
  action: "escalate" | "hangup";
  reason?: string;
  callSid: string;
  leadId?: string | null;
  summary?: string;
};
