// Sample empty-leg data. Moves to DB (empty_legs table) in Phase C.

export type EmptyLeg = {
  id: string;
  category: "light" | "midsize" | "supermid" | "heavy" | "ultra";
  aircraft: string;
  year: number;
  fromCode: string;
  fromCity: string;
  fromAirport: string;
  toCode: string;
  toCity: string;
  toAirport: string;
  date: string;
  duration: string;
  seats: number;
  priceWas: number;
  priceNow: number;
  discountPct: number;
  hoursOut: number;
  operatorBadge: string;
  featured?: boolean;
};

export const EMPTY_LEGS: EmptyLeg[] = [
  { id: "EL-2841", category: "midsize", aircraft: "Citation Latitude", year: 2019, fromCode: "VNY", fromCity: "Los Angeles", fromAirport: "Van Nuys", toCode: "TEB", toCity: "New York", toAirport: "Teterboro", date: "TODAY · 16:40 PT", duration: "4h 50m", seats: 8, priceWas: 36800, priceNow: 14900, discountPct: 60, hoursOut: 6.2, operatorBadge: "ARG/US Plat ✓", featured: true },
  { id: "EL-2840", category: "light", aircraft: "Phenom 300", year: 2021, fromCode: "ASE", fromCity: "Aspen", fromAirport: "Aspen-Pitkin", toCode: "DAL", toCity: "Dallas", toAirport: "Dallas Love", date: "TOMORROW · 09:15 MT", duration: "2h 25m", seats: 7, priceWas: 18200, priceNow: 8400, discountPct: 54, hoursOut: 24, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2839", category: "supermid", aircraft: "Challenger 350", year: 2020, fromCode: "PBI", fromCity: "Palm Beach", fromAirport: "Palm Beach Intl.", toCode: "VNY", toCity: "Los Angeles", toAirport: "Van Nuys", date: "FRI 14 NOV · 11:00 ET", duration: "5h 10m", seats: 9, priceWas: 52400, priceNow: 21600, discountPct: 59, hoursOut: 72, operatorBadge: "Wyvern Wingman ✓" },
  { id: "EL-2838", category: "heavy", aircraft: "Falcon 2000LX", year: 2018, fromCode: "LAS", fromCity: "Las Vegas", fromAirport: "Henderson Exec.", toCode: "TEB", toCity: "New York", toAirport: "Teterboro", date: "TODAY · 22:15 PT", duration: "4h 30m", seats: 10, priceWas: 64200, priceNow: 27500, discountPct: 57, hoursOut: 12, operatorBadge: "ARG/US Plat ✓", featured: true },
  { id: "EL-2837", category: "midsize", aircraft: "Hawker 900XP", year: 2017, fromCode: "BED", fromCity: "Boston", fromAirport: "Hanscom", toCode: "MIA", toCity: "Miami", toAirport: "Opa-Locka", date: "MON 17 NOV · 13:30 ET", duration: "3h 10m", seats: 8, priceWas: 24800, priceNow: 11200, discountPct: 55, hoursOut: 96, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2836", category: "ultra", aircraft: "Global 6000", year: 2019, fromCode: "SFO", fromCity: "San Francisco", fromAirport: "San Francisco Intl.", toCode: "LHR", toCity: "London", toAirport: "Luton", date: "WED 19 NOV · 21:00 PT", duration: "9h 50m", seats: 14, priceWas: 198000, priceNow: 89000, discountPct: 55, hoursOut: 120, operatorBadge: "Wyvern Wingman ✓" },
  { id: "EL-2835", category: "light", aircraft: "Citation CJ3", year: 2020, fromCode: "TEB", fromCity: "New York", fromAirport: "Teterboro", toCode: "MVY", toCity: "Martha's Vineyard", toAirport: "Martha's Vineyard", date: "TOMORROW · 18:45 ET", duration: "1h 05m", seats: 6, priceWas: 8200, priceNow: 3100, discountPct: 62, hoursOut: 28, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2834", category: "midsize", aircraft: "Citation XLS+", year: 2022, fromCode: "DAL", fromCity: "Dallas", fromAirport: "Dallas Love", toCode: "JAC", toCity: "Jackson Hole", toAirport: "Jackson Hole", date: "SAT 15 NOV · 08:00 CT", duration: "2h 40m", seats: 8, priceWas: 19800, priceNow: 9400, discountPct: 53, hoursOut: 48, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2833", category: "supermid", aircraft: "Citation Sovereign", year: 2018, fromCode: "MIA", fromCity: "Miami", fromAirport: "Opa-Locka", toCode: "ASE", toCity: "Aspen", toAirport: "Aspen-Pitkin", date: "SUN 16 NOV · 10:30 ET", duration: "4h 20m", seats: 9, priceWas: 42600, priceNow: 19800, discountPct: 54, hoursOut: 60, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2832", category: "heavy", aircraft: "Gulfstream G450", year: 2017, fromCode: "LAX", fromCity: "Los Angeles", fromAirport: "LAX", toCode: "HND", toCity: "Tokyo", toAirport: "Haneda", date: "FRI 14 NOV · 23:30 PT", duration: "11h 40m", seats: 12, priceWas: 195000, priceNow: 92000, discountPct: 53, hoursOut: 84, operatorBadge: "Wyvern Wingman ✓" },
  { id: "EL-2831", category: "midsize", aircraft: "Learjet 75", year: 2018, fromCode: "SDL", fromCity: "Scottsdale", fromAirport: "Scottsdale", toCode: "VNY", toCity: "Los Angeles", toAirport: "Van Nuys", date: "TODAY · 19:50 MT", duration: "1h 15m", seats: 8, priceWas: 11400, priceNow: 5200, discountPct: 54, hoursOut: 9, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2830", category: "light", aircraft: "Phenom 100EV", year: 2021, fromCode: "OAK", fromCity: "Oakland", fromAirport: "Oakland Intl.", toCode: "PSP", toCity: "Palm Springs", toAirport: "Palm Springs", date: "TOMORROW · 11:20 PT", duration: "1h 25m", seats: 4, priceWas: 7400, priceNow: 3300, discountPct: 55, hoursOut: 32, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2829", category: "midsize", aircraft: "Citation Latitude", year: 2020, fromCode: "TEB", fromCity: "New York", fromAirport: "Teterboro", toCode: "BHM", toCity: "Birmingham", toAirport: "Birmingham-Shuttlesworth", date: "TUE 18 NOV · 07:30 ET", duration: "2h 15m", seats: 9, priceWas: 16800, priceNow: 7900, discountPct: 53, hoursOut: 108, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2828", category: "supermid", aircraft: "Praetor 600", year: 2022, fromCode: "BFI", fromCity: "Seattle", fromAirport: "Boeing Field", toCode: "TEB", toCity: "New York", toAirport: "Teterboro", date: "WED 19 NOV · 14:00 PT", duration: "5h 05m", seats: 8, priceWas: 51200, priceNow: 23800, discountPct: 54, hoursOut: 132, operatorBadge: "Wyvern Wingman ✓" },
  { id: "EL-2827", category: "midsize", aircraft: "Citation XLS+", year: 2019, fromCode: "ASE", fromCity: "Aspen", fromAirport: "Aspen-Pitkin", toCode: "VNY", toCity: "Los Angeles", toAirport: "Van Nuys", date: "TODAY · 17:30 MT", duration: "2h 05m", seats: 8, priceWas: 14400, priceNow: 6900, discountPct: 52, hoursOut: 7, operatorBadge: "ARG/US Plat ✓" },
  { id: "EL-2826", category: "heavy", aircraft: "Challenger 605", year: 2016, fromCode: "TEB", fromCity: "New York", fromAirport: "Teterboro", toCode: "LAS", toCity: "Las Vegas", toAirport: "Henderson Exec.", date: "FRI 14 NOV · 15:00 ET", duration: "5h 25m", seats: 11, priceWas: 58400, priceNow: 26200, discountPct: 55, hoursOut: 76, operatorBadge: "ARG/US Plat ✓" },
];

export const CATEGORY_LABELS: Record<EmptyLeg["category"], string> = {
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ultra: "Ultra",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export function formatUSD(n: number): string {
  return usd.format(n);
}
