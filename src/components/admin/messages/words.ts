import { relativeTime } from "@/lib/request-format";

/**
 * Plain words for the Messages section. Shared by the thread list (server),
 * the conversation bubbles (client) and the Problems list, so a channel
 * reads the same everywhere: "text", "email", "call note", "voicemail",
 * "WhatsApp", "note".
 */

export const CHANNEL_WORDS: Record<string, string> = {
  sms: "text",
  email: "email",
  call: "call note",
  voicemail: "voicemail",
  whatsapp: "WhatsApp",
  inapp: "note",
  system: "system",
};

export function channelWords(channel: string): string {
  return CHANNEL_WORDS[channel] ?? channel.replace(/_/g, " ");
}

/** "Email to dana@…" / "Text to +1 646…" for the Problems list. */
export function channelSentence(channel: string): string {
  if (channel === "sms") return "Text";
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp message";
  return "Message";
}

/** Internal notes and system lines: full-width gold card, team only. */
export function isTeamOnly(channel: string, direction: "in" | "out"): boolean {
  return channel === "system" || (channel === "inapp" && direction === "out");
}

const DESK_TZ = "America/Los_Angeles";

const WEEKDAY_CLOCK = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DESK_TZ,
});

const MONTH_DAY_CLOCK = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DESK_TZ,
});

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Time on a bubble's meta line: "10 min ago" inside a day, "Fri 1:40 PM"
 * inside a week, "Oct 3, 1:40 PM" beyond.
 */
export function messageWhen(at: Date | null | undefined, now: Date): string {
  if (!at) return "";
  const hours = (now.getTime() - at.getTime()) / 3_600_000;
  if (hours < 24) return relativeTime(at, now);
  if (hours < 24 * 7) return WEEKDAY_CLOCK.format(at).replace(",", "");
  return MONTH_DAY_CLOCK.format(at);
}

/** "Oct 3–5" / "Oct 3 – Nov 2" / "Oct 3" from YYYY-MM-DD strings. */
export function dateRangeWords(first: string | null | undefined, last: string | null | undefined): string | null {
  if (!first) return null;
  const a = new Date(`${first}T12:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  if (!last || last === first) return MONTH_DAY.format(a);
  const b = new Date(`${last}T12:00:00Z`);
  if (Number.isNaN(b.getTime())) return MONTH_DAY.format(a);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${MONTH_DAY.format(a)}–${b.getUTCDate()}`;
  }
  return `${MONTH_DAY.format(a)} – ${MONTH_DAY.format(b)}`;
}

type LegLike = {
  fromCity: string | null;
  fromName: string | null;
  fromIata: string | null;
  toCity: string | null;
  toName: string | null;
  toIata: string | null;
};

function place(city: string | null, name: string | null, iata: string | null): string {
  return city ?? name ?? iata ?? "—";
}

/**
 * "Los Angeles → Aspen" for a one-way or round trip, "A → B → C" for
 * multi-leg. Legs are expected in leg order.
 */
export function routeWords(legs: LegLike[]): string | null {
  if (legs.length === 0) return null;
  const first = legs[0];
  const from = place(first.fromCity, first.fromName, first.fromIata);
  const to = place(first.toCity, first.toName, first.toIata);
  if (legs.length === 1) return `${from} → ${to}`;
  const last = legs[legs.length - 1];
  const back = place(last.toCity, last.toName, last.toIata);
  if (legs.length === 2 && back === from) return `${from} → ${to}`;
  const stops: string[] = [from];
  for (const l of legs) {
    const next = place(l.toCity, l.toName, l.toIata);
    if (stops[stops.length - 1] !== next) stops.push(next);
  }
  return stops.join(" → ");
}

/** "2 min 40 s" from seconds. */
export function durationWords(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export const CONTACT_REASON_WORDS: Record<string, string> = {
  quote: "Quote a flight",
  card: "JetNine Card",
  trip: "Existing trip",
  other: "Something else",
};

export const CALL_OUTCOME_WORDS: Record<string, string> = {
  lead: "New lead",
  escalated: "Handed to a person",
  message: "Left a message",
  abandoned: "Caller hung up",
};

/** Shorten an address for a row: "dana@…" / "+1 646…". */
export function shortAddress(address: string | null | undefined): string {
  if (!address) return "no address";
  const at = address.indexOf("@");
  if (at > 0) return `${address.slice(0, at)}@…`;
  const digits = address.replace(/\s+/g, "");
  return digits.length > 6 ? `${digits.slice(0, 6)}…` : digits;
}
