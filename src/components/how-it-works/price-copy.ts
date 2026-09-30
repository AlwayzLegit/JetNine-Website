import type { PriceStackRow } from "@/lib/rates";

// Plain-words rendering of PRICE_STACK (src/lib/rates.ts, read-only).
// The module stores shouting labels ("AIRFRAME") and ICAO codes; the
// simplification wants sentence case, "aircraft", city names and
// "private terminal". Dollar values pass through untouched.
const LABELS: Record<string, string> = {
  "01": "Aircraft",
  "02": "Fuel surcharge",
  "03": "Repositioning",
  "04": "Crew & catering",
  "05": "FET (7.5%)",
  "06": "Ground transport",
};

function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function plainLabel(row: PriceStackRow): string {
  return LABELS[row.n] ?? sentenceCase(row.label);
}

export function plainDesc(row: PriceStackRow): string {
  return row.desc
    .replace("KVNY ⇄ KJFK round-trip", "Los Angeles ⇄ New York round trip")
    .replace("~10h block-time", "about 10 hours in the air")
    .replace("curb-to-FBO", "curb to private terminal")
    .replace(/\bFBO\b/g, "private terminal");
}
