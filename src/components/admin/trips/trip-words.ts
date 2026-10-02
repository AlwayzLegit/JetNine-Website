import { formatClock, formatDay, formatMinutes } from "@/lib/request-format";

/**
 * Plain-words helpers for the Trips section of the desk. Pure functions over
 * the trip / trip_legs rows — no DB, no `Date.now()`; callers pass `now`.
 */

export const DESK_TZ = "America/Los_Angeles";

export type LegLike = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  departTz: string | null;
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
};

// ─── Places ─────────────────────────────────────────────────────────────

const AIRPORT_NOISE = /\b(international|intl|airport|airfield|municipal|regional|county|field|executive)\b/gi;

function shortAirport(name: string): string {
  return name.replace(AIRPORT_NOISE, "").replace(/\s{2,}/g, " ").replace(/[\s\-–]+$/g, "").trim();
}

/**
 * "Los Angeles (Van Nuys)" / "Aspen" / "New York (Teterboro)". The airport
 * goes in parentheses only when its name says something the city does not.
 */
export function placeWords(
  city: string | null | undefined,
  name: string | null | undefined,
  iata: string | null | undefined,
): string {
  const c = city?.trim();
  const n = name?.trim();
  if (!c) return n || iata || "Airport to confirm";
  if (!n) return c;
  const short = shortAirport(n);
  const cl = c.toLowerCase();
  const sl = short.toLowerCase();
  if (!sl || sl.includes(cl) || cl.includes(sl)) return c;
  return `${c} (${short})`;
}

/** City only — for titles ("Dana Whitfield · Los Angeles → Aspen"). */
export function cityWords(
  city: string | null | undefined,
  name: string | null | undefined,
  iata: string | null | undefined,
): string {
  return city?.trim() || name?.trim() || iata || "Airport to confirm";
}

export function legRoute(leg: LegLike): string {
  return `${placeWords(leg.fromCity, leg.fromName, leg.fromIata)} → ${placeWords(leg.toCity, leg.toName, leg.toIata)}`;
}

// ─── Mission ────────────────────────────────────────────────────────────

export function missionWords(missionType: string, legCount: number): string {
  switch (missionType) {
    case "one_way":
      return "one way";
    case "round":
      return "round trip";
    case "multi_leg":
      return legCount > 1 ? `${legCount} legs` : "multi-leg";
    case "empty_leg_purchase":
      return "empty leg";
    case "repositioning_internal":
      return "repositioning";
    default:
      return missionType.replace(/_/g, " ");
  }
}

// ─── Time ───────────────────────────────────────────────────────────────

const DAY_KEY_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function dayKeyFormatter(tz: string): Intl.DateTimeFormat {
  let f = DAY_KEY_FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    DAY_KEY_FMT_CACHE.set(tz, f);
  }
  return f;
}

/** YYYY-MM-DD of an instant in a timezone. */
export function dayKey(d: Date, tz = DESK_TZ): string {
  try {
    return dayKeyFormatter(tz).format(d);
  } catch {
    return dayKeyFormatter(DESK_TZ).format(d);
  }
}

/** YYYY-MM-DD `days` days after a YYYY-MM-DD key. */
export function shiftDayKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The leg's calendar day in its own timezone (or the desk's). */
export function legDayKey(leg: LegLike): string | null {
  if (leg.departDate) return String(leg.departDate).slice(0, 10);
  if (leg.scheduledDepAt) return dayKey(leg.scheduledDepAt, leg.departTz ?? DESK_TZ);
  return null;
}

/** "Fri, Oct 3" for the leg, or null. */
export function legDayWords(leg: LegLike): string | null {
  return formatDay(legDayKey(leg));
}

function clockInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: DESK_TZ, hour: "numeric", minute: "2-digit" }).format(d);
  }
}

/** "9:00 AM" from the stored local time, else from the scheduled instant. */
export function legDepartClock(leg: LegLike): string | null {
  const fromField = formatClock(leg.departTime);
  if (fromField) return fromField;
  if (leg.scheduledDepAt) return clockInTz(leg.scheduledDepAt, leg.departTz ?? DESK_TZ);
  return null;
}

/** "4:55 PM" of the scheduled arrival (shown in the departure's timezone). */
export function legArriveClock(leg: LegLike): string | null {
  if (!leg.scheduledArrAt) return null;
  return clockInTz(leg.scheduledArrAt, leg.departTz ?? DESK_TZ);
}

/** "about 2 h 10 min" from the scheduled instants, or null. */
export function legDurationWords(leg: LegLike): string | null {
  if (!leg.scheduledDepAt || !leg.scheduledArrAt) return null;
  const min = Math.round((leg.scheduledArrAt.getTime() - leg.scheduledDepAt.getTime()) / 60_000);
  return formatMinutes(min);
}

/** "Fri, Oct 3 · departs 9:00 AM · about 2 h 10 min" */
export function legSentence(leg: LegLike): string {
  const parts: string[] = [];
  const day = legDayWords(leg);
  if (day) parts.push(day);
  const dep = legDepartClock(leg);
  if (dep) parts.push(`departs ${dep}`);
  const dur = legDurationWords(leg);
  if (dur) parts.push(dur);
  return parts.length ? parts.join(" · ") : "Date and time to confirm";
}

// ─── Aircraft ───────────────────────────────────────────────────────────

/** "Challenger 350 · N350JN · Jet Edge" from whatever the trip stores. */
export function aircraftLine(args: {
  makeModel?: string | null;
  tailNumber?: string | null;
  operatorName?: string | null;
  /** Fallbacks from the option the client chose on the request. */
  optionType?: string | null;
  optionTail?: string | null;
  optionOperator?: string | null;
}): string | null {
  const type = args.makeModel ?? args.optionType ?? null;
  const tail = args.tailNumber ?? args.optionTail ?? null;
  const op = args.operatorName ?? args.optionOperator ?? null;
  const parts = [type, tail, op].filter((x): x is string => Boolean(x && x.trim()));
  return parts.length ? parts.join(" · ") : null;
}

// ─── Ground ─────────────────────────────────────────────────────────────

/** Plain words for the ground option the client picked on the request. */
export function groundWords(option: string | null | undefined): string | null {
  switch (option) {
    case "sedan":
      return "Black sedan booked";
    case "suv_sprinter":
      return "SUV / Sprinter booked";
    case "custom":
      return "Custom ground arrangement";
    default:
      return null;
  }
}
