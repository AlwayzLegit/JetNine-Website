// Aircraft model catalog — one entry per charterable model page
// (/aircraft/{category}/{model}). Performance figures (pax, range,
// speed, year, wifi, photo) are pulled from the fleet catalog's sample
// airframes at module init so the model pages and category sample cards
// can never disagree. Cabin dimensions, baggage, and ceiling are typical
// published-configuration figures, rendered with a "typical config"
// disclaimer on-page.
import { FLEET, type AircraftCategorySlug, type SampleAircraft } from "@/lib/fleet";

export type AircraftModel = {
  slug: string;
  category: AircraftCategorySlug;
  /** Full display name, e.g. "Embraer Phenom 300E". */
  name: string;
  manufacturer: string;
  /** Name without manufacturer, e.g. "Phenom 300E" — used in H1s/queries. */
  shortName: string;
  /** 1-2 sentence dispatcher's take. */
  lead: string;
  /** What the desk actually books it for. */
  knownFor: string;
  cabin: { heightFt: string; widthFt: string; lengthFt: string };
  baggageCuFt: number;
  ceilingFt: number;
  /** 2-3 lanes within the model's real range, IATA codes from lib/airports. */
  routes: { from: string; to: string; label: string }[];
  /** Filled from the fleet sample at init. */
  sample: SampleAircraft;
};

type ModelSeed = Omit<AircraftModel, "sample"> & { sampleName: string };

