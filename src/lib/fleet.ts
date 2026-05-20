// Static fleet catalog — six categories with full category-detail content.
// Moves to DB (aircraft_categories + sample_aircraft) in Phase B once
// supply schema lands.

export type AircraftCategorySlug =
  | "turboprop"
  | "light"
  | "midsize"
  | "supermid"
  | "heavy"
  | "ultra";

export type Spec = { label: string; value: string; sub: string };

export type SampleAircraft = {
  name: string;
  tail: string;
  base: string;
  phCap: string;
  pax: number;
  rangeNm: number;
  speedKt: number;
  year: number;
  wifi: "YES" | "KA" | "NONE";
};

export type BestForTile = {
  iconKey: "boltsmall" | "compass" | "users" | "calendar" | "globe" | "shield" | "moon" | "table";
  title: string;
  body: string;
};

export type TeaserCard = {
  label: "STEP DOWN" | "STEP UP" | "ACROSS";
  title: string;
  body: string;
  href: string;
  cta: string;
};

export type ReachPair = {
  pair: string;
  nm: string;
  time: string;
};

export type FleetEntry = {
  slug: AircraftCategorySlug;
  href: string;
  name: string;
  shortName: string;
  cap: string;
  blurb: string;
  pax: number;
  rangeNm: number;
  speedKt: number;
  enduranceHr: string;
  sampleAircraft: string[];

  // Category-detail content
  index: number; // 1-based position in the lineup
  total: number; // 6
  kicker: string;
  title: string; // page H1 (with trailing period)
  lead: string;
  heroImageCaption: string;
  heroSpecs: Spec[];

  cabin: {
    headline: [string, string]; // two-line h2
    placeholders: [string, string, string];
    caption: string;
  };

  reach?: {
    headline: [string, string];
    lead: string;
    pairs: ReachPair[];
  };

  samples: SampleAircraft[];
  bestFor: BestForTile[];

  teaser: {
    left: TeaserCard;
    right: TeaserCard;
  };

  finalCta: { heading: string; body: string };
};

const fmt = new Intl.NumberFormat("en-US");

const TOTAL_CATEGORIES = 6;

