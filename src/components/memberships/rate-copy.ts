// Plain-words rendering of src/lib/rates.ts strings (read-only module).
// The rate card keeps "pax", "NM", "transcon" and bare ICAO codes; the
// simplification's dictionary says passengers, nm, coast to coast, and
// city first with the code in parentheses. Numbers pass through untouched.

const CITY_BY_ICAO: Record<string, string> = {
  KVNY: "Los Angeles (VNY)",
  KLAX: "Los Angeles (LAX)",
  KASE: "Aspen (ASE)",
  KTEB: "New York (TEB)",
  KJFK: "New York (JFK)",
  KSFO: "San Francisco (SFO)",
  KMIA: "Miami (MIA)",
  EGLL: "London (LHR)",
  RJTT: "Tokyo (HND)",
};

export function plainMission(mission: string): string {
  return mission
    .replace(/\bpax\b/gi, "passengers")
    .replace(/\bNM\b/g, "nm")
    .replace(/\btranscon\b/gi, "coast to coast");
}

export function plainSample(sample: string): string {
  return sample.replace(/\b[A-Z]{4}\b/g, (code) => CITY_BY_ICAO[code] ?? code);
}

export function plainRate(rate: string): string {
  return rate.replace(/\/HR\b/, "/hr");
}
