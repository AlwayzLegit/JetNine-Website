import type { Airport } from "@/lib/airports";

/**
 * A picker airport (src/lib/airports.ts) as a minimal `airports` row, so a
 * quote can always be saved: quote_legs FKs its ICAOs to airports.icao, and
 * the picker has outgrown the seeds before (migration 0055). The seeds
 * carry the curated rows; this is the safety net for anything added to
 * the picker since. Pure: no database, no `server-only`.
 */

const TZ: Record<string, string> = {
  PT: "America/Los_Angeles",
  MT: "America/Denver",
  CT: "America/Chicago",
  ET: "America/New_York",
  BRT: "America/Sao_Paulo",
  BST: "Europe/London",
  CEST: "Europe/Paris",
  GST: "Asia/Dubai",
  JST: "Asia/Tokyo",
  HKT: "Asia/Hong_Kong",
  SGT: "Asia/Singapore",
  AEST: "Australia/Sydney",
};

/** ICAO prefix → ISO country. Two-letter prefixes first, then one-letter regions. */
const COUNTRY: [string, string][] = [
  ["MY", "BS"], ["MM", "MX"], ["SB", "BR"], ["EG", "GB"], ["LF", "FR"], ["LS", "CH"], ["OM", "AE"],
  ["RJ", "JP"], ["VH", "HK"], ["WS", "SG"], ["YS", "AU"],
  ["K", "US"], ["C", "CA"],
];

export function countryForIcao(icao: string): string | null {
  const u = icao.toUpperCase();
  for (const [prefix, iso] of COUNTRY) if (u.startsWith(prefix)) return iso;
  return null;
}

export type AirportRow = {
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  countryIso2: string;
  lat: string;
  lon: string;
  tz: string | null;
};

/** null when the country can't be told from the ICAO: the FK fails then, as before, rather than a wrong row being written. */
export function airportRowFromCatalog(a: Airport): AirportRow | null {
  const countryIso2 = countryForIcao(a.icao);
  if (!countryIso2 || !/^[A-Z0-9]{4}$/.test(a.icao)) return null;
  return {
    icao: a.icao,
    iata: /^[A-Z]{3}$/.test(a.iata) ? a.iata : null,
    name: a.name,
    city: a.city,
    countryIso2,
    lat: a.lat.toFixed(5),
    lon: a.lon.toFixed(5),
    tz: TZ[a.tz] ?? null,
  };
}
