// Inline airport catalog for quote-wizard autocomplete. ~40 most-used in the
// JetNine network. Will move to a DB-backed table in Phase B (airports).

export type Airport = {
  iata: string;
  icao: string;
  city: string;
  name: string;
  lat: number;
  lon: number;
  tz: string;
};

export const AIRPORTS: Airport[] = [
  // North America · West
  { iata: "VNY", icao: "KVNY", city: "Los Angeles", name: "Van Nuys", lat: 34.21, lon: -118.49, tz: "PT" },
  { iata: "LAX", icao: "KLAX", city: "Los Angeles", name: "Los Angeles Intl.", lat: 33.94, lon: -118.41, tz: "PT" },
  { iata: "BUR", icao: "KBUR", city: "Burbank", name: "Hollywood Burbank", lat: 34.20, lon: -118.36, tz: "PT" },
  { iata: "PSP", icao: "KPSP", city: "Palm Springs", name: "Palm Springs", lat: 33.83, lon: -116.51, tz: "PT" },
  { iata: "SFO", icao: "KSFO", city: "San Francisco", name: "San Francisco Intl.", lat: 37.62, lon: -122.38, tz: "PT" },
  { iata: "OAK", icao: "KOAK", city: "Oakland", name: "Oakland Intl.", lat: 37.72, lon: -122.22, tz: "PT" },
  { iata: "BFI", icao: "KBFI", city: "Seattle", name: "Boeing Field", lat: 47.53, lon: -122.30, tz: "PT" },
  { iata: "SEA", icao: "KSEA", city: "Seattle", name: "Seattle-Tacoma Intl.", lat: 47.45, lon: -122.31, tz: "PT" },
  { iata: "LAS", icao: "KLAS", city: "Las Vegas", name: "Harry Reid Intl.", lat: 36.08, lon: -115.15, tz: "PT" },
  { iata: "HND", icao: "KHND", city: "Las Vegas", name: "Henderson Exec.", lat: 35.97, lon: -115.13, tz: "PT" },
  { iata: "SDL", icao: "KSDL", city: "Scottsdale", name: "Scottsdale", lat: 33.62, lon: -111.91, tz: "MT" },
  { iata: "ASE", icao: "KASE", city: "Aspen", name: "Aspen-Pitkin", lat: 39.22, lon: -106.87, tz: "MT" },
  { iata: "JAC", icao: "KJAC", city: "Jackson Hole", name: "Jackson Hole", lat: 43.61, lon: -110.74, tz: "MT" },

  // North America · Central & South
  { iata: "DAL", icao: "KDAL", city: "Dallas", name: "Dallas Love", lat: 32.85, lon: -96.85, tz: "CT" },
  { iata: "DFW", icao: "KDFW", city: "Dallas", name: "Dallas-Fort Worth Intl.", lat: 32.90, lon: -97.04, tz: "CT" },
  { iata: "HOU", icao: "KHOU", city: "Houston", name: "Hobby", lat: 29.65, lon: -95.28, tz: "CT" },
  { iata: "BHM", icao: "KBHM", city: "Birmingham", name: "Birmingham-Shuttlesworth", lat: 33.56, lon: -86.75, tz: "CT" },

  // North America · East
  { iata: "TEB", icao: "KTEB", city: "New York", name: "Teterboro", lat: 40.85, lon: -74.06, tz: "ET" },
  { iata: "JFK", icao: "KJFK", city: "New York", name: "John F. Kennedy Intl.", lat: 40.64, lon: -73.78, tz: "ET" },
  { iata: "LGA", icao: "KLGA", city: "New York", name: "LaGuardia", lat: 40.78, lon: -73.87, tz: "ET" },
  { iata: "EWR", icao: "KEWR", city: "Newark", name: "Newark Liberty", lat: 40.69, lon: -74.17, tz: "ET" },
  { iata: "MVY", icao: "KMVY", city: "Martha's Vineyard", name: "Martha's Vineyard", lat: 41.39, lon: -70.61, tz: "ET" },
  { iata: "BED", icao: "KBED", city: "Boston", name: "Hanscom Field", lat: 42.47, lon: -71.29, tz: "ET" },
  { iata: "BOS", icao: "KBOS", city: "Boston", name: "Logan Intl.", lat: 42.36, lon: -71.01, tz: "ET" },
  { iata: "IAD", icao: "KIAD", city: "Washington", name: "Dulles Intl.", lat: 38.94, lon: -77.46, tz: "ET" },
  { iata: "DCA", icao: "KDCA", city: "Washington", name: "Ronald Reagan National", lat: 38.85, lon: -77.04, tz: "ET" },
  { iata: "MIA", icao: "KMIA", city: "Miami", name: "Miami Intl.", lat: 25.79, lon: -80.29, tz: "ET" },
  { iata: "OPF", icao: "KOPF", city: "Miami", name: "Opa-Locka Exec.", lat: 25.91, lon: -80.28, tz: "ET" },
  { iata: "PBI", icao: "KPBI", city: "Palm Beach", name: "Palm Beach Intl.", lat: 26.68, lon: -80.10, tz: "ET" },

  // Canada / LATAM
  { iata: "YYZ", icao: "CYYZ", city: "Toronto", name: "Toronto Pearson", lat: 43.68, lon: -79.63, tz: "ET" },
  { iata: "GIG", icao: "SBGL", city: "Rio de Janeiro", name: "Rio Galeão", lat: -22.81, lon: -43.25, tz: "BRT" },

  // Europe
  { iata: "LTN", icao: "EGGW", city: "London", name: "Luton", lat: 51.87, lon: -0.37, tz: "BST" },
  { iata: "FAB", icao: "EGLF", city: "Farnborough", name: "Farnborough", lat: 51.27, lon: -0.78, tz: "BST" },
  { iata: "LHR", icao: "EGLL", city: "London", name: "Heathrow", lat: 51.47, lon: -0.46, tz: "BST" },
  { iata: "LBG", icao: "LFPB", city: "Paris", name: "Le Bourget", lat: 48.97, lon: 2.44, tz: "CEST" },
  { iata: "CDG", icao: "LFPG", city: "Paris", name: "Charles de Gaulle", lat: 49.01, lon: 2.55, tz: "CEST" },
  { iata: "GVA", icao: "LSGG", city: "Geneva", name: "Geneva", lat: 46.24, lon: 6.11, tz: "CEST" },
  { iata: "ZRH", icao: "LSZH", city: "Zurich", name: "Zurich", lat: 47.46, lon: 8.55, tz: "CEST" },

  // Middle East / Asia / Oceania
  { iata: "DXB", icao: "OMDB", city: "Dubai", name: "Dubai Intl.", lat: 25.25, lon: 55.36, tz: "GST" },
  { iata: "HND_JP", icao: "RJTT", city: "Tokyo", name: "Haneda", lat: 35.55, lon: 139.78, tz: "JST" },
  { iata: "HKG", icao: "VHHH", city: "Hong Kong", name: "Hong Kong Intl.", lat: 22.31, lon: 113.92, tz: "HKT" },
  { iata: "SIN", icao: "WSSS", city: "Singapore", name: "Changi", lat: 1.36, lon: 103.99, tz: "SGT" },
  { iata: "SYD", icao: "YSSY", city: "Sydney", name: "Kingsford Smith", lat: -33.95, lon: 151.18, tz: "AEST" },
];

export function findAirport(query: string): Airport | undefined {
  const q = query.trim().toUpperCase();
  return AIRPORTS.find(
    (a) => a.iata.toUpperCase() === q || a.icao.toUpperCase() === q,
  );
}

export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = AIRPORTS.map((a) => {
    let score = 0;
    const iata = a.iata.toLowerCase();
    const icao = a.icao.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    if (iata === q || icao === q) score += 100;
    else if (iata.startsWith(q) || icao.startsWith(q)) score += 70;
    else if (city.startsWith(q)) score += 50;
    else if (name.startsWith(q)) score += 30;
    else if (city.includes(q) || name.includes(q)) score += 15;
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.a);
}

// Great-circle distance in nautical miles between two airports.
export function distanceNm(from: Airport, to: Airport): number {
  const R = 3440.065; // earth radius in nm
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}
