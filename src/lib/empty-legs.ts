// Live-board view-model shape for the marketing /empty-legs page.
// Source of truth is now the public.empty_legs table (Phase C.3).

export type EmptyLegView = {
  id: string;
  code: string;
  category: "light" | "midsize" | "supermid" | "heavy" | "ultra" | "turboprop";
  aircraft: string; // "Citation Latitude 2019" etc.
  fromIata: string;
  fromCity: string;
  fromAirport: string;
  toIata: string;
  toCity: string;
  toAirport: string;
  date: string; // already formatted for the board
  duration: string;
  seats: number;
  priceWas: number;
  priceNow: number;
  discountPct: number;
  hoursOut: number;
  operatorBadge: string;
  featured: boolean;
};

export const CATEGORY_LABELS: Record<EmptyLegView["category"], string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ultra: "Ultra",
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export function formatUSD(n: number): string {
  return usd.format(n);
}
