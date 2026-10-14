// A voice agent's settings, as saved on the site (Settings › Voice agent ›
// Agents, table voice_agents). The site validates with zod
// (src/lib/voice-agent-config.ts); this side reads leniently: anything
// missing or malformed falls back to the default, field by field, so a bad
// row can never stop the phone. Pure module (no env, no database), so the
// site's check:api can compare the defaults and fail if they drift.

export type TransferTriggers = {
  enabled: boolean;
  departureWithin48h: boolean;
  askForPerson: boolean;
  activeTrip: boolean;
  struggling: boolean;
  inFlightOrSafety: boolean;
};

export type VoiceAgentConfig = {
  profile: { greeting: string; language: string };
  voice: { provider: "ElevenLabs" | "Google" | "Amazon"; voiceId: string; model: string; speed: number; stability: number; similarity: number };
  speech: {
    provider: "Deepgram" | "Google";
    model: string;
    speechTimeoutMs: number | null;
    interruptSensitivity: "high" | "medium" | "low";
    greetingInterruptible: boolean;
    ignoreBackchannel: boolean;
    hints: string;
  };
  llm: { model: string };
  instructions: { personality: string; main: string; knowledge: string; neverSay: string };
  calls: { transfers: TransferTriggers; transferNumber: string; askCallbackTime: boolean; maxCallMinutes: number };
};

export const DEFAULT_GREETING = "Thank you for calling JetNine. How can I help with your flight today?";

export const DEFAULT_INSTRUCTIONS = `You are the voice concierge for JetNine, a private jet charter brokerage. You are answering a live phone call. Everything you write is spoken aloud to the caller by a text-to-speech engine.

YOUR JOB, IN ORDER
1. Charter quote requests are the main reason people call. Gather, conversationally: origin, destination, travel date or dates, one way or round trip, number of passengers, the caller's name, the best callback number (the caller ID is the default; confirm it), and email if offered. Note any urgency.
2. Save what you learn with the save_lead tool AS FIELDS ARRIVE, not only at the end. A partial lead is still a lead. Call save_lead again whenever you learn something new.
3. Answer brokerage questions plainly, using the knowledge you were given.
4. Anything that is not a charter inquiry (vendors, operators offering aircraft, press, job seekers) becomes a message via save_message.

PHONE NUMBERS
- A US phone number has exactly ten digits: three, three, then four. If you heard fewer or more, say you missed a digit and ask for it again, slowly.
- Read numbers back in groups, like "eight one eight, five five five, zero one two three", and wait for a yes.

HOW YOU SPEAK
- Talk like a friendly, experienced person on the phone, not a script. Use contractions. Keep most replies to one or two short sentences.
- Never use lists, bullets, markdown, headings, emoji, or symbols. Say numbers and times the way people say them: "eight PM", "twelve passengers".
- Say airport and city names in full.
- Ask ONE question at a time, then stop and wait.
- Acknowledge briefly ("Got it", "Perfect") and move on. Do not repeat the caller's whole sentence back.
- If the caller asks you to slow down, change your tone, or talk more naturally, do it from then on without commenting on it.
- If asked whether you are an AI, say yes plainly in one short sentence and keep helping.

NEVER
- Never state or estimate a price, hourly rate, or dollar figure of any kind. A broker prepares the exact quote and sends it today.
- Never claim an aircraft is available, name a tail number, or promise a specific aircraft type.
- Never invent trip details, times, or facts. If you do not know, say a broker will confirm.
- Never give regulatory, legal, safety, or medical advice.

FLOW
- The caller has already heard the greeting. Respond to what they said.
- Before a tool that takes a moment, you may say "One moment." only if you have not said anything else this turn.
- When the conversation is complete, say what happens next in one sentence, thank them, and call end_call with a one-line summary. Do not linger.
- If the caller is silent or says goodbye, wrap up and call end_call.`;

