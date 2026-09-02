// Route-page registry — one entry per city-pair landing page
// (/routes/{slug}). Scoped per the four-broker audit: ~20 deep pages on
// lanes with confirmed low-difficulty demand, not thousands of thin
// ones. One canonical direction per pair (the reverse is the same lane
// and the same math — the page says so and prefills the wizard either
// way) to avoid near-duplicate content.
//
// Everything priced on these pages comes from the quote engine at build
// time; the registry holds only identity, the charter-airport choice,
// and a curated dispatcher's note.
import { findAirport, type Airport } from "@/lib/airports";

export type RouteSeed = {
  slug: string;
  /** IATA/ICAO codes resolved against lib/airports at module init. */
  from: string;
  to: string;
  /** Dispatcher's note — 1-2 sentences of lane-specific truth. */
  note: string;
};

export type CharterRoute = {
  slug: string;
  from: Airport;
  to: Airport;
  note: string;
};

const SEEDS: RouteSeed[] = [
  // ── From Los Angeles ──
  {
    slug: "los-angeles-to-las-vegas",
    from: "VNY",
    to: "LAS",
    note: "The busiest private lane in the West — under an hour wheels-to-wheels, and the drive-time math beats the airline before you've parked at LAX. Fight-night and convention weekends sell out early; empty legs back to LA are common on Sundays.",
  },
  {
    slug: "los-angeles-to-aspen",
    from: "VNY",
    to: "ASE",
    note: "Aspen-Pitkin is slot-controlled with a mountain approach and a night curfew — exactly the airport private aviation is for. Turboprops and light jets handle the field best; winter Saturdays book a week or more out.",
  },
  {
    slug: "los-angeles-to-new-york",
    from: "VNY",
    to: "TEB",
    note: "The transcon: Van Nuys to Teterboro, ramp to ramp, no terminal on either end. Westbound headwinds make the return longer — super-mid and up fly it nonstop both directions; light jets take a fuel stop westbound.",
  },
  {
    slug: "los-angeles-to-san-francisco",
    from: "VNY",
    to: "SFO",
    note: "The shuttle run. About an hour twenty in a light jet, and the door-to-door beats commercial by half a morning. High-frequency lane, which means empty legs appear on it weekly.",
  },
  {
    slug: "los-angeles-to-cabo",
    from: "LAX",
    to: "SJD",
    note: "Two and a half hours to Los Cabos, customs cleared on the ramp. International handling is itemized on the quote — no surprises on arrival. Midsize and up is the comfortable call with bags and boards.",
  },
  {
    slug: "los-angeles-to-seattle",
    from: "LAX",
    to: "SEA",
    note: "Just under a thousand miles up the coast — light-jet territory on paper, midsize in comfort. Boeing Field (KBFI) is the closer-in alternative when Sea-Tac slots are tight; ask dispatch which fits your day.",
  },
  {
    slug: "los-angeles-to-scottsdale",
    from: "VNY",
    to: "SDL",
    note: "Golf-bag country: Scottsdale's executive field puts you fifteen minutes from the courses, and a turboprop does the lane at the category's lowest hourly. Spring training season books dense.",
  },
  {
    slug: "los-angeles-to-jackson-hole",
    from: "VNY",
    to: "JAC",
    note: "High elevation, box canyon, weather that changes its mind — Jackson Hole rewards airframes and crews that know it. Our trip-level review runs the mountain-field check before every booking on this lane.",
  },
  {
    slug: "los-angeles-to-dallas",
    from: "VNY",
    to: "DAL",
    note: "Love Field over DFW, every time — it's the business airport, minutes from downtown. A midsize does it nonstop with the whole team aboard.",
  },
  {
    slug: "los-angeles-to-london",
    from: "LAX",
    to: "LHR",
    note: "The long haul west-to-east: ultra-long-range territory, flown overnight so you land at breakfast. Wyvern Wingman or IS-BAO Stage 2 operators only on international missions — that's the floor, not an upgrade.",
  },
  // ── From New York ──
  {
    slug: "new-york-to-miami",
    from: "TEB",
    to: "OPF",
    note: "Teterboro to Opa-Locka — the executive fields on both ends, skipping JFK and MIA entirely. Two and a half hours; the winter-season Thursday/Sunday waves are the densest private traffic on the East Coast.",
  },
  {
    slug: "new-york-to-palm-beach",
    from: "TEB",
    to: "PBI",
    note: "The season commute. Light jets do it nonstop with four aboard; midsize adds the full-cabin margin. Palm Beach ramp space gets tight around holidays — book the slot with the airframe.",
  },
  {
    slug: "new-york-to-aspen",
    from: "TEB",
    to: "ASE",
    note: "A long leg into a short, high runway — this is super-mid territory nonstop, or a fuel stop in something smaller. Aspen's curfew makes the departure-time conversation matter; dispatch will have it with you up front.",
  },
  {
    slug: "new-york-to-london",
    from: "TEB",
    to: "LTN",
    note: "Teterboro to Luton — the business fields, both ends. Heavy jets fly it nonstop eastbound; the westbound return against the winds is where the ultra category earns its rate. International floor applies: Wingman or IS-BAO Stage 2 operators.",
  },
  {
    slug: "new-york-to-marthas-vineyard",
    from: "TEB",
    to: "MVY",
    note: "Forty minutes instead of a ferry queue. Turboprops and light jets are the honest call for the short strip and the short leg — the whole point is leaving when lunch ends, not when the schedule says.",
  },
  {
    slug: "boston-to-miami",
    from: "BOS",
    to: "MIA",
    note: "Three hours down the seaboard. Hanscom Field (KBED) is Boston's executive alternative when Logan's commercial banks slow the ramp; on the Miami end, Opa-Locka usually beats MIA to the car.",
  },
  // ── From Miami ──
  {
    slug: "miami-to-bahamas",
    from: "MIA",
    to: "NAS",
    note: "Under an hour to Nassau, customs on arrival, and the turboprop does it at the lowest hourly on the board — island-hopping is what the category is for. Bring passports; dispatch files the eAPIS.",
  },
  {
    slug: "miami-to-jacksonville",
    from: "OPF",
    to: "JAX",
    note: "The in-state hop the airlines make you connect for. An hour in a light jet or turboprop, Opa-Locka to Jacksonville, and the meeting is done before the commercial option would have boarded.",
  },
  // ── Other lanes ──
  {
    slug: "chicago-to-las-vegas",
    from: "MDW",
    to: "LAS",
    note: "Midway is Chicago's private-aviation front door — closer in than O'Hare and faster off the ramp. Three and a half hours to Vegas in a midsize; convention weeks price the same but book earlier.",
  },
  {
    slug: "chicago-to-new-york",
    from: "MDW",
    to: "TEB",
    note: "The business shuttle, done properly: Midway to Teterboro in about two hours, both airports minutes from the meeting. Light jets handle it with margin; the lane runs dense enough that empty legs surface regularly.",
  },
  {
    slug: "dallas-to-las-vegas",
    from: "DAL",
    to: "LAS",
    note: "Love Field to Vegas in under two and a half hours. A light jet fits four with bags; the midsize step-up buys the stand-up cabin for the same crew of six that would split across airline rows.",
  },
  {
    slug: "san-francisco-to-las-vegas",
    from: "SFO",
    to: "LAS",
    note: "Ninety minutes over the Sierra. High-frequency leisure lane — which is exactly where repositioning legs come from; a watchlist on this pair pays for itself the first time it fires.",
  },
];

// Resolve seeds against the airport table at module init — an unknown
// code fails the build instead of shipping a page with missing data.
export const ROUTES: CharterRoute[] = SEEDS.map((s) => {
  const from = findAirport(s.from);
  const to = findAirport(s.to);
  if (!from || !to) throw new Error(`routes.ts: unknown airport in "${s.slug}"`);
  return { slug: s.slug, from, to, note: s.note };
});

export function getRoute(slug: string): CharterRoute | undefined {
  return ROUTES.find((r) => r.slug === slug);
}

export function relatedRoutes(route: CharterRoute, limit = 3): CharterRoute[] {
  const shared = ROUTES.filter(
    (r) =>
      r.slug !== route.slug &&
      (r.from.city === route.from.city ||
        r.to.city === route.to.city ||
        r.from.city === route.to.city ||
        r.to.city === route.from.city),
  );
  // Lanes that share no city with this one (Jackson Hole, say) still get
  // a full band — back-fill with the strongest remaining routes so every
  // route page carries at least `limit` internal links to siblings.
  const fill = ROUTES.filter((r) => r.slug !== route.slug && !shared.includes(r));
  return [...shared, ...fill].slice(0, limit);
}
