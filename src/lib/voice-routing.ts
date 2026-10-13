/**
 * Who answers an inbound call on the JetNine line, and how long a person
 * gets before the voice agent does (Settings › Voice agent › Routing).
 *
 * Pure module: no database, no `server-only`, so the API registry checks
 * under tsx can load it. The stored row lives in `desk_settings` under
 * VOICE_ROUTING_KEY; src/domain/settings reads and writes it.
 *
 * The call path it drives (src/app/api/voice/*):
 *   Twilio "A call comes in" → /api/voice/inbound
 *     ring first on  → <Dial> the numbers below for `rings` rings
 *                      → /api/voice/connect (answered: done; missed: agent)
 *     ring first off → /api/voice/connect → the agent
 */

export const VOICE_ROUTING_KEY = "voice_routing";

/** A US ring cadence: two seconds on, four off. */
export const SECONDS_PER_RING = 6;
export const RINGS_MIN = 1;
export const RINGS_MAX = 10;
export const RINGS_DEFAULT = 4;
/** People rung at once; the first to answer takes the call. */
export const NUMBERS_MAX = 3;

export const SCHEDULES = ["always"] as const;
export type VoiceSchedule = (typeof SCHEDULES)[number];

export type VoiceRouting = {
  /** Ring the numbers below before the agent answers. */
  ringFirst: boolean;
  /** E.164 numbers rung together. */
  numbers: string[];
  /** Rings before the agent picks up. */
  rings: number;
  /** When ring-first applies. Only "always" today. */
  schedule: VoiceSchedule;
  /**
   * Press 1 to accept: the person who answers hears who is calling and
   * must press 1 before the call connects. A phone's own voicemail cannot,
   * so a call it picks up still reaches the agent.
   */
  screen: boolean;
};

/** Until someone saves the page, every call goes straight to the agent, as before. */
export const VOICE_ROUTING_DEFAULT: VoiceRouting = {
  ringFirst: false,
  numbers: [],
  rings: RINGS_DEFAULT,
  schedule: "always",
  screen: true,
};

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function isE164(s: string): boolean {
  return E164_RE.test(s);
}

/**
 * "818 900 5278", "(818) 900-5278", "1-818-900-5278" → "+18189005278".
 * A leading + keeps the country code as typed. Anything else → null.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return isE164(`+${digits}`) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** "+18189005278" → "(818) 900-5278"; other countries stay E.164. */
export function phoneWords(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** "+18189005278" → "•••5278", for audit rows and approval cards. */
export function maskPhone(e164: string): string {
  return `•••${e164.slice(-4)}`;
}

export function ringSeconds(rings: number): number {
  return rings * SECONDS_PER_RING;
}

export function ringsWords(rings: number): string {
  return `${rings} ${rings === 1 ? "ring" : "rings"} (about ${ringSeconds(rings)} seconds)`;
}

/** A stored row, read leniently: anything malformed falls back field by field. Never throws. */
export function parseVoiceRouting(raw: unknown): VoiceRouting {
  if (!raw || typeof raw !== "object") return { ...VOICE_ROUTING_DEFAULT };
  const r = raw as Record<string, unknown>;
  const numbers = Array.isArray(r.numbers)
    ? [...new Set(r.numbers.filter((n): n is string => typeof n === "string" && isE164(n)))].slice(0, NUMBERS_MAX)
    : [];
  const ringsN = Number(r.rings);
  const rings =
    Number.isInteger(ringsN) && ringsN >= RINGS_MIN && ringsN <= RINGS_MAX ? ringsN : RINGS_DEFAULT;
  const schedule = (SCHEDULES as readonly unknown[]).includes(r.schedule) ? (r.schedule as VoiceSchedule) : "always";
  return {
    ringFirst: r.ringFirst === true && numbers.length > 0,
    numbers,
    rings,
    schedule,
    // Rows saved before screening existed get it: it is what makes ring-first work.
    screen: r.screen !== false,
  };
}

/** Does ring-first apply to a call arriving now? ("always" is the only schedule today.) */
export function ringFirstApplies(routing: VoiceRouting): boolean {
  return routing.ringFirst && routing.numbers.length > 0 && routing.schedule === "always";
}

/** One line for History and approval cards. Numbers are masked. */
export function routingWords(r: VoiceRouting): string {
  if (!r.ringFirst || r.numbers.length === 0) return "the agent answers every call";
  const screen = r.screen ? " (press 1 to accept)" : "";
  return `ring ${r.numbers.map(maskPhone).join(", ")} for ${ringsWords(r.rings)}${screen}, then the agent answers`;
}
