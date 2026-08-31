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
  isoDate: string; // YYYY-MM-DD — used to prefill the quote wizard
  duration: string;
  seats: number;
  priceWas: number;
  priceNow: number;
  discountPct: number;
  hoursOut: number;
  operatorBadge: string;
  featured: boolean;
};

// Recently-sold legs shown in the board's empty state. A bare
// "0 available" undercuts the "first call wins" framing; recent fills
// prove the board moves and give the empty state real prices to show.
export type SoldLegView = {
  id: string;
  code: string;
  category: EmptyLegView["category"];
  fromIata: string;
  fromCity: string;
  toIata: string;
  toCity: string;
  priceNow: number;
  discountPct: number;
  /** "sold in 14h" — listing go-live to soldAt. */
  timeToSale: string;
  /** "2 days ago" — soldAt to now. */
  soldAgo: string;
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
