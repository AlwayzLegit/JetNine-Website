import { formatDay, timeOfDay, tripTypeWords } from "@/lib/request-page";
import { CRUISE_KT } from "@/lib/quote-pricing";
import type { AircraftCategorySlug } from "@/lib/fleet";

/**
 * Plain-words helpers shared by the Requests list and the one-request page.
 * Pure functions only — no React, no database.
 */

export type PlaceLeg = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  distanceNm?: number | null;
};

/** Cities with more than one common business-aviation field. */
const MULTI_FIELD_CITIES = new Set([
  "new york",
  "london",
  "chicago",
  "washington",
  "paris",
  "dallas",
  "houston",
  "tokyo",
  "moscow",
]);

/** "Teterboro Airport" → "Teterboro"; "Aspen/Pitkin County Airport" → "Aspen/Pitkin County". */
export function shortAirportName(name: string | null | undefined): string | null {
  if (!name) return null;
  return (
    name
      .replace(/\s+(international|intl\.?|executive)?\s*airport$/i, "")
      .replace(/\s+(international|intl\.?)$/i, "")
      .trim() || name
  );
}

/** "Los Angeles", "New York (Teterboro)", or the airport name / code when no city is stored. */
export function placeWords(
  city: string | null | undefined,
  name: string | null | undefined,
  iata: string | null | undefined,
): string {
  const c = city?.trim();
  if (c) {
    const short = shortAirportName(name);
    if (MULTI_FIELD_CITIES.has(c.toLowerCase()) && short && short.toLowerCase() !== c.toLowerCase()) {
      return `${c} (${short})`;
    }
    return c;
  }
  return shortAirportName(name) ?? iata ?? "—";
}

/** "Van Nuys Airport (VNY)" — the 13px steel line under a city. */
export function airportWords(name: string | null | undefined, iata: string | null | undefined): string | null {
  const n = name?.trim();
  if (n && iata) return n.toLowerCase().includes(iata.toLowerCase()) ? n : `${n} (${iata})`;
  return n ?? iata ?? null;
}

export function fromWords(l: PlaceLeg): string {
  return placeWords(l.fromCity, l.fromName, l.fromIata);
}

export function toWords(l: PlaceLeg): string {
  return placeWords(l.toCity, l.toName, l.toIata);
}

/** "Los Angeles → Aspen" from the first leg (round trips read as out → back). */
export function routeWords(legs: PlaceLeg[]): string | null {
  const first = legs[0];
  if (!first) return null;
  return `${fromWords(first)} → ${toWords(first)}`;
}

/** "morning" / "afternoon" / … from HH:MM, for "(morning)" parentheticals. */
export function dayPart(time: string | null | undefined): string | null {
  const t = timeOfDay(time);
  if (!t) return null;
  return t.replace(/^in the /, "").replace(/^around /, "").replace(/^late in the /, "late ");
}

/** "Fri Oct 3 (morning)". */
export function dayWithPart(date: string | null | undefined, time: string | null | undefined): string | null {
  const d = formatDay(date);
  if (!d) return null;
  const p = dayPart(time);
  return p ? `${d} (${p})` : d;
}

/**
 * The one-line trip sentence used in the Requests list:
 * "Los Angeles → Aspen · Fri Oct 3 – Sun Oct 5" (round trip)
 * "New York (Teterboro) → West Palm Beach · Wed Oct 8 · one way"
 * "New York → London · Oct 15 · 3 legs"
 */
export function tripSentence(legs: PlaceLeg[], tripType: "one_way" | "round" | "multi_leg"): string {
  const sorted = [...legs].sort((a, b) => a.legNumber - b.legNumber);
  const first = sorted[0];
  if (!first) return "Route not set yet";
  const route = `${fromWords(first)} → ${toWords(first)}`;
  const out = formatDay(first.departDate);
  if (tripType === "round") {
    const back = formatDay(sorted[sorted.length - 1]?.departDate);
    const when = out && back && back !== out ? `${out} – ${back}` : out;
    return when ? `${route} · ${when}` : route;
  }
  if (tripType === "one_way") {
    return out ? `${route} · ${out} · one way` : `${route} · one way`;
  }
  const n = sorted.length;
  return out ? `${route} · ${out} · ${n} legs` : `${route} · ${n} legs`;
}