const SEEDS: ModelSeed[] = [
  // ── Turboprop ──
  {
    slug: "king-air-350i",
    category: "turboprop",
    name: "Beechcraft King Air 350i",
    manufacturer: "Beechcraft",
    shortName: "King Air 350i",
    sampleName: "Beechcraft King Air 350i",
    lead: "The default answer when the runway is short and the party isn't. Nine seats, honest hauling, and the most forgiving short-field manners in the lineup.",
    knownFor: "Mountain strips, nine-up regional missions, and routes where jets wait for a slot the King Air doesn't need.",
    cabin: { heightFt: "4'9\"", widthFt: "4'6\"", lengthFt: "19'6\"" },
    baggageCuFt: 55,
    ceilingFt: 35000,
    routes: [
      { from: "VNY", to: "ASE", label: "LA to Aspen" },
      { from: "LAX", to: "LAS", label: "LA to Las Vegas" },
      { from: "SDL", to: "ASE", label: "Scottsdale to Aspen" },
    ],
  },
  {
    slug: "pc-12-ngx",
    category: "turboprop",
    name: "Pilatus PC-12 NGX",
    manufacturer: "Pilatus",
    shortName: "PC-12 NGX",
    sampleName: "Pilatus PC-12 NGX",
    lead: "A single turbine with an airline-grade dispatch record and a cargo door that swallows what light jets can't. The Swiss utility knife.",
    knownFor: "Gravel strips, ski gear and dogs aboard, and per-hour economics no twin can match.",
    cabin: { heightFt: "4'10\"", widthFt: "5'0\"", lengthFt: "16'11\"" },
    baggageCuFt: 40,
    ceilingFt: 30000,
    routes: [
      { from: "VNY", to: "ASE", label: "LA to Aspen" },
      { from: "SEA", to: "SFO", label: "Seattle to San Francisco" },
      { from: "BUR", to: "PSP", label: "Burbank to Palm Springs" },
    ],
  },
  {
    slug: "tbm-960",
    category: "turboprop",
    name: "Daher TBM 960",
    manufacturer: "Daher",
    shortName: "TBM 960",
    sampleName: "Daher TBM 960",
    lead: "The fastest single-engine turboprop in production — 330 knots on a fraction of a jet's burn. Four to six aboard, jet-like door-to-door times under 800 NM.",
    knownFor: "Solo-executive and couple missions where speed matters and the airline connection doesn't exist.",
    cabin: { heightFt: "4'0\"", widthFt: "3'11\"", lengthFt: "13'3\"" },
    baggageCuFt: 35,
    ceilingFt: 31000,
    routes: [
      { from: "BUR", to: "LAS", label: "Burbank to Las Vegas" },
      { from: "VNY", to: "SFO", label: "LA to San Francisco" },
      { from: "LAX", to: "PSP", label: "LA to Palm Springs" },
    ],
  },
  // ── Light ──
  {
    slug: "phenom-300e",
    category: "light",
    name: "Embraer Phenom 300E",
    manufacturer: "Embraer",
    shortName: "Phenom 300E",
    sampleName: "Embraer Phenom 300E",
    lead: "The best-selling light jet on earth for a decade running, and the reason why: airliner avionics, an oversized baggage hold, and 464 knots of honest cruise.",
    knownFor: "The 2-3 hour business triangle — fast turns, full bags, six colleagues, no compromises.",
    cabin: { heightFt: "4'11\"", widthFt: "5'1\"", lengthFt: "17'2\"" },
    baggageCuFt: 74,
    ceilingFt: 45000,
    routes: [
      { from: "VNY", to: "ASE", label: "LA to Aspen" },
      { from: "TEB", to: "PBI", label: "New York to Palm Beach" },
      { from: "LAX", to: "SEA", label: "LA to Seattle" },
    ],
  },
  {
    slug: "citation-cj4",
    category: "light",
    name: "Cessna Citation CJ4",
    manufacturer: "Cessna",
    shortName: "Citation CJ4",
    sampleName: "Cessna Citation CJ4",
    lead: "The top of the CJ line: light-jet operating costs with range that brushes midsize territory. Single-pilot certified, always crewed with two on our board.",
    knownFor: "Longer light-jet legs — 2,000+ NM nonstops that would force a fuel stop in anything smaller.",
    cabin: { heightFt: "4'9\"", widthFt: "4'10\"", lengthFt: "17'4\"" },
    baggageCuFt: 77,
    ceilingFt: 45000,
    routes: [
      { from: "TEB", to: "MIA", label: "New York to Miami" },
      { from: "VNY", to: "SEA", label: "LA to Seattle" },
      { from: "DAL", to: "LAS", label: "Dallas to Las Vegas" },
    ],
  },
  {
    slug: "learjet-75-liberty",
    category: "light",
    name: "Learjet 75 Liberty",
    manufacturer: "Bombardier",
    shortName: "Learjet 75 Liberty",
    sampleName: "Learjet 75 Liberty",
    lead: "The last Learjet, and it flies like the badge suggests — a 51,000-foot ceiling and fighter-adjacent climb that tops the weather everyone else rides through.",
    knownFor: "Six passengers who care about ride quality: highest cruise in the light category, above the chop.",
    cabin: { heightFt: "4'11\"", widthFt: "5'1\"", lengthFt: "19'9\"" },
    baggageCuFt: 50,
    ceilingFt: 51000,
    routes: [
      { from: "TEB", to: "PBI", label: "New York to Palm Beach" },
      { from: "LAX", to: "LAS", label: "LA to Las Vegas" },
      { from: "BOS", to: "MIA", label: "Boston to Miami" },
    ],
  },
  // ── Midsize ──
  {
    slug: "citation-xls-plus",
    category: "midsize",
    name: "Cessna Citation XLS+",
    manufacturer: "Cessna",
    shortName: "Citation XLS+",
    sampleName: "Cessna Citation XLS+",
    lead: "The most chartered business jet in the world, full stop. A stand-up cabin at near-light-jet rates and a fleet so large there's almost always one in position.",
    knownFor: "Availability. When the mission is midsize and the date is soon, the XLS+ is usually the airframe that says yes.",
    cabin: { heightFt: "5'8\"", widthFt: "5'6\"", lengthFt: "18'6\"" },
    baggageCuFt: 80,
    ceilingFt: 45000,
    routes: [
      { from: "JFK", to: "MIA", label: "New York to Miami" },
      { from: "VNY", to: "DAL", label: "LA to Dallas" },
      { from: "LAX", to: "SEA", label: "LA to Seattle" },
    ],
  },
  {
    slug: "hawker-900xp",
    category: "midsize",
    name: "Hawker 900XP",
    manufacturer: "Hawker",
    shortName: "Hawker 900XP",
    sampleName: "Hawker 900XP",
    lead: "The widest cabin in its class and near-3,000 NM legs — a midsize that flies like a small heavy. The genuinely flat floor is rarer than it sounds.",
    knownFor: "Transcon nonstops with eight aboard, and passengers who measure a cabin by shoulder room, not brochure length.",
    cabin: { heightFt: "5'9\"", widthFt: "6'0\"", lengthFt: "21'3\"" },
    baggageCuFt: 50,
    ceilingFt: 41000,
    routes: [
      { from: "VNY", to: "TEB", label: "LA to New York" },
      { from: "SEA", to: "DAL", label: "Seattle to Dallas" },
      { from: "JFK", to: "PBI", label: "New York to Palm Beach" },
    ],
  },
  {
    slug: "learjet-60xr",
    category: "midsize",
    name: "Learjet 60XR",
    manufacturer: "Bombardier",
    shortName: "Learjet 60XR",
    sampleName: "Learjet 60XR",
    lead: "Midsize cabin, Learjet climb: to 41,000 feet in under 20 minutes and a 51,000-foot ceiling. The value play of the category on shorter missions.",
    knownFor: "Time-critical hops where its climb-over-the-weather profile and market pricing beat newer metal.",
    cabin: { heightFt: "5'8\"", widthFt: "5'11\"", lengthFt: "17'8\"" },
    baggageCuFt: 55,
    ceilingFt: 51000,
    routes: [
      { from: "JFK", to: "MIA", label: "New York to Miami" },
      { from: "LAX", to: "DAL", label: "LA to Dallas" },
      { from: "TEB", to: "OPF", label: "New York to Miami Opa-Locka" },
    ],
  },
  // ── Super-mid ──
  {
    slug: "challenger-350",
    category: "supermid",
    name: "Bombardier Challenger 350",
    manufacturer: "Bombardier",
    shortName: "Challenger 350",
    sampleName: "Bombardier Challenger 350",
    lead: "The segment's benchmark and its best seller: a flat-floor, stand-up cabin that does coast-to-coast nonstop with ten aboard and Ka-band Wi-Fi that actually works.",
    knownFor: "The default transcon answer — LA to New York, westbound against the winds, without a fuel stop.",
    cabin: { heightFt: "6'1\"", widthFt: "7'2\"", lengthFt: "25'2\"" },
    baggageCuFt: 106,
    ceilingFt: 45000,
    routes: [
      { from: "VNY", to: "TEB", label: "LA to New York" },
      { from: "LAX", to: "JFK", label: "LAX to JFK" },
      { from: "SEA", to: "MIA", label: "Seattle to Miami" },
    ],
  },
  {
    slug: "citation-longitude",
    category: "supermid",
    name: "Cessna Citation Longitude",
    manufacturer: "Cessna",
    shortName: "Citation Longitude",
    sampleName: "Cessna Citation Longitude",
    lead: "Cessna's flagship — the quietest cabin in the category and a 3,500 NM reach on markedly gentle operating economics. New enough that most tails still smell like delivery.",
    knownFor: "Long domestic legs where cabin noise level decides whether you land rested or ragged.",
    cabin: { heightFt: "6'0\"", widthFt: "6'5\"", lengthFt: "25'2\"" },
    baggageCuFt: 112,
    ceilingFt: 45000,
    routes: [
      { from: "VNY", to: "TEB", label: "LA to New York" },
      { from: "SFO", to: "MIA", label: "San Francisco to Miami" },
      { from: "BOS", to: "LAS", label: "Boston to Las Vegas" },
    ],
  },
  {
    slug: "praetor-600",
    category: "supermid",
    name: "Embraer Praetor 600",
    manufacturer: "Embraer",
    shortName: "Praetor 600",
    sampleName: "Embraer Praetor 600",
    lead: "The longest legs in the super-mid class — 4,000 NM, full fly-by-wire, and turbulence-smoothing tech inherited from airliners twice its size.",
    knownFor: "Missions at the category's edge: deep transcons and Atlantic crossings that would otherwise force a heavy-jet invoice.",
    cabin: { heightFt: "6'0\"", widthFt: "6'10\"", lengthFt: "27'6\"" },
    baggageCuFt: 155,
    ceilingFt: 45000,
    routes: [
      { from: "TEB", to: "LTN", label: "New York to London" },
      { from: "VNY", to: "TEB", label: "LA to New York" },
      { from: "MIA", to: "SEA", label: "Miami to Seattle" },
    ],
  },
  // ── Heavy ──
  {
    slug: "gulfstream-g450",
    category: "heavy",
    name: "Gulfstream G450",
    manufacturer: "Gulfstream",
    shortName: "Gulfstream G450",
    sampleName: "Gulfstream G450",
    lead: "The proven Atlantic workhorse: fourteen seats, two cabin zones, and the Gulfstream oval windows that made the brand a shorthand. Depth of fleet keeps charter pricing honest.",
    knownFor: "New York to Europe with a full manifest — the heavy-jet mission, done by the airframe that defined it.",
    cabin: { heightFt: "6'2\"", widthFt: "7'4\"", lengthFt: "45'1\"" },
    baggageCuFt: 169,
    ceilingFt: 45000,
    routes: [
      { from: "JFK", to: "LHR", label: "New York to London" },
      { from: "TEB", to: "LBG", label: "New York to Paris" },
      { from: "LAX", to: "JFK", label: "LAX to JFK" },
    ],
  },
  {
    slug: "challenger-605",
    category: "heavy",
    name: "Bombardier Challenger 605",
    manufacturer: "Bombardier",
    shortName: "Challenger 605",
    sampleName: "Bombardier Challenger 605",
    lead: "The widest cabin of any heavy this side of a bizliner — a true flat floor and a conference group four can actually work at. The corporate-shuttle king.",
    knownFor: "Twelve-passenger working flights: boardroom layout, transatlantic range, sensible heavy-jet pricing.",
    cabin: { heightFt: "6'0\"", widthFt: "8'2\"", lengthFt: "28'4\"" },
    baggageCuFt: 115,
    ceilingFt: 41000,
    routes: [
      { from: "JFK", to: "LHR", label: "New York to London" },
      { from: "LAX", to: "MIA", label: "LA to Miami" },
      { from: "IAD", to: "GVA", label: "Washington to Geneva" },
    ],
  },
  {
    slug: "falcon-2000lxs",
    category: "heavy",
    name: "Dassault Falcon 2000LXS",
    manufacturer: "Dassault",
    shortName: "Falcon 2000LXS",
    sampleName: "Dassault Falcon 2000LXS",
    lead: "Fighter-house engineering in a bizjet: short-field performance no other heavy matches, so it takes ten passengers into airports the competition overflies.",
    knownFor: "Heavy-jet cabins into short strips — London City-style fields, island runways, mountain valleys.",
    cabin: { heightFt: "6'2\"", widthFt: "7'8\"", lengthFt: "26'3\"" },
    baggageCuFt: 131,
    ceilingFt: 47000,
    routes: [
      { from: "TEB", to: "LTN", label: "New York to London" },
      { from: "VNY", to: "TEB", label: "LA to New York" },
      { from: "JFK", to: "ASE", label: "New York to Aspen" },
    ],
  },
  // ── Ultra long range ──
  {
    slug: "gulfstream-g650er",
    category: "ultra",
    name: "Gulfstream G650ER",
    manufacturer: "Gulfstream",
    shortName: "Gulfstream G650ER",
    sampleName: "Gulfstream G650ER",
    lead: "The airplane that held the around-the-world record: 7,500 NM at Mach 0.85, up to nineteen aboard, and a cabin altitude low enough to beat the jet lag it outruns.",
    knownFor: "The missions that used to require a fuel stop and a hotel: LA to Tokyo, New York to the Gulf, nonstop.",
    cabin: { heightFt: "6'3\"", widthFt: "8'6\"", lengthFt: "46'10\"" },
    baggageCuFt: 195,
    ceilingFt: 51000,
    routes: [
      { from: "LAX", to: "HND", label: "LA to Tokyo" },
      { from: "JFK", to: "DXB", label: "New York to Dubai" },
      { from: "SFO", to: "SYD", label: "San Francisco to Sydney" },
    ],
  },
  {
    slug: "global-7500",
    category: "ultra",
    name: "Bombardier Global 7500",
    manufacturer: "Bombardier",
    shortName: "Global 7500",
    sampleName: "Bombardier Global 7500",
    lead: "Four true living zones — including a permanent bed and a shower option — across the longest cabin in purpose-built business aviation, with 7,700 NM of reach.",
    knownFor: "The overnight ultra-haul flown as a night's sleep: board at dinner, land at breakfast, meetings on arrival.",
    cabin: { heightFt: "6'2\"", widthFt: "8'0\"", lengthFt: "54'5\"" },
    baggageCuFt: 195,
    ceilingFt: 51000,
    routes: [
      { from: "LAX", to: "SYD", label: "LA to Sydney" },
      { from: "JFK", to: "HKG", label: "New York to Hong Kong" },
      { from: "LAX", to: "HND", label: "LA to Tokyo" },
    ],
  },
  {
    slug: "falcon-8x",
    category: "ultra",
    name: "Dassault Falcon 8X",
    manufacturer: "Dassault",
    shortName: "Falcon 8X",
    sampleName: "Dassault Falcon 8X",
    lead: "Three engines, 6,450 NM, and the Falcon party trick: ultra-long-range reach into short, steep, close-in airports the big twins can't legally touch.",
    knownFor: "Long-haul missions that end somewhere awkward — the 8X does the distance and the difficult runway.",
    cabin: { heightFt: "6'2\"", widthFt: "7'8\"", lengthFt: "42'8\"" },
    baggageCuFt: 140,
    ceilingFt: 51000,
    routes: [
      { from: "LAX", to: "LHR", label: "LA to London" },
      { from: "JFK", to: "DXB", label: "New York to Dubai" },
      { from: "TEB", to: "GVA", label: "New York to Geneva" },
    ],
  },
];

// Join each seed to its fleet sample (build-time integrity check: a seed
// naming a sample that doesn't exist throws at module init, which fails
// the build rather than shipping a page with missing data).
export const MODELS: AircraftModel[] = SEEDS.map((seed) => {
  const entry = FLEET.find((f) => f.slug === seed.category);
  const sample = entry?.samples.find((s) => s.name === seed.sampleName);
  if (!sample) throw new Error(`models.ts: no fleet sample named "${seed.sampleName}"`);
  const { sampleName: _drop, ...rest } = seed;
  return { ...rest, sample };
});

export function getModel(category: string, slug: string): AircraftModel | undefined {
  return MODELS.find((m) => m.category === category && m.slug === slug);
}

export function siblingModels(model: AircraftModel): AircraftModel[] {
  return MODELS.filter((m) => m.category === model.category && m.slug !== model.slug);
}
