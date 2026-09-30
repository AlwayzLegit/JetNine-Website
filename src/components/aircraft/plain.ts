// Plain-words formatting for the fleet catalog on the public aircraft
// pages. fleet.ts still carries the trade spellings ("1,200 NM", "~4 HR",
// "PAX", "airframe"); the simplification's dictionary says passengers,
// nm after a number, hours, legs and aircraft. Everything here is pure
// string work so it is safe in server and client components alike.

import type { Spec } from "@/lib/fleet";

const fmt = new Intl.NumberFormat("en-US");

/** 1200 → "1,200 nm" */
export function nm(n: number): string {
  return `${fmt.format(n)} nm`;
}

/** 290 → "290 kt" */
export function kt(n: number): string {
  return `${n} kt`;
}

/** "~4 HR" → "~4 hr" */
export function hoursLabel(s: string): string {
  return s.replace(/\s*HR$/i, " hr");
}

/** "~13H 50M" → "~13 h 50 min" */
export function flightTime(s: string): string {
  return s.replace(/(\d+)H\b/i, "$1 h").replace(/(\d+)M\b/i, "$1 min");
}

/** "NEW YORK · TOKYO" → "New York · Tokyo" */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s·(-])([a-z])/g, (_, pre: string, c: string) => pre + c.toUpperCase());
}

/** "$2,950/HR" → "$2,950/hr" */
export function perHour(s: string): string {
  return s.replace(/\/HR$/i, "/hr");
}

export function wifiLabel(w: "YES" | "KA" | "NONE"): string {
  return w === "KA" ? "Ka-band" : w === "YES" ? "Yes" : "No";
}

/** Sentence-case a shouting label: "STEP DOWN" → "Step down". */
export function sentence(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Apply the dictionary to a sentence of catalog copy: NM → nm after a
 * number, PAX → passengers, sector(s) → leg(s), airframe(s) → aircraft.
 * Keeps the capital when a word opened a sentence.
 */
export function plainWords(text: string): string {
  return text
    .replace(/(\d[\d,]*\+?)\s?NM\b/g, "$1 nm")
    .replace(/(\d+)\s?KT\b/g, "$1 kt")
    .replace(/(\d+)\s?PAX\b/g, "$1 passengers")
    .replace(/\bPAX\b/g, "passengers")
    .replace(/\bAirframes?\b/g, "Aircraft")
    .replace(/\bairframes?\b/g, "aircraft")
    .replace(/\bSectors\b/g, "Legs")
    .replace(/\bsectors\b/g, "legs")
    .replace(/\bSector\b/g, "Leg")
    .replace(/\bsector\b/g, "leg");
}

const SPEC_LABELS: Record<string, string> = {
  PAX: "Passengers",
  RANGE: "Range",
  SPEED: "Speed",
  ENDURANCE: "Endurance",
  "CRUISE ALT": "Cruise altitude",
  BAGGAGE: "Baggage",
};

const SPEC_SUBS: Record<string, string> = {
  "Typical config": "Typical layout",
  "Single sector": "One leg",
  "Cruise (M0.90)": "Cruise (Mach 0.90)",
};

/** A hero spec from fleet.ts in plain words. */
export function plainSpec(s: Spec): Spec {
  const label = SPEC_LABELS[s.label] ?? sentence(s.label);
  if (s.label === "CRUISE ALT") {
    return { label, value: `${s.value},000 ft`, sub: "Typical cruise" };
  }
  const value = s.value
    .replace(/\s?NM$/i, " nm")
    .replace(/\s?KT$/i, " kt")
    .replace(/\s?HR$/i, " hr")
    .replace(/\s?CU FT$/i, " cu ft");
  return { label, value, sub: SPEC_SUBS[s.sub] ?? s.sub };
}

/** "ULR" is the only short name that is an acronym; spell it out in prose. */
export function plainShortName(shortName: string, name: string): string {
  return shortName === "ULR" ? name.toLowerCase() : shortName.toLowerCase();
}
