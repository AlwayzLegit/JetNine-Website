import { findAirport, searchAirports } from "@/lib/airports";

// Server-side validation for the empty-leg watchlist form. Pure so it can
// be exercised without a request scope. Added after a bot submitted ~100
// watchlists in August 2026 with random-letter places ("rmEjBsVmkiQbtDPfxle")
// and epoch dates (1970-05-31), each with SMS + email alerts switched on —
// the original action only checked that the fields were non-empty.

export type WatchlistInput = {
  from?: string | null;
  to?: string | null;
  earliest?: string | null;
  latest?: string | null;
  mobile?: string | null;
  email?: string | null;
};

export type ValidWatchlist = {
  fromText: string;
  toText: string;
  fromIcao: string | null;
  toIcao: string | null;
  earliestOn: string;
  latestOn: string;
  mobile: string;
  email: string | null;
};

const MAX_WINDOW_DAYS = 366;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Resolve "KVNY", "VNY", "Los Angeles", "van nuys" to an ICAO where the
// airport table knows the place; null for free text we can't map.
export function resolveIcao(text: string): string | null {
  const direct = findAirport(text);
  if (direct) return direct.icao;
  const q = text.trim().toLowerCase();
  // A city with several fields (Los Angeles: VNY, BUR, LAX) stays free text
  // rather than guessing one; the desk matches legs on the text as well.
  const hits = searchAirports(text, 8).filter(
    (a) => a.city.toLowerCase() === q || a.name.toLowerCase() === q,
  );
  return hits.length === 1 ? hits[0].icao : null;
}

// A place is either something the airport table resolves, or text that
// reads like a place name: letters (plus space . , ' -), 2–40 chars, words
// of at most 14 letters, and no camelCase gibberish — a word is either
// Capitalised/lowercase or ALL CAPS (an airport code), never "rmEjBsVm".
export function isPlausiblePlace(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (resolveIcao(t)) return true;
  if (!/^[A-Za-z][A-Za-z .,'-]*$/.test(t)) return false;
  const words = t.split(/[\s,.'-]+/).filter(Boolean);
  if (words.length === 0) return false;
  for (const w of words) {
    if (w.length > 14) return false;
    const allCaps = w === w.toUpperCase();
    const titleOrLower = w.slice(1) === w.slice(1).toLowerCase();
    if (!allCaps && !titleOrLower) return false;
    if (!/[aeiouyAEIOUY]/.test(w) && w.length > 4) return false;
  }
  return true;
}

function parseIsoDate(s: string): number | null {
  if (!ISO_DATE.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function validateWatchlistInput(
  input: WatchlistInput,
  now: Date = new Date(),
): { ok: true; value: ValidWatchlist } | { ok: false; errors: string[] } {
  const from = input.from?.trim() ?? "";
  const to = input.to?.trim() ?? "";
  const earliest = input.earliest?.trim() ?? "";
  const latest = input.latest?.trim() ?? "";
  const mobile = input.mobile?.trim() ?? "";
  const email = input.email?.trim() ?? "";

  const errors: string[] = [];
  if (!from) errors.push("departing");
  else if (!isPlausiblePlace(from)) errors.push("departing-unrecognised");
  if (!to) errors.push("arriving");
  else if (!isPlausiblePlace(to)) errors.push("arriving-unrecognised");
  if (from && to && from.toLowerCase() === to.toLowerCase()) errors.push("same-airports");

  const e = earliest ? parseIsoDate(earliest) : null;
  const l = latest ? parseIsoDate(latest) : null;
  if (!earliest) errors.push("earliest");
  else if (e === null) errors.push("earliest-format");
  if (!latest) errors.push("latest");
  else if (l === null) errors.push("latest-format");
  if (e !== null && l !== null) {
    // Yesterday (UTC) is the floor so a visitor west of UTC can pick "today".
    const floor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000;
    if (e < floor) errors.push("earliest-past");
    if (l < e) errors.push("latest-before-earliest");
    if (l - e > MAX_WINDOW_DAYS * 86_400_000) errors.push("window-too-long");
  }

  if (!mobile) errors.push("mobile");
  else if (!/^\+?[\d\s().-]{7,}$/.test(mobile) || mobile.replace(/\D/g, "").length < 7) {
    errors.push("mobile-format");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-format");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      fromText: from,
      toText: to,
      fromIcao: resolveIcao(from),
      toIcao: resolveIcao(to),
      earliestOn: earliest,
      latestOn: latest,
      mobile,
      email: email || null,
    },
  };
}
