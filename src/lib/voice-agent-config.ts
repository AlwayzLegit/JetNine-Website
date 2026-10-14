import { z } from "zod";

/**
 * A voice agent's settings (Settings › Voice agent › Agents), in layers in
 * the GoHighLevel style: profile and greeting, voice, speech recognition,
 * AI model, instructions and knowledge, call handling. Stored as one jsonb
 * document per agent (voice_agents.config) and per saved version
 * (voice_agent_versions.config).
 *
 * Pure module: no database, no `server-only`, so check:api can load it.
 *
 * The voice service (voice/src/agent-config.ts) reads the same document
 * with its own lenient parser and the same defaults; check:api fails if
 * the two sets of defaults drift apart.
 */

// ─── Choices ──────────────────────────────────────────────────────────

export const TTS_PROVIDERS = ["ElevenLabs", "Google", "Amazon"] as const;
export const ELEVENLABS_MODELS = ["flash_v2_5", "turbo_v2_5", "flash_v2", "turbo_v2"] as const;
export const STT_PROVIDERS = ["Deepgram", "Google"] as const;
export const INTERRUPT_SENSITIVITY = ["high", "medium", "low"] as const;

/**
 * Starting points for the voice picker. Any ElevenLabs library voice ID
 * works; paste one into "Custom voice ID". An unknown ID makes Twilio drop
 * the call, so test a new voice with a call before making the agent live.
 */
export const ELEVENLABS_VOICES: { id: string; label: string }[] = [
  { id: "", label: "Twilio default (en-US)" },
  { id: "UgBBYS2sOqTuMpoF3BR0", label: "Twilio's en-US voice (explicit)" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · calm, American female" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · soft, American female" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda · warm, American female" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam · deep, American male" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni · well-rounded, American male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh · young, American male" },
];

/** Model suggestions for the AI model field. Empty = the default on Settings › Connections › Phone answering. */
export const LLM_MODEL_SUGGESTIONS = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 · fastest replies (recommended for phone)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 · smarter, a little slower" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 · most capable, slowest" },
] as const;

// ─── Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_GREETING = "Thank you for calling JetNine. How can I help with your flight today?";

/** The agent's main instructions. Transfer rules are added from Call handling; keep them out of here. */
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

export type VoiceAgentConfig = z.infer<typeof VoiceAgentConfigSchema>;

export const DEFAULT_AGENT_CONFIG = {
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
} satisfies VoiceAgentConfig;

// ─── Schema ───────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max);
const unit = z.number().min(0).max(1);

export const VoiceAgentConfigSchema = z.object({
  profile: z.object({
    greeting: text(400).min(1, { error: "The greeting can't be empty" }),
    language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, { error: "Language looks like en-US" }),
  }),
  voice: z.object({
    provider: z.enum(TTS_PROVIDERS),
    voiceId: z.string().trim().max(80).regex(/^[A-Za-z0-9._-]*$/, { error: "A voice ID is letters, digits, dots, dashes or underscores" }),
    model: z.union([z.enum(ELEVENLABS_MODELS), z.literal("")]),
    speed: z.number().min(0.7, { error: "Speed is 0.7 to 1.2" }).max(1.2, { error: "Speed is 0.7 to 1.2" }),
    stability: unit,
    similarity: unit,
  }),
  speech: z.object({
    provider: z.enum(STT_PROVIDERS),
    model: z.string().trim().min(1).max(60),
    speechTimeoutMs: z.number().int().min(600).max(5000).nullable(),
    interruptSensitivity: z.enum(INTERRUPT_SENSITIVITY),
    greetingInterruptible: z.boolean(),
    ignoreBackchannel: z.boolean(),
    hints: text(1000),
  }),
  llm: z.object({
    model: z.string().trim().max(80).regex(/^[a-z0-9.\-]*$/, { error: "A model ID is lower-case letters, digits, dots and dashes" }),
  }),
  instructions: z.object({
    personality: text(600),
    main: text(12000).min(50, { error: "The instructions are too short" }),
    knowledge: text(12000),
    neverSay: text(2000),
  }),
  calls: z.object({
    transfers: z.object({
      enabled: z.boolean(),
      departureWithin48h: z.boolean(),
      askForPerson: z.boolean(),
      activeTrip: z.boolean(),
      struggling: z.boolean(),
      inFlightOrSafety: z.boolean(),
    }),
    transferNumber: z.string().trim().regex(/^(\+[1-9]\d{7,14})?$/, { error: "Transfer number must be E.164, like +18185550123" }),
    askCallbackTime: z.boolean(),
    maxCallMinutes: z.number().int().min(2).max(60),
  }),
});

/** Deep-merge a stored document over the defaults, then validate; anything invalid falls back to the defaults. Never throws. */
export function parseAgentConfig(raw: unknown): VoiceAgentConfig {
  const merged = mergeDefaults(DEFAULT_AGENT_CONFIG, raw);
  const r = VoiceAgentConfigSchema.safeParse(merged);
  return r.success ? r.data : structuredClone(DEFAULT_AGENT_CONFIG);
}

function mergeDefaults<T>(defaults: T, raw: unknown): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return structuredClone(defaults);
  const out: Record<string, unknown> = {};
  for (const [k, dv] of Object.entries(defaults as Record<string, unknown>)) {
    const rv = (raw as Record<string, unknown>)[k];
    out[k] =
      dv && typeof dv === "object" && !Array.isArray(dv)
        ? mergeDefaults(dv, rv)
        : rv === undefined
          ? dv
          : rv;
  }
  return out as T;
}

/** The ConversationRelay `voice` attribute: id[-model][-speed_stability_similarity]. Empty = Twilio's default voice. */
export function voiceAttribute(v: VoiceAgentConfig["voice"]): string {
  if (!v.voiceId) return "";
  if (v.provider !== "ElevenLabs") return v.voiceId;
  const parts = [v.voiceId];
  if (v.model) parts.push(v.model);
  const tuned = v.speed !== 1 || v.stability !== 0.5 || v.similarity !== 0.75;
  if (tuned) parts.push(`${v.speed}_${v.stability}_${v.similarity}`);
  return parts.join("-");
}

/** One line per layer for History and approval cards. */
export function configWords(c: VoiceAgentConfig): string {
  const t = c.calls.transfers;
  const transfers = !t.enabled
    ? "no transfers"
    : [t.departureWithin48h && "48h trips", t.askForPerson && "asks for a person", t.activeTrip && "active trips", t.struggling && "when stuck", t.inFlightOrSafety && "in-flight or safety"]
        .filter(Boolean)
        .join(", ") || "no transfer triggers";
  const voice = c.voice.voiceId ? `${c.voice.provider} ${c.voice.voiceId}` : "Twilio default voice";
  return `${voice} at ${c.voice.speed}x · ${c.llm.model || "default model"} · transfers: ${transfers}`;
}