export const DEFAULT_KNOWLEDGE = `- JetNine is a charter broker, not an operator: it arranges flights on aircraft operated by FAA Part 135 certificated carriers, under a Part 295 indirect air carrier model.
- Access to more than twenty thousand aircraft worldwide through its operator network.
- Quotes are prepared by a broker and sent the same day. There are no instant prices on the phone.
- Empty legs exist; take the caller's details and a broker follows up with what is available.
- Same-day and next-day departures happen often; more notice means more aircraft choice.`;

export const DEFAULT_AGENT_CONFIG: VoiceAgentConfig = {
  profile: {
    greeting: DEFAULT_GREETING,
    language: "en-US",
  },
  voice: {
    provider: "ElevenLabs",
    voiceId: "",
    model: "flash_v2_5",
    speed: 1,
    stability: 0.5,
    similarity: 0.75,
  },
  speech: {
    provider: "Deepgram",
    model: "nova-3-general",
    speechTimeoutMs: null,
    interruptSensitivity: "medium",
    greetingInterruptible: false,
    ignoreBackchannel: true,
    hints: "JetNine, Van Nuys, Teterboro, Gulfstream, Citation, Challenger, empty leg",
  },
  llm: {
    model: "",
  },
  instructions: {
    personality: "Warm, calm and efficient, like an excellent hotel concierge who also knows aviation.",
    main: DEFAULT_INSTRUCTIONS,
    knowledge: DEFAULT_KNOWLEDGE,
    neverSay: "",
  },
  calls: {
    transfers: {
      enabled: true,
      departureWithin48h: true,
      askForPerson: true,
      activeTrip: true,
      struggling: true,
      inFlightOrSafety: true,
    },
    transferNumber: "",
    askCallbackTime: true,
    maxCallMinutes: 15,
  },
};

// ─── Lenient parse ─────────────────────────────────────────────────────

const ENUMS: Record<string, readonly string[]> = {
  "voice.provider": ["ElevenLabs", "Google", "Amazon"],
  "speech.provider": ["Deepgram", "Google"],
  "speech.interruptSensitivity": ["high", "medium", "low"],
};
const RANGES: Record<string, [number, number]> = {
  "voice.speed": [0.7, 1.2],
  "voice.stability": [0, 1],
  "voice.similarity": [0, 1],
  "speech.speechTimeoutMs": [600, 5000],
  "calls.maxCallMinutes": [2, 60],
};

function pick(path: string, dv: unknown, rv: unknown): unknown {
  if (rv === undefined) return dv;
  if (path === "speech.speechTimeoutMs") {
    if (rv === null) return null;
    return typeof rv === "number" && rv >= 600 && rv <= 5000 ? Math.round(rv) : dv;
  }
  if (typeof dv === "boolean") return typeof rv === "boolean" ? rv : dv;
  if (typeof dv === "number") {
    if (typeof rv !== "number" || !Number.isFinite(rv)) return dv;
    const r = RANGES[path];
    return r && (rv < r[0] || rv > r[1]) ? dv : rv;
  }
  if (typeof dv === "string") {
    if (typeof rv !== "string") return dv;
    const e = ENUMS[path];
    if (e && !e.includes(rv)) return dv;
    // Required text keeps its default when cleared.
    if ((path === "profile.greeting" || path === "instructions.main" || path === "speech.model") && !rv.trim()) return dv;
    return rv;
  }
  return dv;
}

function merge<T>(defaults: T, raw: unknown, prefix = ""): T {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [k, dv] of Object.entries(defaults as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out[k] = dv && typeof dv === "object" ? merge(dv, src[k], path) : pick(path, dv, src[k]);
  }
  return out as T;
}

export function parseAgentConfig(raw: unknown): VoiceAgentConfig {
  return merge(DEFAULT_AGENT_CONFIG, raw);
}

// ─── What the call is built from ───────────────────────────────────────

/** ConversationRelay `voice`: id[-model][-speed_stability_similarity]. Empty = Twilio's default voice. */
export function voiceAttribute(v: VoiceAgentConfig["voice"]): string {
  if (!v.voiceId) return "";
  if (v.provider !== "ElevenLabs") return v.voiceId;
  const parts = [v.voiceId];
  if (v.model) parts.push(v.model);
  const tuned = v.speed !== 1 || v.stability !== 0.5 || v.similarity !== 0.75;
  if (tuned) parts.push(`${v.speed}_${v.stability}_${v.similarity}`);
  return parts.join("-");
}

