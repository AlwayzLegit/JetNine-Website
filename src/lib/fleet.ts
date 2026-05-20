// Static fleet catalog — six categories. Moves to DB (aircraft_categories)
// in Phase B once supply schema lands. Numbers are intentionally approximate;
// the disclaimer "Range varies by load & weather" is shown alongside.

export type AircraftCategory =
  | "turboprop"
  | "light"
  | "midsize"
  | "supermid"
  | "heavy"
  | "ulr";

export type FleetEntry = {
  slug: AircraftCategory;
  href: string;
  name: string;
  shortName: string;
  cap: string;
  tagline: string;
  blurb: string;
  pax: number;
  rangeNm: number;
  speedKt: number;
  enduranceHr: string;
  sampleAircraft: string[];
};

const fmt = new Intl.NumberFormat("en-US");

export const FLEET: FleetEntry[] = [
  {
    slug: "turboprop",
    href: "/aircraft/turboprop",
    name: "Turboprop",
    shortName: "Turboprop",
    cap: "— TURBOPROP, HANGAR",
    tagline: "Short hops, regional missions, unpaved strips.",
    blurb:
      "Short hops, regional missions, unpaved strips. The workhorse — quiet, efficient, capable.",
    pax: 9,
    rangeNm: 1200,
    speedKt: 290,
    enduranceHr: "~4 HR",
    sampleAircraft: ["King Air 350", "Pilatus PC-12"],
  },
  {
    slug: "light",
    href: "/aircraft/light",
    name: "Light",
    shortName: "Light jet",
    cap: "— LIGHT JET, DAWN TARMAC",
    tagline: "The quick-turn workhorse.",
    blurb:
      "The quick-turn workhorse. East-coast hops, regional sectors, fast crew swaps.",
    pax: 7,
    rangeNm: 1660,
    speedKt: 410,
    enduranceHr: "~3.5 HR",
    sampleAircraft: ["Phenom 300", "Citation CJ3+"],
  },
  {
    slug: "midsize",
    href: "/aircraft/midsize",
    name: "Midsize",
    shortName: "Midsize",
    cap: "— MIDSIZE, OVERWING",
    tagline: "Stand-up cabin, coast-to-coast US.",
    blurb:
      "Stand-up cabin, coast-to-coast US, transcontinental Europe. The everyday choice.",
    pax: 9,
    rangeNm: 2400,
    speedKt: 430,
    enduranceHr: "~5 HR",
    sampleAircraft: ["Citation XLS+", "Hawker 900XP"],
  },
  {
    slug: "supermid",
    href: "/aircraft/supermid",
    name: "Super-mid",
    shortName: "Super-mid",
    cap: "— SUPER-MID, CABIN DETAIL",
    tagline: "True transcontinental range, flat-floor cabin.",
    blurb:
      "True transcontinental range with a flat-floor cabin. Transatlantic with a single fuel stop.",
    pax: 9,
    rangeNm: 3500,
    speedKt: 490,
    enduranceHr: "~7 HR",
    sampleAircraft: ["Challenger 350", "Citation Longitude"],
  },
  {
    slug: "heavy",
    href: "/aircraft/heavy",
    name: "Heavy",
    shortName: "Heavy",
    cap: "— HEAVY, EXTERIOR",
    tagline: "Two cabin zones, full galley, crew rest.",
    blurb:
      "Two cabin zones, full galley, crew rest. New York to London, non-stop, comfortable.",
    pax: 14,
    rangeNm: 4500,
    speedKt: 490,
    enduranceHr: "~9 HR",
    sampleAircraft: ["Falcon 2000", "Gulfstream G450"],
  },
  {
    slug: "ulr",
    href: "/aircraft/ultra",
    name: "Ultra long range",
    shortName: "ULR",
    cap: "— ULR, NIGHT TARMAC",
    tagline: "Transpacific in a single sector.",
    blurb:
      "Transpacific in a single sector. LA to Tokyo, NY to Singapore. The longest legs the industry flies.",
    pax: 16,
    rangeNm: 7500,
    speedKt: 516,
    enduranceHr: "~14 HR",
    sampleAircraft: ["Gulfstream G650", "Global 7500"],
  },
];

export function formatNm(n: number): string {
  return `${fmt.format(n)} NM`;
}

export function formatPax(n: number): string {
  return `${n} PAX`;
}

export function formatKt(n: number): string {
  return `${n} KT`;
}

export function getFleetEntry(slug: AircraftCategory): FleetEntry | undefined {
  return FLEET.find((f) => f.slug === slug);
}