/** "Fri Oct 3 (morning) – Sun Oct 5 (afternoon) · 4 passengers · round trip" */
export function tripLeadWords(
  legs: PlaceLeg[],
  tripType: "one_way" | "round" | "multi_leg",
  passengers: string,
): string {
  const sorted = [...legs].sort((a, b) => a.legNumber - b.legNumber);
  const first = sorted[0];
  const parts: string[] = [];
  if (first) {
    const out = dayWithPart(first.departDate, first.departTime);
    if (tripType === "round" && sorted.length > 1) {
      const last = sorted[sorted.length - 1];
      const back = dayWithPart(last.departDate, last.departTime);
      if (out && back) parts.push(`${out} – ${back}`);
      else if (out) parts.push(out);
    } else if (tripType === "multi_leg") {
      if (out) parts.push(`${sorted.length} legs from ${out}`);
      else parts.push(`${sorted.length} legs`);
    } else if (out) {
      parts.push(out);
    }
  }
  parts.push(passengers);
  parts.push(tripTypeWords(tripType));
  return parts.join(" · ");
}

const SOURCE_WORDS: Record<string, string> = {
  homepage_widget: "the homepage",
  quote_wizard: "the quote form",
  dispatch_phone: "phone",
  dispatch_email: "email",
  empty_leg_inquiry: "an empty-leg inquiry",
};

export function sourceWords(source: string): string {
  return SOURCE_WORDS[source] ?? source.replace(/_/g, " ");
}

/** Name fallback when the contact snapshot has no name. */
export function namelessWords(source: string): string {
  if (source === "dispatch_phone") return "Phone request";
  if (source === "dispatch_email") return "Email request";
  return "No name yet";
}

/** "text and email" from the contact-methods flags. */
export function contactMethodsWords(
  m: { email?: boolean; phone?: boolean; sms?: boolean } | null | undefined,
): string | null {
  if (!m) return null;
  const parts = [m.sms ? "text" : null, m.phone ? "a call" : null, m.email ? "email" : null].filter(
    (x): x is string => Boolean(x),
  );
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const BEST_TIME_WORDS: Record<string, string> = {
  morning: "best in the morning",
  midday: "best around midday",
  afternoon: "best in the afternoon",
  evening: "best in the evening",
  latenight: "best late in the evening",
};

export function bestTimeWords(t: string | null | undefined): string | null {
  if (!t || t === "any") return null;
  return BEST_TIME_WORDS[t] ?? null;
}

/** Lowercase category words for option rows: "midsize", "super-mid", "ultra long range". */
export const CATEGORY_SHORT: Record<string, string> = {
  turboprop: "turboprop",
  light: "light",
  midsize: "midsize",
  supermid: "super-mid",
  heavy: "heavy",
  ulr: "ultra long range",
  ultra: "ultra long range",
};

export function categoryShort(c: string | null | undefined): string | null {
  if (!c) return null;
  return CATEGORY_SHORT[c] ?? c.replace(/_/g, " ");
}

/** Short membership words for a list row: "JetNine Card", "Reserve". */
export function membershipShort(tier: string | null | undefined): string | null {
  if (!tier || tier === "on_demand") return null;
  if (tier.startsWith("card_")) return "JetNine Card";
  if (tier.startsWith("reserve_")) return "Reserve";
  return tier.replace(/_/g, " ");
}

/** Estimated block minutes for a route from the quote's category (null when unknown). */
export function estimateFlightMinutes(
  totalDistanceNm: number,
  legCount: number,
  category: string | null | undefined,
): number | null {
  if (!totalDistanceNm || legCount === 0) return null;
  const slug = (category === "ulr" ? "ultra" : category) as AircraftCategorySlug | null;
  const speed = slug ? CRUISE_KT[slug] : undefined;
  if (!speed) return null;
  return Math.round((totalDistanceNm / speed) * 60 + 24 * legCount);
}

/** "Oct 2, 9:12 AM" in the desk's time zone. */
const STAMP_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function stampWords(d: Date | null | undefined): string | null {
  return d ? STAMP_FMT.format(d) : null;
}
