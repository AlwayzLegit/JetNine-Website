import type { AircraftCategorySlug } from "@/lib/fleet";

export type Leg = {
  id: string;
  fromIata?: string;
  toIata?: string;
  fromCity?: string;
  toCity?: string;
  fromName?: string;
  toName?: string;
  distanceNm?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
};

// Hourly rates by aircraft category (USD/hr). Static for now; moves to
// aircraft_categories table in Phase B.
export const HOURLY_USD: Record<AircraftCategorySlug, number> = {
  turboprop: 4500,
  light: 5500,
  midsize: 7500,
  supermid: 9500,
  heavy: 12500,
  ultra: 18000,
};

export const CRUISE_KT: Record<AircraftCategorySlug, number> = {
  turboprop: 290,
  light: 410,
  midsize: 430,
  supermid: 490,
  heavy: 490,
  ultra: 516,
};

export type CateringTier = "standard" | "plus" | "premium" | "custom";
export type GroundType = "none" | "sedan" | "suv";

const CATERING_PER_LEG: Record<Exclude<CateringTier, "custom">, number> = {
  standard: 0,
  plus: 180,
  premium: 450,
};

const GROUND_PER_LEG: Record<Exclude<GroundType, "none">, number> = {
  sedan: 180,
  suv: 280,
};

export type Indicative = {
  low: number;
  high: number;
  hours: number;
  hourly: number;
  formatted: string;
};

export function recommendCategory(pax: number, longestLegNm: number): AircraftCategorySlug {
  if (longestLegNm > 4500 || pax > 12) return "ultra";
  if (longestLegNm > 3000 || pax > 9) return "heavy";
  if (longestLegNm > 2000) return "supermid";
  if (pax > 7) return "midsize";
  return pax <= 4 && longestLegNm < 1200 ? "light" : "midsize";
}

export function computeIndicative({
  category,
  legs,
  catering = "standard",
  ground = "sedan",
}: {
  category: AircraftCategorySlug;
  legs: Leg[];
  catering?: CateringTier;
  ground?: GroundType;
}): Indicative | null {
  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  if (totalDistance === 0 || legs.length === 0) return null;

  const speed = CRUISE_KT[category];
  const hours = Math.max(1.2, totalDistance / speed + 0.4 * legs.length);
  const hourly = HOURLY_USD[category];

  let mid = hourly * hours;
  if (catering !== "custom") mid += CATERING_PER_LEG[catering] * legs.length;
  if (ground !== "none") mid += GROUND_PER_LEG[ground] * legs.length;

  const low = Math.round((mid * 0.85) / 500) * 500;
  const high = Math.round((mid * 1.2) / 500) * 500;

  return {
    low,
    high,
    hours,
    hourly,
    formatted: `${formatUSD(low)} – ${formatUSD(high)}`,
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export function formatUSD(n: number): string {
  return usd.format(n);
}

export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}