export const FLEET: FleetEntry[] = [
  {
    slug: "turboprop",
    href: "/aircraft/turboprop",
    name: "Turboprop",
    shortName: "Turboprop",
    cap: "— TURBOPROP, HANGAR",
    blurb:
      "Short hops, regional missions, unpaved strips. The workhorse — quiet, efficient, capable.",
    pax: 9,
    rangeNm: 1200,
    speedKt: 290,
    enduranceHr: "~4 HR",
    sampleAircraft: ["King Air 350", "Pilatus PC-12"],

    index: 1,
    total: TOTAL_CATEGORIES,
    kicker: "Turboprop · category 01 of 06",
    title: "Turboprops.",
    lead:
      "Short runways, mountain airports, unpaved strips — the airframes that fly where jets can't. Lower hourly than light jets, longer endurance for slow-cruise missions. The right answer when the destination is the problem, not the distance.",
    heroImageCaption: "— TURBOPROP, RAMP MIDDAY",
    heroSpecs: [
      { label: "PAX", value: "6–9", sub: "Typical config" },
      { label: "RANGE", value: "1,200 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "290 KT", sub: "Cruise" },
      { label: "ENDURANCE", value: "~4 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "30", sub: "FL300" },
      { label: "BAGGAGE", value: "50 CU FT", sub: "Externally loaded" },
    ],
    cabin: {
      headline: ["Quiet, capable,", "field-flexible."],
      placeholders: ["CABIN, FORWARD CLUB", "PILOT VIEW", "REAR BAGGAGE DOOR"],
      caption:
        "A typical turboprop cabin runs 16 to 18 feet of length, 4'9\" of cabin height, and seats six to nine in club plus aft seating. Refreshment galley, enclosed lavatory on most types, Wi-Fi available on newer airframes. Built for short runways the airline can't touch.",
    },
    samples: [
      {
        name: "Beechcraft King Air 350i",
        tail: "N9●●KA",
        base: "BASED KAPA",
        phCap: "KING AIR 350, EXTERIOR",
        pax: 9,
        rangeNm: 1806,
        speedKt: 312,
        year: 2019,
        wifi: "YES",
      },
      {
        name: "Pilatus PC-12 NGX",
        tail: "N9●●PC",
        base: "BASED KSDL",
        phCap: "PC-12, NIGHT TARMAC",
        pax: 8,
        rangeNm: 1803,
        speedKt: 290,
        year: 2022,
        wifi: "YES",
      },
      {
        name: "Daher TBM 960",
        tail: "N9●●TB",
        base: "BASED KOPF",
        phCap: "TBM 960, RUNWAY",
        pax: 6,
        rangeNm: 1730,
        speedKt: 330,
        year: 2023,
        wifi: "YES",
      },
    ],
    bestFor: [
      {
        iconKey: "compass",
        title: "Mountain airports",
        body: "Aspen, Telluride, Jackson Hole. Hot-and-high performance the jet category can't match.",
      },
      {
        iconKey: "boltsmall",
        title: "Short-runway access",
        body: "3,000-foot strips, gravel runways, island airfields. The longest list of usable airports in the lineup.",
      },
      {
        iconKey: "users",
        title: "Cost-conscious regional",
        body: "Lowest hourly in the network. The honest answer when speed isn't the priority.",
      },
      {
        iconKey: "shield",
        title: "Single-engine reliability",
        body: "Modern PT6 and PWC turbines, fully developed for thirty-plus years. The most-flown engine class in business aviation.",
      },
    ],
    teaser: {
      left: {
        label: "ACROSS",
        title: "All categories",
        body: "The full comparison — turboprop through ultra. Side-by-side specs, range, hourly, and what each does best.",
        href: "/aircraft",
        cta: "Compare all",
      },
      right: {
        label: "STEP UP",
        title: "Light jet",
        body: "Adds 460 NM of range and 120 knots of cruise speed. Same passenger count, jet-quiet cabin, paved runways only.",
        href: "/aircraft/light",
        cta: "Explore light",
      },
    },
    finalCta: {
      heading: "Turboprop, ready to go.",
      body: "Tell us the route. We'll surface the right airframe within minutes — all-in pricing, no surprises.",
    },
  },

  {
    slug: "light",
    href: "/aircraft/light",
    name: "Light",
    shortName: "Light jet",
    cap: "— LIGHT JET, DAWN TARMAC",
    blurb:
      "The quick-turn workhorse. East-coast hops, regional sectors, fast crew swaps.",
    pax: 7,
    rangeNm: 1660,
    speedKt: 410,
    enduranceHr: "~3.5 HR",
    sampleAircraft: ["Phenom 300", "Citation CJ3+"],

    index: 2,
    total: TOTAL_CATEGORIES,
    kicker: "Light · category 02 of 06",
    title: "Light jets.",
    lead:
      "The fastest way to skip the airline. Six to seven seats, three-hour legs, smaller airports the big iron can't touch. Lower hourly than midsize, quicker to dispatch, ideal for one-hop business trips and short-range family flights.",
    heroImageCaption: "— LIGHT, RAMP DAWN",
    heroSpecs: [
      { label: "PAX", value: "6–7", sub: "Typical config" },
      { label: "RANGE", value: "1,660 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "405 KT", sub: "Cruise" },
      { label: "ENDURANCE", value: "~3.5 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "45", sub: "FL450" },
      { label: "BAGGAGE", value: "55 CU FT", sub: "External + internal" },
    ],
    cabin: {
      headline: ["Compact, capable,", "quick to climb."],
      placeholders: ["CABIN, CLUB OF FOUR", "SEAT & TABLE", "FORWARD GALLEY"],
      caption:
        "A typical light cabin runs 13 to 16 feet of length, 4'9\" of cabin height, and seats six to seven in a four-seat club plus side-facing or aft seats. Refreshment galley with snacks & bar; enclosed lavatory on most airframes. Wi-Fi available on newer types.",
    },
    samples: [
      {
        name: "Embraer Phenom 300E",
        tail: "N9●●PH",
        base: "BASED KAPA",
        phCap: "PHENOM 300E, RAMP",
        pax: 7,
        rangeNm: 2010,
        speedKt: 464,
        year: 2021,
        wifi: "YES",
      },
      {
        name: "Cessna Citation CJ4",
        tail: "N9●●CJ",
        base: "BASED KSDL",
        phCap: "CJ4, EXTERIOR",
        pax: 7,
        rangeNm: 2165,
        speedKt: 451,
        year: 2020,
        wifi: "YES",
      },
      {
        name: "Learjet 75 Liberty",
        tail: "N9●●LJ",
        base: "BASED KDAL",
        phCap: "LEAR 75, NIGHT",
        pax: 6,
        rangeNm: 2040,
        speedKt: 464,
        year: 2018,
        wifi: "YES",
      },
    ],
    bestFor: [
      {
        iconKey: "boltsmall",
        title: "Same-day, two-leg",
        body: "Out-and-back business trips inside three-hour radius. Wheels up two hours after a call.",
      },
      {
        iconKey: "compass",
        title: "Small-airport access",
        body: "5,000-foot runways the airline can't touch — Aspen, Sun Valley, Catalina, Friday Harbor.",
      },
      {
        iconKey: "users",
        title: "Solo or small group",
        body: "Two to four passengers without paying for an empty cabin. The right tool for the job.",
      },
      {
        iconKey: "table",
        title: "Cost-conscious charter",
        body: "Lowest hourly rate in our network. The honest entry point into private flight.",
      },
    ],
    teaser: {
      left: {
        label: "STEP DOWN",
        title: "Turboprop",
        body: "Even shorter runways, even lower hourly. Trades jet speed for true rural-airport access and a real cabin in tight spaces.",
        href: "/aircraft/turboprop",
        cta: "Explore turboprop",
      },
      right: {
        label: "STEP UP",
        title: "Midsize",
        body: "Adds 700 NM of range, two extra seats, and a stand-up cabin. The everyday workhorse for coast-to-coast.",
        href: "/aircraft/midsize",
        cta: "Explore midsize",
      },
    },
    finalCta: {
      heading: "Light jet, ready to go.",
      body: "Tell us the route. We'll surface three to five light airframes within minutes — all-in pricing, no surprises.",
    },
  },

  {
    slug: "midsize",
    href: "/aircraft/midsize",
    name: "Midsize",
    shortName: "Midsize",
    cap: "— MIDSIZE, OVERWING",
    blurb:
      "Stand-up cabin, coast-to-coast US, transcontinental Europe. The everyday choice.",
    pax: 9,
    rangeNm: 2400,
    speedKt: 430,
    enduranceHr: "~5 HR",
    sampleAircraft: ["Citation XLS+", "Hawker 900XP"],

    index: 3,
    total: TOTAL_CATEGORIES,
    kicker: "Midsize · category 03 of 06",
    title: "Midsize jets.",
    lead:
      "The everyday choice. Stand-up cabin, real galley, a flight attendant when you want one. Coast-to-coast across the US, transcontinental Europe, transatlantic with a single fuel stop. The category most missions land on — for good reason.",
    heroImageCaption: "— MIDSIZE, OVERWING DUSK",
    heroSpecs: [
      { label: "PAX", value: "8–9", sub: "Typical config" },
      { label: "RANGE", value: "2,400 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "430 KT", sub: "Cruise" },
      { label: "ENDURANCE", value: "~5 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "45", sub: "FL450" },
      { label: "BAGGAGE", value: "90 CU FT", sub: "Internal + external" },
    ],
    cabin: {
      headline: ["Stand up. Stretch out.", "Get to work."],
      placeholders: ["CABIN, 4 SEATS CLUB", "SEAT DETAIL", "GALLEY"],
      caption:
        "A typical midsize cabin runs 18 to 22 feet of length, six feet of stand-up height, and seats eight to nine in a four-seat club plus three- or four-place divan. Full galley with hot & cold options. Enclosed lavatory. Wi-Fi standard on most airframes in the network.",
    },
    samples: [
      {
        name: "Cessna Citation XLS+",
        tail: "N9●●XL",
        base: "BASED KVNY",
        phCap: "XLS+, EXTERIOR",
        pax: 9,
        rangeNm: 2100,
        speedKt: 441,
        year: 2019,
        wifi: "YES",
      },
      {
        name: "Hawker 900XP",
        tail: "N9●●HK",
        base: "BASED KTEB",
        phCap: "HAWKER 900XP, RAMP",
        pax: 8,
        rangeNm: 2930,
        speedKt: 448,
        year: 2017,
        wifi: "YES",
      },
      {
        name: "Learjet 60XR",
        tail: "N9●●LJ",
        base: "BASED KMIA",
        phCap: "LEAR 60XR, NIGHT",
        pax: 7,
        rangeNm: 2405,
        speedKt: 464,
        year: 2015,
        wifi: "YES",
      },
    ],
    bestFor: [
      {
        iconKey: "globe",
        title: "Coast-to-coast US",
        body: "LAX to JFK in a single sector with reserves. New York to LA into the wind, plan a tech stop.",
      },
      {
        iconKey: "compass",
        title: "Transatlantic, one stop",
        body: "Eastbound non-stop from Bangor or Halifax. Westbound add a Keflavík or Gander stop.",
      },
      {
        iconKey: "users",
        title: "Group of 6–9",
        body: "Full-size cabin without the heavy-jet hourly. The sweet spot for executive and family groups.",
      },
      {
        iconKey: "calendar",
        title: "Multi-day mission",
        body: "Crew rest within day, real lavatory, full galley. Built for back-to-back sectors over a week.",
      },
    ],
    teaser: {
      left: {
        label: "STEP DOWN",
        title: "Light jet",
        body: "Quicker turn, lower hourly. Trades the stand-up cabin for a 7-seat layout and 1,660 NM range.",
        href: "/aircraft/light",
        cta: "Explore light",
      },
      right: {
        label: "STEP UP",
        title: "Super-midsize",
        body: "Adds 1,100 NM of range and a flat-floor cabin. Transatlantic non-stop on most sectors.",
        href: "/aircraft/supermid",
        cta: "Explore super-mid",
      },
    },
    finalCta: {
      heading: "Midsize, ready to go.",
      body: "Tell us the route. We'll surface three to five midsize airframes within minutes — all-in pricing, no surprises.",
    },
  },

  {
    slug: "supermid",
    href: "/aircraft/supermid",
    name: "Super-mid",
    shortName: "Super-mid",
    cap: "— SUPER-MID, CABIN DETAIL",
    blurb:
      "True transcontinental range with a flat-floor cabin. Transatlantic with a single fuel stop.",
    pax: 9,
    rangeNm: 3500,
    speedKt: 490,
    enduranceHr: "~7 HR",
    sampleAircraft: ["Challenger 350", "Citation Longitude"],

    index: 4,
    total: TOTAL_CATEGORIES,
    kicker: "Super-mid · category 04 of 06",
    title: "Super-midsize.",
    lead:
      "Faster, longer, and a flat-floor cabin. Transatlantic non-stop on most sectors. The category that disappears the difference between coast-to-coast and Europe — and feels heavy-jet inside without the heavy-jet hourly.",
    heroImageCaption: "— SUPER-MID, IN CRUISE",
    heroSpecs: [
      { label: "PAX", value: "8–10", sub: "Typical config" },
      { label: "RANGE", value: "3,500 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "488 KT", sub: "Cruise" },
      { label: "ENDURANCE", value: "~7 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "45", sub: "FL450" },
      { label: "BAGGAGE", value: "110 CU FT", sub: "Internal + external" },
    ],
    cabin: {
      headline: ["Flat floor.", "Fast cruise."],
      placeholders: ["DOUBLE CLUB CABIN", "SEAT & BERTHING", "FULL GALLEY"],
      caption:
        "A typical super-midsize cabin runs 25 to 28 feet, six feet of stand-up height, and a flat floor — no center step. Double-club seating with eight to ten passengers, full hot-meal galley, enclosed lavatory, divan that converts to a berth. Wi-Fi standard, Ka-band on newer airframes.",
    },
    samples: [
      {
        name: "Bombardier Challenger 350",
        tail: "N9●●CL",
        base: "BASED KTEB",
        phCap: "CHALLENGER 350, RAMP",
        pax: 10,
        rangeNm: 3200,
        speedKt: 488,
        year: 2020,
        wifi: "KA",
      },
      {
        name: "Cessna Citation Longitude",
        tail: "N9●●LO",
        base: "BASED KSAN",
        phCap: "LONGITUDE, EXTERIOR",
        pax: 9,
        rangeNm: 3500,
        speedKt: 483,
        year: 2022,
        wifi: "YES",
      },
      {
        name: "Embraer Praetor 600",
        tail: "N9●●PR",
        base: "BASED KOPF",
        phCap: "PRAETOR 600, NIGHT",
        pax: 8,
        rangeNm: 4018,
        speedKt: 466,
        year: 2021,
        wifi: "KA",
      },
    ],
    bestFor: [
      {
        iconKey: "globe",
        title: "Transatlantic non-stop",
        body: "NYC to London or Paris with reserves. East-coast to most of Europe in a single sector.",
      },
      {
        iconKey: "compass",
        title: "Coast-to-coast into wind",
        body: "LA to NYC westbound, into 100-knot headwinds, non-stop. Where midsize would tech-stop.",
      },
      {
        iconKey: "users",
        title: "Group of 8–10",
        body: "Full conference around the table. Two work groups facing each other. Real meeting space at altitude.",
      },
      {
        iconKey: "table",
        title: "The right-sized upgrade",
        body: "The honest answer when midsize is a stretch but heavy-jet is overkill. Most cross-continent missions land here.",
      },
    ],
    teaser: {
      left: {
        label: "STEP DOWN",
        title: "Midsize",
        body: "Lower hourly, similar passenger count. Trades 1,100 NM of range and the flat floor for a smaller airframe footprint.",
        href: "/aircraft/midsize",
        cta: "Explore midsize",
      },
      right: {
        label: "STEP UP",
        title: "Heavy",
        body: "Adds 2,500 NM, a forward-and-aft cabin, and stand-up galley. The category for full-night transoceanic.",
        href: "/aircraft/heavy",
        cta: "Explore heavy",
      },
    },
    finalCta: {
      heading: "Super-mid, ready to go.",
      body: "Tell us the route. We'll surface three to five super-midsize airframes within minutes — all-in pricing, no surprises.",
    },
  },

  {
    slug: "heavy",
    href: "/aircraft/heavy",
    name: "Heavy",
    shortName: "Heavy",
    cap: "— HEAVY, EXTERIOR",
    blurb:
      "Two cabin zones, full galley, crew rest. New York to London, non-stop, comfortable.",
    pax: 14,
    rangeNm: 4500,
    speedKt: 490,
    enduranceHr: "~9 HR",
    sampleAircraft: ["Falcon 2000", "Gulfstream G450"],

    index: 5,
    total: TOTAL_CATEGORIES,
    kicker: "Heavy · category 05 of 06",
    title: "Heavy jets.",
    lead:
      "Two cabins, a galley a chef can work in, beds that are actually beds. Twelve to fourteen passengers transoceanic with crew rest. The category for full-night sectors and groups that need to arrive ready, not recovering.",
    heroImageCaption: "— HEAVY, NIGHT TURN",
    heroSpecs: [
      { label: "PAX", value: "12–14", sub: "Typical config" },
      { label: "RANGE", value: "6,000 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "488 KT", sub: "Cruise" },
      { label: "ENDURANCE", value: "~13 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "51", sub: "FL510" },
      { label: "BAGGAGE", value: "195 CU FT", sub: "Internal + external" },
    ],
    cabin: {
      headline: ["Two cabins.", "Real beds."],
      placeholders: ["FORWARD CLUB, AFT BERTH", "DINING SETTING", "STATEROOM"],
      caption:
        "A typical heavy cabin runs 35 to 42 feet, six-and-a-half feet of stand-up height, and divides into two or three zones — forward club, mid dining, aft berth or stateroom. Stand-up galley with full crew, dual lavatories, vanity room, full Wi-Fi with Ka-band streaming. Most types carry a flight attendant standard.",
    },
    samples: [
      {
        name: "Gulfstream G450",
        tail: "N9●●GS",
        base: "BASED KIAD",
        phCap: "G450, RAMP",
        pax: 14,
        rangeNm: 4350,
        speedKt: 476,
        year: 2017,
        wifi: "KA",
      },
      {
        name: "Bombardier Challenger 605",
        tail: "N9●●CH",
        base: "BASED KFLL",
        phCap: "CL605, EXTERIOR",
        pax: 12,
        rangeNm: 4000,
        speedKt: 459,
        year: 2018,
        wifi: "KA",
      },
      {
        name: "Dassault Falcon 2000LXS",
        tail: "N9●●FL",
        base: "BASED KSFO",
        phCap: "FALCON 2000, NIGHT",
        pax: 10,
        rangeNm: 4000,
        speedKt: 482,
        year: 2019,
        wifi: "KA",
      },
    ],
    bestFor: [
      {
        iconKey: "globe",
        title: "Transcontinental Asia",
        body: "NYC to Tokyo or Shanghai non-stop. East-coast US to Dubai or Mumbai with reserves.",
      },
      {
        iconKey: "moon",
        title: "Full crew rest sectors",
        body: "Augmented crew, real beds, divided cabin. The plane that lets the dispatcher fly the longest legs legally.",
      },
      {
        iconKey: "users",
        title: "Family or board, larger group",
        body: "Twelve to fourteen passengers with luggage for a week. Two zones for sleep and work in parallel.",
      },
      {
        iconKey: "calendar",
        title: "Multi-country tour",
        body: "Five cities, six days, every leg flown ready. The category most multi-stop European or Asian tours need.",
      },
    ],
    teaser: {
      left: {
        label: "STEP DOWN",
        title: "Super-midsize",
        body: "Lower hourly, similar transatlantic range. Trades a second cabin and stand-up galley for the smaller airframe.",
        href: "/aircraft/supermid",
        cta: "Explore super-mid",
      },
      right: {
        label: "STEP UP",
        title: "Ultra long range",
        body: "Adds 1,500 NM and a third zone. Non-stop city-pairs that no other category can fly without a stop.",
        href: "/aircraft/ultra",
        cta: "Explore ultra",
      },
    },
    finalCta: {
      heading: "Heavy, ready to go.",
      body: "Tell us the route. We'll surface three to five heavy airframes within minutes — all-in pricing, no surprises.",
    },
  },

  {
    slug: "ultra",
    href: "/aircraft/ultra",
    name: "Ultra long range",
    shortName: "ULR",
    cap: "— ULR, NIGHT TARMAC",
    blurb:
      "Transpacific in a single sector. LA to Tokyo, NY to Singapore. The longest legs the industry flies.",
    pax: 16,
    rangeNm: 7500,
    speedKt: 516,
    enduranceHr: "~14 HR",
    sampleAircraft: ["Gulfstream G650", "Global 7500"],

    index: 6,
    total: TOTAL_CATEGORIES,
    kicker: "Ultra · category 06 of 06",
    title: "Ultra long range.",
    lead:
      "The longest reach in civil aviation. Sixteen-passenger cabin, three zones, Mach 0.90 cruise. Non-stop city pairs no other category can fly without a stop. The category for when \"non-stop\" is the brief.",
    heroImageCaption: "— ULTRA, OCEAN CRUISE",
    heroSpecs: [
      { label: "PAX", value: "14–19", sub: "Typical config" },
      { label: "RANGE", value: "7,500 NM", sub: "Max with reserves" },
      { label: "SPEED", value: "516 KT", sub: "Cruise (M0.90)" },
      { label: "ENDURANCE", value: "~16 HR", sub: "Single sector" },
      { label: "CRUISE ALT", value: "51", sub: "FL510" },
      { label: "BAGGAGE", value: "220 CU FT", sub: "Internal + external" },
    ],
    cabin: {
      headline: ["Three zones.", "Sixteen hours."],
      placeholders: ["THREE-ZONE LAYOUT", "CONFERENCE / DINING", "STATEROOM & SHOWER"],
      caption:
        "A typical ultra cabin runs 45 to 54 feet, six-and-a-half feet of stand-up height, divided into three zones — forward club, mid conference / dining for six, aft stateroom with a real bed. Crew rest separate from passenger zones. Ka-band Wi-Fi with high-speed streaming. Most types fly with two-pilot augmented crew and a dedicated flight attendant.",
    },
    reach: {
      headline: ["City pairs ultra", "flies non-stop."],
      lead:
        'Sectors that any other category would tech-stop. With ultra, the briefing is "wheels up, wheels down." Times below assume zero wind, payload of 8 PAX.',
      pairs: [
        { pair: "NEW YORK · TOKYO", nm: "5,860 NM", time: "~13H 50M" },
        { pair: "LONDON · SINGAPORE", nm: "5,870 NM", time: "~13H 55M" },
        { pair: "LOS ANGELES · SYDNEY", nm: "6,510 NM", time: "~15H 25M" },
        { pair: "DUBAI · NEW YORK", nm: "6,025 NM", time: "~14H 15M" },
        { pair: "HONG KONG · LONDON", nm: "5,260 NM", time: "~12H 30M" },
      ],
    },
    samples: [
      {
        name: "Gulfstream G650ER",
        tail: "N9●●GE",
        base: "BASED KTEB",
        phCap: "G650ER, RAMP",
        pax: 19,
        rangeNm: 7500,
        speedKt: 516,
        year: 2020,
        wifi: "KA",
      },
      {
        name: "Bombardier Global 7500",
        tail: "N9●●GL",
        base: "BASED KIAD",
        phCap: "GLOBAL 7500, NIGHT",
        pax: 17,
        rangeNm: 7700,
        speedKt: 516,
        year: 2022,
        wifi: "KA",
      },
      {
        name: "Dassault Falcon 8X",
        tail: "N9●●F8",
        base: "BASED LFPB",
        phCap: "FALCON 8X, EXTERIOR",
        pax: 14,
        rangeNm: 6450,
        speedKt: 488,
        year: 2021,
        wifi: "KA",
      },
    ],
    bestFor: [
      {
        iconKey: "globe",
        title: "Around the world",
        body: "Three-stop circumnavigation in a week. Two-stop with reserves on the long fingers.",
      },
      {
        iconKey: "compass",
        title: "Ultra-long single sector",
        body: "NYC–Tokyo, LA–Sydney, Dubai–LA. The handful of city pairs only ultra can fly non-stop.",
      },
      {
        iconKey: "shield",
        title: "Diplomatic / state work",
        body: "Conference table for six, secure comms, three-zone privacy, full crew rest. The category for high-stakes missions.",
      },
      {
        iconKey: "calendar",
        title: "Multi-week extended trip",
        body: "Twenty days, ten cities, stateroom and shower onboard. Move like a residence, not a passenger.",
      },
    ],
    teaser: {
      left: {
        label: "STEP DOWN",
        title: "Heavy",
        body: "Lower hourly, similar two-cabin layout. Trades 1,500 NM and the third zone — fine for most transoceanic missions.",
        href: "/aircraft/heavy",
        cta: "Explore heavy",
      },
      right: {
        label: "ACROSS",
        title: "All categories",
        body: "The full comparison — turboprop through ultra. Side-by-side specs, range, hourly, and what each does best.",
        href: "/aircraft",
        cta: "Compare all",
      },
    },
    finalCta: {
      heading: "Ultra, ready to go.",
      body: "Tell us the route. We'll surface three to five ultra airframes within minutes — all-in pricing, no surprises.",
    },
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

export function getFleetEntry(slug: string): FleetEntry | undefined {
  return FLEET.find((f) => f.slug === slug);
}
