/**
 * Plain-words helpers for the Clients section of the desk. Pure functions,
 * safe in server and client components alike. Dates arrive as YYYY-MM-DD
 * strings (postgres `date`) or as timestamps; both read as "Oct 3".
 */

import { CATEGORY_PLAIN, formatClock, formatDay } from "@/lib/request-page";
import type { MemberPreferences } from "@/db/schema/member-prefs";

// ─── Dates ──────────────────────────────────────────────────────────────

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const MONTH_DAY_LA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});
const MONTH_DAY_YEAR_LA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Los_Angeles",
});

function parseDay(date: string): Date | null {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 3" from YYYY-MM-DD; adds the year when it is not this year. */
export function shortDay(date: string | null | undefined, now: Date): string | null {
  if (!date) return null;
  const d = parseDay(date);
  if (!d) return null;
  return d.getUTCFullYear() === now.getUTCFullYear() ? MONTH_DAY.format(d) : MONTH_DAY_YEAR.format(d);
}

/** "Jun 3" from a timestamp, in desk time (Los Angeles). */
export function shortStamp(at: Date | null | undefined, now: Date): string | null {
  if (!at) return null;
  return at.getFullYear() === now.getFullYear() ? MONTH_DAY_LA.format(at) : MONTH_DAY_YEAR_LA.format(at);
}

/** "Mar 2024" from YYYY-MM-DD. */
export function monthYear(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = parseDay(date);
  return d ? MONTH_YEAR.format(d) : null;
}

/** "Fri, Oct 3 · 9:00 AM" — the leg's day and local time. */
export function dayAndClock(date: string | null | undefined, time: string | null | undefined): string | null {
  const day = formatDay(date);
  const clock = formatClock(time);
  if (!day) return null;
  return clock ? `${day} · ${clock}` : day;
}

// ─── Routes ─────────────────────────────────────────────────────────────

export type LegWords = {
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
};

function place(city: string | null, name: string | null, iata: string | null): string {
  return city ?? name ?? iata ?? "—";
}

/**
 * "Los Angeles → Aspen" from leg rows: city first, airport name, then the
 * IATA code. A round trip reads as its outbound leg; a multi-leg trip
 * chains every stop.
 */
export function routeFromLegs(legs: LegWords[]): string | null {
  if (legs.length === 0) return null;
  const first = legs[0];
  const from = place(first.fromCity, first.fromName, first.fromIata);
  const to = place(first.toCity, first.toName, first.toIata);
  const isRound =
    legs.length === 2 &&
    place(legs[1].toCity, legs[1].toName, legs[1].toIata) === from &&
    place(legs[1].fromCity, legs[1].fromName, legs[1].fromIata) === to;
  if (legs.length === 1 || isRound) return `${from} → ${to}`;
  return [from, ...legs.map((l) => place(l.toCity, l.toName, l.toIata))].join(" → ");
}

export function flightsWords(n: number): string {
  return `${n} flight${n === 1 ? "" : "s"}`;
}

// ─── Preferences ────────────────────────────────────────────────────────

const GROUND_WORDS: Record<string, string> = {
  none: "handles their own ground transport",
  sedan: "a black sedan on arrival",
  suv_sprinter: "an SUV or Sprinter on arrival",
  custom: "their own car service",
};

const CATERING_WORDS: Record<string, string> = {
  standard: "standard catering",
  plus: "hot meals and a premium bar",
  premium: "a chef-prepared menu",
  custom: "their own caterer",
};

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Prefers text" / "Prefers a call" / "Prefers email", or null when nothing stands out. */
export function reachWords(p: MemberPreferences): string | null {
  const parts: string[] = [];
  if (p.commsSmsUpdates && !p.commsVoice) parts.push("prefers text");
  else if (p.commsVoice && !p.commsSmsUpdates && !p.commsEmail) parts.push("prefers a call");
  else if (p.commsEmail && !p.commsVoice && !p.commsSmsUpdates) parts.push("prefers email");
  else if (p.commsSmsUpdates && p.commsVoice) parts.push("text or call");
  if (p.quietHoursStart && p.quietHoursEnd) {
    const from = formatClock(p.quietHoursStart);
    const to = formatClock(p.quietHoursEnd);
    if (from && to) parts.push(`no calls ${from}–${to}${p.quietHoursTz ? ` (${p.quietHoursTz})` : ""}`);
  }
  return parts.length ? capitalise(parts.join(" · ")) : null;
}

/** Cabin wishes that differ from the defaults, as chip words. */
export function cabinChips(p: MemberPreferences): string[] {
  const chips: string[] = [];
  if (p.defaultAircraftCategory) chips.push(CATEGORY_PLAIN[p.defaultAircraftCategory] ?? p.defaultAircraftCategory);
  if (p.cabinStandup) chips.push("Stand-up cabin");
  if (p.cabinLieflat) chips.push(`Lie-flat over ${p.lieflatMinHours} h`);
  if (p.cabinFlightAttendant) chips.push("Flight attendant");
  if (p.cabinPetFriendly) chips.push("Travels with a pet");
  if (!p.cabinWifi) chips.push("No Wi-Fi needed");
  if (!p.cabinLavatoryEnclosed) chips.push("Open lavatory is fine");
  return chips;
}

export function cateringWords(p: MemberPreferences): string | null {
  const parts: string[] = [];
  if (p.cateringTier !== "standard") parts.push(CATERING_WORDS[p.cateringTier] ?? p.cateringTier);
  if (p.dietary) parts.push(p.dietary);
  if (p.barPreferences) parts.push(`bar: ${p.barPreferences}`);
  return parts.length ? capitalise(parts.join(" · ")) : null;
}

export function groundWords(p: MemberPreferences): string | null {
  const parts: string[] = [];
  if (p.groundType !== "sedan" || p.groundVendor) {
    parts.push(p.groundType === "custom" && p.groundVendor ? p.groundVendor : (GROUND_WORDS[p.groundType] ?? p.groundType));
    if (p.groundType !== "custom" && p.groundVendor) parts.push(p.groundVendor);
  }
  if (p.arrivalWindowMinutes !== 15) parts.push(`arrives ${p.arrivalWindowMinutes} min before`);
  return parts.length ? capitalise(parts.join(" · ")) : null;
}

export function privacyChips(p: MemberPreferences): string[] {
  const chips: string[] = [];
  if (p.anonymizeManifest) chips.push("Keep the manifest anonymous");
  if (p.blockFlightTracking) chips.push("No public flight tracking");
  return chips;
}

/**
 * One line for the Clients list and preview: "Prefers text · midsize jet ·
 * no nuts · an SUV on arrival". Only what differs from the defaults.
 */
export function prefsLine(p: MemberPreferences | null | undefined): string | null {
  if (!p) return null;
  const parts: string[] = [];
  const reach = reachWords(p);
  if (reach) parts.push(reach);
  parts.push(...cabinChips(p).map((c) => c.toLowerCase()));
  if (p.dietary) parts.push(p.dietary);
  else if (p.cateringTier !== "standard") parts.push(CATERING_WORDS[p.cateringTier] ?? p.cateringTier);
  if (p.groundType !== "sedan") {
    parts.push(p.groundType === "custom" && p.groundVendor ? p.groundVendor : (GROUND_WORDS[p.groundType] ?? p.groundType));
  }
  parts.push(...privacyChips(p).map((c) => c.toLowerCase()));
  if (!parts.length) return null;
  return capitalise(parts.join(" · "));
}

// ─── Membership ─────────────────────────────────────────────────────────

export function isReserveProgram(program: string | null | undefined): boolean {
  return Boolean(program && program.startsWith("reserve_"));
}

export const LEDGER_KIND_WORDS: Record<string, string> = {
  top_up: "Deposit",
  credit_accrual: "Cashback",
  refund: "Refund",
  charter_draw: "Charter payment",
  adjustment: "Adjustment",
};

export function ledgerKindWords(kind: string): string {
  return LEDGER_KIND_WORDS[kind] ?? kind.replace(/_/g, " ");
}

export const RELATION_WORDS: Record<string, string> = {
  spouse: "Spouse",
  family: "Family",
  business: "Business",
  assistant: "Assistant",
  pet: "Pet",
  other: "Companion",
};

export const DOC_WORDS: Record<string, string> = {
  passport: "Passport",
  global_entry: "Global Entry",
  known_traveler: "Known Traveler Number",
  second_passport: "Second passport",
};

export const ACCOUNT_STATUS_WORDS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};