/** The greeting with the recording notice after its first sentence (California two-party consent). */
export function spokenGreeting(greeting: string, recording: boolean): string {
  const g = greeting.trim();
  if (!recording || /record/i.test(g)) return g;
  const m = /^(.*?[.!?])\s+(.+)$/s.exec(g);
  return m ? `${m[1]} This call may be recorded. ${m[2]}` : `${g} This call may be recorded.`;
}

/** escalate tool reasons → the trigger that allows them. */
export const REASON_TRIGGER: Record<string, keyof TransferTriggers> = {
  departure_within_48h: "departureWithin48h",
  caller_requested_human: "askForPerson",
  existing_client_active_trip: "activeTrip",
  agent_failing: "struggling",
  in_progress_flight_or_safety: "inFlightOrSafety",
  other: "enabled",
};

export function transferAllowed(c: VoiceAgentConfig, reason: string, noTransfer: boolean): boolean {
  const t = c.calls.transfers;
  if (noTransfer || !t.enabled) return false;
  return t[REASON_TRIGGER[reason] ?? "enabled"];
}

const TRIGGER_WORDS: Record<Exclude<keyof TransferTriggers, "enabled">, string> = {
  departureWithin48h: "the departure is within forty-eight hours (save the lead first)",
  askForPerson: "the caller asks for a human, a person, an agent, a broker or a representative (transfer on the first ask)",
  activeTrip: "the caller is an existing client with an active trip (you are told this in the call context)",
  struggling: "you have failed to understand for two turns in a row, or the caller sounds frustrated",
  inFlightOrSafety: "anything involving a flight already in progress, a delay, or a safety concern",
};

/** The stable, cacheable system block for one agent. */
export function agentPersona(c: VoiceAgentConfig): string {
  const parts = [c.instructions.main.trim()];
  if (c.instructions.personality.trim()) parts.push(`PERSONALITY AND TONE\n${c.instructions.personality.trim()}`);
  if (c.instructions.knowledge.trim()) parts.push(`WHAT YOU KNOW ABOUT JETNINE\n${c.instructions.knowledge.trim()}`);
  if (c.instructions.neverSay.trim()) parts.push(`NEVER SAY OR PROMISE\n${c.instructions.neverSay.trim()}`);

  const t = c.calls.transfers;
  const on = (Object.keys(TRIGGER_WORDS) as (keyof typeof TRIGGER_WORDS)[]).filter((k) => t.enabled && t[k]);
  const off = (Object.keys(TRIGGER_WORDS) as (keyof typeof TRIGGER_WORDS)[]).filter((k) => !t.enabled || !t[k]);
  const callback = c.calls.askCallbackTime
    ? "save the details, confirm the best callback number, ask when they would like a broker to call (save it as callback_time), tell them a broker will call them back and that urgent trips are handled first, then wrap up"
    : "save the details, confirm the best callback number, tell them a broker will call them back and that urgent trips are handled first, then wrap up";
  const rules = ["TRANSFERS"];
  if (on.length) {
    rules.push(`Use the escalate tool the moment any of these is true; say one short handoff sentence first, like "Let me connect you with our on-call broker right now.":`);
    for (const k of on) rules.push(`- ${TRIGGER_WORDS[k]}`);
  } else {
    rules.push("This agent never transfers calls. Never call the escalate tool and never offer or mention a transfer.");
  }
  if (off.length && on.length) {
    rules.push("Do NOT transfer in these cases; instead " + callback + ":");
    for (const k of off) rules.push(`- ${TRIGGER_WORDS[k]}`);
  } else if (!on.length) {
    rules.push(`When a caller needs a person or the trip is urgent, ${callback}.`);
  }
  parts.push(rules.join("\n"));
  return parts.join("\n\n");
}
