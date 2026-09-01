// City-page registry — one entry per charter market
// (/private-jet-charter/{slug}). Scoped per the four-broker audit: the
// deep top ~15-20 markets earn the traffic, the long tail earns rot —
// so this list grows only after these index and rank.
//
// Curated facts here follow the same discipline as the rest of the
// site: drive times are approximate ("~") framings of well-known
// geography, operational notes stick to widely documented airport
// realities (curfews, slots, elevation), and every dollar figure on the
// rendered page comes from the quote engine, never this file.
import { findAirport, type Airport } from "@/lib/airports";

export type CityAirport = {
  airport: Airport;
  /** e.g. "Primary charter field" / "Commercial alternative". */
  role: string;
  /** Approximate access framing, e.g. "~20 min to Beverly Hills". */
  drive: string;
};

export type CharterCity = {
  slug: string;
  name: string;
  state: string;
  /** Dispatcher's note — 2-3 sentences of market-specific truth. */
  lead: string;
  airports: CityAirport[];
  /** Primary departure field for pricing examples. */
  primary: Airport;
  /** Popular destinations from this market (codes resolved at init). */
  lanes: Airport[];
  /** Curated operational Q&As appended to the computed FAQ. */
  opsFaq: { q: string; a: string }[];
};

type Seed = {
  slug: string;
  name: string;
  state: string;
  lead: string;
  airports: { code: string; role: string; drive: string }[];
  lanes: string[];
  opsFaq: { q: string; a: string }[];
};

