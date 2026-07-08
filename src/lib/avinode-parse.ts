// Best-effort parser for a pasted Avinode aircraft result. Avinode has no
// API, so a dispatcher copies a result block and pastes it; this extracts
// what it confidently can and leaves the rest null for the dispatcher to
// confirm/correct. NEVER blind-trust the output — the UI pre-fills a form
// the dispatcher reviews before saving.

export type ParsedAvinodeOption = {
  operatorCostUsd: number | null;
  positioningTimeMin: number | null;
  positioningAirport: string | null;
  yearOfMake: number | null;
  paxCapacity: number | null;
  aircraftType: string | null;
  operatorNameRaw: string | null;
  totalFlightTimeMin: number | null;
};

// Common business-jet model tokens, longest-first so "Citation Latitude"
// wins over "Citation". Matched case-insensitively as substrings.
const KNOWN_MODELS = [
  "Citation Longitude", "Citation Latitude", "Citation Sovereign", "Citation Excel",
  "Citation XLS+", "Citation XLS", "Citation CJ4", "Citation CJ3", "Citation CJ2",
  "Citation X", "Citation",
  "Phenom 300E", "Phenom 300", "Phenom 100", "Praetor 600", "Praetor 500",
  "Legacy 650", "Legacy 500", "Legacy 450",
  "Challenger 350", "Challenger 300", "Challenger 605", "Challenger 650", "Challenger 850",
  "Global 7500", "Global 6000", "Global 5000", "Global Express",
  "Learjet 75", "Learjet 60", "Learjet 45",
  "Gulfstream G650ER", "Gulfstream G650", "Gulfstream G550", "Gulfstream G450",
  "Gulfstream G280", "Gulfstream GIV", "Gulfstream GV", "G650ER", "G650", "G550", "G450", "G280",
  "Falcon 8X", "Falcon 7X", "Falcon 2000", "Falcon 900", "Falcon 50",
  "Hawker 900XP", "Hawker 800XP", "Hawker 400XP",
  "King Air 350", "King Air 250", "King Air 200", "Pilatus PC-24", "Pilatus PC-12", "PC-24", "PC-12",
  "Nextant", "Beechjet", "Premier",
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function parseAvinodeOption(raw: string): ParsedAvinodeOption {
  const text = raw ?? "";

  // Price: largest "N,NNN USD" figure (all-in price is usually the biggest).
  let operatorCostUsd: number | null = null;
  for (const m of text.matchAll(/([\d,]{3,})\s*(?:USD|\$)/gi)) {
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    if (Number.isFinite(n) && (operatorCostUsd === null || n > operatorCostUsd)) operatorCostUsd = n;
  }
  // Fallback: a leading "$N,NNN".
  if (operatorCostUsd === null) {
    for (const m of text.matchAll(/\$\s*([\d,]{3,})/g)) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && (operatorCostUsd === null || n > operatorCostUsd)) operatorCostUsd = n;
    }
  }

  // Positioning: first "HH:MM ICAO" pairing (e.g. "00:45 KVNY").
  let positioningTimeMin: number | null = null;
  let positioningAirport: string | null = null;
  const pos = text.match(/(\d{1,2}:\d{2})\s+([A-Z]{4})\b/);
  if (pos) {
    positioningTimeMin = toMinutes(pos[1]);
    positioningAirport = pos[2];
  }

  // Total flight time: an "HH:MM" labeled total, else the 2nd HH:MM seen.
  let totalFlightTimeMin: number | null = null;
  const totalLabeled = text.match(/total(?:\s+time)?[^\d]{0,12}(\d{1,2}:\d{2})/i);
  if (totalLabeled) {
    totalFlightTimeMin = toMinutes(totalLabeled[1]);
  } else {
    const times = [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map((m) => m[1]);
    if (times.length >= 2) totalFlightTimeMin = toMinutes(times[1]);
  }

  // Year of make: a plausible 4-digit year (1980–current+1).
  let yearOfMake: number | null = null;
  const nowYear = 2026;
  for (const m of text.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)) {
    const y = parseInt(m[1], 10);
    if (y >= 1980 && y <= nowYear + 1) { yearOfMake = y; break; }
  }

  // Pax: a number adjacent to pax/seats/passengers.
  let paxCapacity: number | null = null;
  const pax = text.match(/(\d{1,2})\s*(?:pax|passengers?|seats?)/i) || text.match(/(?:pax|passengers?|seats?)\D{0,6}(\d{1,2})/i);
  if (pax) {
    const p = parseInt(pax[1], 10);
    if (p >= 1 && p <= 30) paxCapacity = p;
  }

  // Aircraft type: first known model substring (longest-first list).
  let aircraftType: string | null = null;
  const lower = text.toLowerCase();
  for (const model of KNOWN_MODELS) {
    if (lower.includes(model.toLowerCase())) { aircraftType = model; break; }
  }

  // Operator: an "Operated by X" / "Seller: X" line if present (least
  // reliable — dispatcher confirms).
  let operatorNameRaw: string | null = null;
  const op = text.match(/(?:operated by|seller|operator)[:\s]+([A-Za-z0-9 .,&'\-]{3,60})/i);
  if (op) operatorNameRaw = op[1].trim().replace(/\s{2,}/g, " ");

  return {
    operatorCostUsd,
    positioningTimeMin,
    positioningAirport,
    yearOfMake,
    paxCapacity,
    aircraftType,
    operatorNameRaw,
    totalFlightTimeMin,
  };
}