const SEEDS: Seed[] = [
  {
    slug: "los-angeles",
    name: "Los Angeles",
    state: "California",
    lead: "Our home market. Van Nuys is the busiest dedicated business-aviation airport in the country, and it's where our chief pilot vets operators in person — LA missions fly with home-field knowledge of every ramp, curfew, and canyon wind in the basin.",
    airports: [
      { code: "VNY", role: "Primary charter field", drive: "~20 min to Beverly Hills · ~30 min to downtown" },
      { code: "BUR", role: "Valley & studios alternative", drive: "~10 min to Burbank studios · ~25 min to downtown" },
      { code: "LAX", role: "International connections", drive: "West side · use for airline-connect itineraries" },
    ],
    lanes: ["LAS", "ASE", "SFO", "TEB", "SJD"],
    opsFaq: [
      {
        q: "Does Van Nuys have a curfew?",
        a: "VNY runs a nighttime departure curfew program for louder stages of aircraft — modern charter jets are largely unaffected, but late-night departures are planned around it. Dispatch confirms the window with your quote; Burbank picks up the rare edge case.",
      },
      {
        q: "Which LA airport should my charter use?",
        a: "Van Nuys for most missions — it's built for private aviation, with the fastest curb-to-cabin in the basin. Burbank wins for the eastern Valley and studio traffic. LAX only makes sense when you're connecting to or from an airline flight.",
      },
    ],
  },
  {
    slug: "new-york",
    name: "New York",
    state: "New York",
    lead: "The densest business-aviation market on earth, and the one where airport choice matters most. Teterboro is the default for Manhattan; slots and ramp space tighten hard around holidays and summer Fridays, which is where a desk that books the lane weekly earns its keep.",
    airports: [
      { code: "TEB", role: "Primary charter field", drive: "~12 mi to Midtown Manhattan" },
      { code: "JFK", role: "International & heavy-jet ops", drive: "Queens · ~50 min to Midtown" },
      { code: "LGA", role: "East-side alternative", drive: "~8 mi to Midtown · slot-constrained" },
    ],
    lanes: ["OPF", "PBI", "ASE", "LTN", "MVY"],
    opsFaq: [
      {
        q: "Why Teterboro instead of JFK or LaGuardia?",
        a: "Teterboro exists for exactly this: no airline banks, dedicated FBO ramps, and the shortest reliable drive to Midtown. JFK earns its place on international missions and the largest cabins; LaGuardia's slots make it the situational pick, not the default.",
      },
      {
        q: "How early should I book a holiday-week departure?",
        a: "Thanksgiving, Christmas week, and summer Fridays are the tightest ramp windows in the country at Teterboro. A week ahead keeps full choice of airframe; dispatch will tell you straight when a date calls for more.",
      },
    ],
  },
  {
    slug: "miami",
    name: "Miami",
    state: "Florida",
    lead: "Winter capital of American private aviation. Opa-Locka handles the executive traffic MIA can't move quickly, the season peaks from Thanksgiving through spring, and the northbound empty-leg supply on Sunday evenings is some of the best discount inventory on our board.",
    airports: [
      { code: "OPF", role: "Primary charter field", drive: "~16 mi to Brickell · ~20 min to Miami Beach" },
      { code: "MIA", role: "International & airline connect", drive: "~8 mi to Brickell · heavier ramp traffic" },
    ],
    lanes: ["TEB", "NAS", "JAX", "BOS"],
    opsFaq: [
      {
        q: "Opa-Locka or MIA for a Miami charter?",
        a: "Opa-Locka for nearly everything — it's the executive field, with FBO ramps built for quick turns. MIA earns its place on international itineraries that need customs infrastructure or an airline connection on one end.",
      },
      {
        q: "When is Miami's charter season busiest?",
        a: "Thanksgiving through Easter, with hard peaks around Art Basel week, New Year's, and Presidents' Day. Airframes sell out days ahead in those windows; the rest of the year the market runs loose and southbound empty legs get cheap.",
      },
    ],
  },
  {
    slug: "las-vegas",
    name: "Las Vegas",
    state: "Nevada",
    lead: "The highest-frequency leisure lane network in the West terminates here. Harry Reid's dedicated FBO ramps sit minutes from the Strip, Henderson Executive skips the commercial field entirely, and fight nights or big conventions can sell out the local fleet — book the event, not the week.",
    airports: [
      { code: "LAS", role: "Primary · closest to the Strip", drive: "~10 min to the Strip" },
      { code: "HND", role: "Executive alternative", drive: "~20 min to the Strip · quieter ramp" },
    ],
    lanes: ["VNY", "SFO", "DAL", "MDW"],
    opsFaq: [
      {
        q: "How fast is wheels-to-table in Vegas?",
        a: "From touchdown at Harry Reid to a Strip property is routinely under twenty minutes with the car on the ramp. Henderson Executive trades ten extra minutes of drive for a quieter ramp and faster taxi out on departure.",
      },
      {
        q: "What happens to prices on fight or convention weekends?",
        a: "The rate card holds — charter isn't yield-managed — but the local fleet sells through, so late bookers get repositioned aircraft and the ferry cost that comes with them. Book marquee weekends the day plans firm up.",
      },
    ],
  },
  {
    slug: "san-francisco",
    name: "San Francisco",
    state: "California",
    lead: "Tech's shuttle market: high-frequency hops to LA and Vegas, transcons to New York, and a fog line that makes airport choice a real decision. Oakland's field regularly stays open when SFO's marine layer slows arrivals — a swap that saves mornings, not minutes.",
    airports: [
      { code: "SFO", role: "Primary · south bay access", drive: "~14 mi to downtown SF" },
      { code: "OAK", role: "Fog-season alternative", drive: "~19 mi to downtown SF · east bay direct" },
    ],
    lanes: ["VNY", "LAS", "SEA", "TEB"],
    opsFaq: [
      {
        q: "Does San Francisco fog affect private flights?",
        a: "Less than commercial — charter can swap fields. When the marine layer slows SFO arrivals, Oakland or a peninsula alternative usually keeps the schedule; dispatch watches the pattern and proposes the swap before it costs you the morning.",
      },
    ],
  },
  {
    slug: "dallas",
    name: "Dallas",
    state: "Texas",
    lead: "Love Field is the business airport Dallas actually uses — minutes from downtown and Preston Hollow, with the deepest midsize availability in the region. Texas legs run long: Dallas to either coast is where the midsize-versus-super-mid decision earns real money.",
    airports: [
      { code: "DAL", role: "Primary charter field", drive: "~6 mi to downtown Dallas" },
      { code: "DFW", role: "International & airline connect", drive: "~18 mi to downtown · use for connections" },
    ],
    lanes: ["LAS", "VNY", "TEB", "MIA"],
    opsFaq: [
      {
        q: "Love Field or DFW for a charter?",
        a: "Love Field, almost always — it's closer to everything that matters and built for quick FBO turns. DFW earns its place when you're meeting an international airline connection or positioning a very large cabin.",
      },
    ],
  },
  {
    slug: "seattle",
    name: "Seattle",
    state: "Washington",
    lead: "Boeing Field is the charter answer in a market where Sea-Tac's airline banks slow everything else down — ten minutes from downtown, purpose-built ramps, and a straight shot up the coast from California. Winter weather planning is real here; mountain alternates are part of every quote.",
    airports: [
      { code: "BFI", role: "Primary charter field", drive: "~5 mi to downtown Seattle" },
      { code: "SEA", role: "Airline connect alternative", drive: "~14 mi to downtown · commercial banks" },
    ],
    lanes: ["SFO", "VNY", "LAS", "DAL"],
    opsFaq: [
      {
        q: "Boeing Field or Sea-Tac?",
        a: "Boeing Field — it's the region's business-aviation home, closer to downtown with none of Sea-Tac's sequencing. Sea-Tac only makes sense when one end of the trip is an airline connection.",
      },
    ],
  },
  {
    slug: "san-diego",
    name: "San Diego",
    state: "California",
    lead: "A market the airlines serve through one crowded runway — which is exactly why charter works so well here. San Diego International handles the downtown missions; Carlsbad's McClellan-Palomar puts North County, Rancho Santa Fe, and Torrey Pines fifteen minutes from wheels-down.",
    airports: [
      { code: "SAN", role: "Primary · downtown & Coronado", drive: "~3 mi to downtown San Diego" },
      { code: "CRQ", role: "North County executive field", drive: "~35 min to downtown · minutes to Carlsbad & RSF" },
    ],
    lanes: ["LAS", "SFO", "SDL", "DAL"],
    opsFaq: [
      {
        q: "Which San Diego airport should my charter use?",
        a: "San Diego International for downtown, Coronado, and the harbor; McClellan-Palomar for anything North County — Carlsbad, Rancho Santa Fe, the golf corridor. The drive difference is 40 minutes each way; tell dispatch the actual address and the field picks itself.",
      },
    ],
  },
  {
    slug: "atlanta",
    name: "Atlanta",
    state: "Georgia",
    lead: "The world's busiest airline hub is precisely why Atlanta charters don't use it. DeKalb-Peachtree sits inside the Perimeter with Buckhead fifteen minutes away, and the Southeast's corporate traffic runs through it daily — deep airframe availability without Hartsfield's sequencing.",
    airports: [
      { code: "PDK", role: "Primary charter field", drive: "~15 min to Buckhead · inside the Perimeter" },
      { code: "FTY", role: "West-side alternative", drive: "~10 mi to downtown · film & industry traffic" },
    ],
    lanes: ["TEB", "MIA", "DAL", "MDW"],
    opsFaq: [
      {
        q: "Why not fly private from Hartsfield-Jackson?",
        a: "Because you'd inherit the world's busiest sequencing for no benefit. DeKalb-Peachtree is the executive field — inside the Perimeter, FBO ramps, quick turns. Hartsfield only enters the plan when an airline connection forces it.",
      },
    ],
  },
  {
    slug: "chicago",
    name: "Chicago",
    state: "Illinois",
    lead: "Midway is Chicago's private front door: closer in than O'Hare, faster off the ramp, and the natural start for the two-hour business shuttle east or the three-and-a-half-hour run to Vegas. Lake-effect winters make crew and alternate planning part of every cold-season quote.",
    airports: [
      { code: "MDW", role: "Primary charter field", drive: "~10 mi to the Loop" },
    ],
    lanes: ["TEB", "LAS", "DAL", "MIA"],
    opsFaq: [
      {
        q: "Midway or O'Hare for a charter?",
        a: "Midway — closer to the Loop and built for quick executive turns. O'Hare's scale only helps when an airline connection or a very large airframe demands it.",
      },
    ],
  },
  {
    slug: "boston",
    name: "Boston",
    state: "Massachusetts",
    lead: "Hanscom Field carries the region's executive traffic away from Logan's banks, and the seasonal patterns are strong: the Cape-and-Islands shuttle in summer, Florida from the first cold week to Easter. Short strips at the island ends make the turboprop the honest tool half the year.",
    airports: [
      { code: "BED", role: "Primary executive field", drive: "~14 mi to Back Bay" },
      { code: "BOS", role: "Downtown & international", drive: "~3 mi to downtown · airline sequencing" },
    ],
    lanes: ["MIA", "PBI", "MVY", "TEB"],
    opsFaq: [
      {
        q: "Hanscom or Logan for a Boston charter?",
        a: "Hanscom for the western suburbs and predictable turns; Logan when the trip starts downtown or connects internationally — the harbor-side drive is short but the sequencing isn't yours to control.",
      },
    ],
  },
  {
    slug: "washington-dc",
    name: "Washington",
    state: "District of Columbia",
    lead: "The most procedure-heavy airspace in the country, and a market where the desk's paperwork is the product. Dulles carries the international and heavy traffic; Reagan National's security rules make it the exception, not the default — your quote comes with the airspace plan built in.",
    airports: [
      { code: "IAD", role: "Primary · international & heavy", drive: "~26 mi to downtown DC" },
      { code: "DCA", role: "Close-in · restricted access", drive: "~4 mi to the Capitol · gateway rules apply" },
    ],
    lanes: ["TEB", "MIA", "PDK", "MDW"],
    opsFaq: [
      {
        q: "Can charters fly into Reagan National?",
        a: "Yes, under the DCA Access Standard Security Program — gateway screening, a security officer aboard, and advance vetting. It's routine for operators who run it, but it adds lead time; Dulles skips all of it at the cost of the drive. Dispatch prices both paths.",
      },
    ],
  },
  {
    slug: "aspen",
    name: "Aspen",
    state: "Colorado",
    lead: "The marquee mountain field: one runway at 7,800 feet elevation, a one-way box approach, a night curfew, and winter Saturdays that book out the ramp. This is the airport the vetting floor exists for — mountain-current crews and airframes with hot-and-high margin, or we don't quote it.",
    airports: [
      { code: "ASE", role: "The only field that counts", drive: "~5 min to downtown Aspen" },
    ],
    lanes: ["VNY", "TEB", "DAL", "SDL"],
    opsFaq: [
      {
        q: "Why do Aspen flights have special requirements?",
        a: "Elevation, terrain, and a curfew. The field sits at 7,800 feet in a box canyon with a night restriction — performance margins shrink and the approach demands current mountain experience. Our trip-level review runs those checks on every Aspen booking, every time.",
      },
      {
        q: "What if weather closes Aspen?",
        a: "The standard alternates are Rifle and Eagle, both under an hour's drive with ground pre-arranged. Dispatch briefs the divert plan with the quote in winter — it's part of the mission, not a surprise.",
      },
    ],
  },
  {
    slug: "palm-beach",
    name: "Palm Beach",
    state: "Florida",
    lead: "The season's other pole: PBI's FBO ramps sit ten minutes from the island, the Teterboro shuttle runs all winter, and ramp space around the holidays goes to whoever booked first. Light jets do the New York run nonstop; midsize buys the full-cabin margin.",
    airports: [
      { code: "PBI", role: "Primary charter field", drive: "~4 mi to the island" },
    ],
    lanes: ["TEB", "BED", "MDW"],
    opsFaq: [
      {
        q: "When does Palm Beach ramp space get tight?",
        a: "Thanksgiving, Christmas through New Year's, and Presidents' week — the island's whole season compresses into those ramps. Booking the airframe early also books its parking; late bookings sometimes overnight the aircraft elsewhere, which shows up as repositioning.",
      },
    ],
  },
  {
    slug: "scottsdale",
    name: "Scottsdale",
    state: "Arizona",
    lead: "Golf-country's executive field, minutes from the courses and resorts, with a season that peaks from January through the Open and spring training. Summer flips the physics: triple-digit heat trims runway performance, so hot missions plan early-morning wheels-up.",
    airports: [
      { code: "SDL", role: "Primary charter field", drive: "~15 min to the resort corridor" },
    ],
    lanes: ["VNY", "LAS", "DAL", "SAN"],
    opsFaq: [
      {
        q: "Does summer heat affect Scottsdale departures?",
        a: "Yes — high density altitude on triple-digit afternoons trims climb performance, so summer missions favor morning departures or a fuel-and-load plan sized for the heat. Dispatch builds it into the quote rather than surprising you at the ramp.",
      },
    ],
  },
  {
    slug: "houston",
    name: "Houston",
    state: "Texas",
    lead: "Hobby is the close-in field the energy corridor actually uses — a fraction of Intercontinental's taxi time, minutes more drive. The mission profile skews long: both coasts, Mexico, and the mountain resorts, which keeps super-mid availability unusually deep for a non-coastal market.",
    airports: [
      { code: "HOU", role: "Primary charter field", drive: "~11 mi to downtown Houston" },
    ],
    lanes: ["DAL", "MIA", "TEB", "ASE"],
    opsFaq: [
      {
        q: "Hobby or Intercontinental for a Houston charter?",
        a: "Hobby for nearly everything — closer to downtown and the medical center, faster ramps, none of IAH's airline sequencing. Intercontinental earns its place on international itineraries needing its customs and connection infrastructure.",
      },
    ],
  },
];

export const CITIES: CharterCity[] = SEEDS.map((s) => {
  const airports = s.airports.map((a) => {
    const airport = findAirport(a.code);
    if (!airport) throw new Error(`cities.ts: unknown airport "${a.code}" in "${s.slug}"`);
    return { airport, role: a.role, drive: a.drive };
  });
  const lanes = s.lanes.map((code) => {
    const airport = findAirport(code);
    if (!airport) throw new Error(`cities.ts: unknown lane airport "${code}" in "${s.slug}"`);
    return airport;
  });
  return {
    slug: s.slug,
    name: s.name,
    state: s.state,
    lead: s.lead,
    airports,
    primary: airports[0].airport,
    lanes,
    opsFaq: s.opsFaq,
  };
});

export function getCity(slug: string): CharterCity | undefined {
  return CITIES.find((c) => c.slug === slug);
}
