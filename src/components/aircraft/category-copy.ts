// Presentational copy for the light category template (jn-categories.js in
// the handoff). Facts — passengers, range, speed, sample aircraft, rates —
// stay in src/lib/fleet.ts and src/lib/models.ts; this file only carries
// the template's planning language, icons and imagery per category.

import type { AircraftCategorySlug } from "@/lib/fleet";
import { SITE } from "@/lib/constants";
import type { IconName } from "./line-icon";

const L = "/images/light/";

export const FAA_URL = "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft";
export const NBAA_URL =
  "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/";

/** Card / neighbour image per category (the Aircraft page's CATIMG). */
export const CATEGORY_IMAGE: Record<AircraftCategorySlug, string> = {
  turboprop: `${L}turboprop-twin.webp`,
  light: `${L}jet-light.webp`,
  midsize: `${L}jet-midsize.webp`,
  supermid: `${L}cabin-supermid.webp`,
  heavy: `${L}jet-heavy.webp`,
  ultra: `${L}jet-ultra-flight.webp`,
};

/** Manufacturer reference per sample aircraft (fleet.ts sample name). */
export const MODEL_SOURCE: Record<string, { label: string; href: string }> = {
  "Beechcraft King Air 350i": { label: "Textron cabin details", href: "https://beechcraft.txtav.com/en/king-air-360" },
  "Pilatus PC-12 NGX": { label: "Pilatus NGX details", href: "https://www.pilatus-aircraft.com/en/fly/pc-12" },
  "Daher TBM 960": { label: "Daher specifications", href: "https://www.tbm.aero/" },
  "Embraer Phenom 300E": { label: "Embraer specifications", href: "https://executive.embraer.com/global/en/phenom-300e" },
  "Cessna Citation CJ4": { label: "Textron CJ4 details", href: "https://cessna.txtav.com/en/citation/cj4-gen2" },
  "Learjet 75 Liberty": { label: "Ask about this model", href: `mailto:${SITE.email}?subject=Learjet%2075%20Liberty` },
  "Cessna Citation XLS+": { label: "Textron cabin details", href: "https://cessna.txtav.com/en/citation/xls-gen2" },
  "Hawker 900XP": { label: "Hawker manufacturer background", href: "https://beechcraft.txtav.com/" },
  "Learjet 60XR": { label: "Ask about this model", href: `mailto:${SITE.email}?subject=Learjet%2060XR` },
  "Bombardier Challenger 350": { label: "Bombardier Challenger 350 details", href: "https://bombardier.com/en/aircraft/challenger-350" },
  "Cessna Citation Longitude": { label: "Textron Citation Longitude details", href: "https://cessna.txtav.com/en/citation/longitude" },
  "Embraer Praetor 600": { label: "Embraer Praetor 600 details", href: "https://executive.embraer.com/global/en/praetor-600" },
  "Gulfstream G450": { label: "Gulfstream aircraft details", href: "https://www.gulfstream.com/en/aircraft/" },
  "Bombardier Challenger 605": { label: "Bombardier Challenger details", href: "https://bombardier.com/en/aircraft" },
  "Dassault Falcon 2000LXS": { label: "Dassault Falcon details", href: "https://www.dassaultfalcon.com/aircraft/" },
  "Gulfstream G650ER": { label: "Gulfstream G650ER details", href: "https://www.gulfstream.com/en/aircraft/" },
  "Bombardier Global 7500": { label: "Bombardier Global 7500 details", href: "https://bombardier.com/en/aircraft" },
  "Dassault Falcon 8X": { label: "Dassault Falcon 8X details", href: "https://www.dassaultfalcon.com/aircraft/" },
};

export type CategoryCopy = {
  /** Display name in the template ("Light jet", "Super-midsize"). */
  name: string;
  /** Plural card title on the Aircraft page ("Light jets"). */
  plural: string;
  tagline: string;
  hero: string;
  cabinImage: string;
  ctaImage: string;
  cta: string;
  sideTitle: string;
  compareLabel: string;
  fitTitle: string;
  modelsTitle: string;
  ctaTitle: string;
  caveat: string;
  /** Aircraft page card + quick compare. */
  cardBody: string;
  examples: string;
  question: string;
  compareBody: string;
  quick: { fit: string; cabin: string; bags: string };
  roomTitle: string;
  room: [string, string, IconName][];
  nonstopTitle: string;
  nonstopSub: string;
  nonstopTip: string;
  neighbors: { prev: Neighbor | null; next: Neighbor | null };
  faq: [string, string][];
  cost: [string, IconName][];
  checklist: string[];
  arrival?: [string, string, IconName][];
  lessRange?: string;
};

export type Neighbor = { slug: AircraftCategorySlug; name: string; body: string };

const COST_A: [string, IconName][] = [
  ["Flight time & aircraft positioning", "plane"],
  ["Crew, overnight & airport charges", "people"],
  ["Taxes, catering & requested extras", "doc"],
  ["Change, cancellation & refund terms", "calendar"],
];

const ROOM_SMALL = (seatLine: string, serviceLine: string): [string, string, IconName][] => [
  ["Headroom", "Compare your height with the published cabin dimensions.", "person"],
  ["Floor & seating", seatLine, "seat"],
  ["Baggage", "Confirm sizes, weight and loading access.", "bag"],
  ["Onboard service", serviceLine, "cup"],
];

export const CATEGORY_COPY: Record<AircraftCategorySlug, CategoryCopy> = {
  turboprop: {
    name: "Turboprop",
    plural: "Turboprop",
    tagline: "A practical choice for regional travel.",
    hero: `${L}page-07-hero.webp`,
    cabinImage: `${L}cabin-light.webp`,
    ctaImage: `${L}mountain-landscape.webp`,
    cta: "Request a turboprop quote",
    sideTitle: "Find the right fit.",
    compareLabel: "Compare categories",
    fitTitle: "When should you consider a turboprop?",
    modelsTitle: "Start with the aircraft, not the category average.",
    ctaTitle: "Let the trip choose the aircraft.",
    caveat: "Airport access depends on the aircraft, runway, weather, load and operator approval.",
    cardBody: "Explore for regional trips and airport flexibility. Check runway suitability and baggage.",
    examples: "Pilatus PC-12 · King Air 350",
    question: "Is the aircraft suitable for my airports and bags?",
    compareBody: "Match runway access, cabin comfort and a short route.",
    quick: {
      fit: "Short regional trips and smaller airports. A strong fit for weekend hops and hard-to-reach destinations.",
      cabin: "Compact cabin for small groups.",
      bags: "Soft bags for a short trip.",
    },
    roomTitle: "What will your cabin actually be like?",
    room: [
      ["Headroom", "Compare your height with the published cabin dimensions.", "person"],
      ["Floor & seating", "Ask about club seating, a divan and usable passenger seats.", "seat"],
      ["Baggage", "Confirm sizes, weight and the rear cargo door access.", "bag"],
      ["Onboard service", "Check lavatory availability, catering and headsets.", "cup"],
    ],
    nonstopTitle: "Can your turboprop fly nonstop?",
    nonstopSub: "The answer depends on the specific aircraft and planned flight, not the category name.",
    nonstopTip:
      "Ask for both options: a turboprop itinerary with any expected fuel stop, and a light-jet alternative when time is essential.",
    neighbors: {
      prev: null,
      next: { slug: "light", name: "Light jet", body: "Compare speed and total trip price for a longer leg." },
    },
    faq: [
      ["Are turboprops slower than jets?", "Yes, typically by a third on cruise speed. On a one-hour hop the difference is minutes; on a long leg it adds up. Ask for both itineraries."],
      ["Can a turboprop use airports jets cannot?", "Often, yes. Many turboprops operate from shorter and unpaved runways, which can put you closer to your destination."],
      ["Is there a lavatory on board?", "It depends on the model and configuration. Confirm the quoted aircraft’s cabin equipment before you book."],
    ],
    cost: COST_A,
    checklist: [
      "Runway and airport approval for the specific aircraft",
      "Usable passenger seats with two pilots",
      "Baggage size, weight and in-flight access",
      "Expected fuel stop, if any",
      "Lavatory type and cabin height",
      "Total trip price including positioning",
    ],
  },
  light: {
    name: "Light jet",
    plural: "Light jets",
    tagline: "The right cabin for a smaller group.",
    hero: `${L}page-08-hero.webp`,
    cabinImage: `${L}cabin-light.webp`,
    ctaImage: `${L}jet-ultra-flight.webp`,
    cta: "Request a light jet quote",
    sideTitle: "Find a light jet for your trip.",
    compareLabel: "Compare aircraft",
    fitTitle: "Start with the trip.",
    modelsTitle: "Light jets worth comparing.",
    ctaTitle: "Let’s find the right light jet.",
    caveat: "Airport access and nonstop capability must be assessed for the specific flight.",
    cardBody: "Explore compact cabins for smaller groups. Check headroom, seating and luggage.",
    examples: "Phenom 300E · Citation CJ4",
    question: "Does the cabin fit my group comfortably?",
    compareBody: "Compare seating and total trip price for your group.",
    quick: {
      fit: "Shorter trips for smaller groups. A strong fit for business day trips and weekend travel.",
      cabin: "Compact cabin for smaller groups.",
      bags: "Bags for a short trip (soft bags or standard suitcases).",
    },
    roomTitle: "Cabin comfort, made specific.",
    room: ROOM_SMALL("Ask about a dropped aisle, club seats and usable passenger seats.", "Check lavatory privacy, catering and Wi-Fi availability."),
    nonstopTitle: "Will it fly your route nonstop?",
    nonstopSub: "Published range is a planning reference, not a promise for a fully loaded flight.",
    nonstopTip:
      "Ask for both options: a suitable light-jet itinerary with any expected fuel stop, and a midsize alternative when nonstop travel is essential.",
    neighbors: {
      prev: { slug: "turboprop", name: "Turboprop", body: "Compare runway access and total price for a short hop." },
      next: { slug: "midsize", name: "Midsize", body: "Compare cabin comfort, luggage and nonstop range." },
    },
    faq: [
      ["Can I stand upright in a light jet?", "Rarely. Most light-jet cabins are under five feet high. Confirm the published cabin height of the quoted aircraft."],
      ["Will a light jet fly coast to coast nonstop?", "Usually not with passengers and bags. Expect a fuel stop or compare a midsize or super-midsize aircraft."],
      ["Is there a lavatory and Wi-Fi on board?", "Many light jets have an enclosed lavatory; Wi-Fi varies by aircraft. Ask for the equipment list of the specific tail."],
    ],
    cost: COST_A,
    checklist: [
      "Usable passenger seats and seating layout",
      "Baggage compartment size and access",
      "Lavatory type and cabin height",
      "Expected fuel stop on the longest leg",
      "Wi-Fi fitted and available",
      "Total trip price including positioning",
    ],
  },
  midsize: {
    name: "Midsize",
    plural: "Midsize jets",
    tagline: "Room to work. Space to unwind.",
    hero: `${L}page-09-hero.webp`,
    cabinImage: `${L}cabin-midsize.webp`,
    ctaImage: `${L}jet-midsize.webp`,
    cta: "Request a midsize quote",
    sideTitle: "Find the right midsize jet",
    compareLabel: "Compare categories",
    fitTitle: "Choose around the trip you actually have.",
    modelsTitle: "Three models. Different cabins and capabilities.",
    ctaTitle: "Find the cabin that fits your journey.",
    caveat: "A midsize label does not guarantee a six-foot cabin or nonstop coast-to-coast range.",
    cardBody: "Compare cabin comfort for longer trips. Check the specific cabin and route.",
    examples: "Citation XLS+ · Hawker 900XP",
    question: "Does the exact model meet my cabin and route needs?",
    compareBody: "Match cabin comfort, luggage and route requirements.",
    quick: {
      fit: "Longer trips with more room to work and relax. A strong fit for small teams and families.",
      cabin: "More room for longer trips.",
      bags: "Bags for a longer trip (including golf clubs and larger items).",
    },
    roomTitle: "What does “more room” mean for you?",
    room: ROOM_SMALL("Ask about a dropped aisle, divan and usable passenger seats.", "Check lavatory privacy, catering, Wi-Fi and attendant availability."),
    nonstopTitle: "Can your midsize jet fly nonstop?",
    nonstopSub: "The answer depends on the specific aircraft and planned flight, not the category name.",
    nonstopTip:
      "Ask for both options: a suitable midsize itinerary with any expected fuel stop, and a larger-aircraft alternative when nonstop travel is essential.",
    neighbors: {
      prev: { slug: "light", name: "Light jet", body: "Compare cabin fit and total price for a smaller group." },
      next: { slug: "supermid", name: "Super-midsize", body: "Compare extra cabin space, seating and route capability." },
    },
    faq: [
      ["Can I stand upright in every midsize jet?", "No. Cabin height varies by model. The Citation XLS+ has a published 5 ft 8 in height in its dropped aisle; confirm the aircraft dimensions before booking."],
      ["Will a midsize jet fly coast to coast nonstop?", "Sometimes, depending on the model, load, wind and reserves. Ask for a trip-specific assessment and a larger alternative if nonstop matters."],
      ["Are Wi-Fi, catering and a flight attendant included?", "Equipment and service vary by aircraft and operator. Confirm what is on the quoted tail and what is billed separately."],
    ],
    cost: COST_A,
    checklist: [
      "Seating layout and dropped-aisle height",
      "Baggage volume and heavy-item limits",
      "Enclosed lavatory confirmed",
      "Nonstop capability for your loaded trip",
      "Wi-Fi and galley equipment",
      "Total trip price including positioning",
    ],
  },
  supermid: {
    name: "Super-midsize",
    plural: "Super-midsize jets",
    tagline: "Room to settle in. Range to go further.",
    hero: `${L}page-10-hero.webp`,
    cabinImage: `${L}cabin-supermid.webp`,
    ctaImage: `${L}jet-ultra-flight.webp`,
    cta: "Request a super-midsize quote",
    sideTitle: "Find your aircraft",
    compareLabel: "Compare models",
    fitTitle: "A little more space changes the journey.",
    modelsTitle: "Three aircraft to consider.",
    ctaTitle: "Your route. Your priorities. The right aircraft.",
    caveat: "A super-midsize label does not guarantee a transatlantic nonstop with a full cabin and bags.",
    cardBody: "Consider more cabin space and range. Confirm loaded nonstop capability.",
    examples: "Challenger 350 · Citation Longitude",
    question: "Can this aircraft fly my loaded route nonstop?",
    compareBody: "Compare extra space and mission capability.",
    quick: {
      fit: "More cabin space for longer trips. A strong fit for families, teams and international travel.",
      cabin: "More cabin space for longer trips.",
      bags: "Bags for extended trips (including golf clubs and larger items).",
    },
    roomTitle: "Look beyond the passenger count.",
    room: [
      ["Seating & sleep", "Confirm takeoff seats and available sleeping positions.", "seat"],
      ["Baggage", "Check bag sizes, weight and compartment access.", "bag"],
      ["Wi-Fi & service", "Confirm installed system, coverage, catering and attendant.", "cup"],
      ["Cabin layout", "Review current photos and the exact seating plan.", "doc"],
    ],
    nonstopTitle: "Will your route fly nonstop?",
    nonstopSub:
      "Tell us your airports, travel direction, passengers and bags. The operator must confirm the route for the specific aircraft.",
    nonstopTip:
      "Ask for both options: a super-midsize itinerary with any expected fuel stop, and a heavy-jet alternative when nonstop overseas travel is essential.",
    neighbors: {
      prev: { slug: "midsize", name: "Midsize", body: "Compare cabin fit and total price for a shorter trip." },
      next: { slug: "heavy", name: "Heavy jet", body: "Compare layouts for work, dining and rest on longer flights." },
    },
    faq: [
      ["Can I stand upright in a super-midsize jet?", "On most models, yes: published cabin heights are close to six feet. Confirm the quoted aircraft’s dimensions."],
      ["Will it fly coast to coast nonstop?", "Typically yes with a normal load; strong winter headwinds, full cabins and reserves can still change the plan. Ask for a trip-specific assessment."],
      ["Is a flight attendant included?", "Not always. Some operators offer one on request. Confirm attendant, catering and Wi-Fi on the specific tail."],
    ],
    cost: COST_A,
    checklist: [
      "Flat-floor cabin and seat count sold",
      "Berthable seats or divan for overnight legs",
      "Baggage volume and ski/golf access",
      "Nonstop capability with your load and winds",
      "Attendant, galley and Wi-Fi",
      "Total trip price including positioning",
    ],
  },
  heavy: {
    name: "Heavy jet",
    plural: "Heavy jets",
    tagline: "A cabin that fits the way you travel.",
    hero: `${L}page-11-hero.webp`,
    cabinImage: `${L}cabin-heavy.webp`,
    ctaImage: `${L}mountain-landscape.webp`,
    cta: "Request a charter quote",
    sideTitle: "Find the right heavy jet",
    compareLabel: "Compare categories",
    fitTitle: "Choose around the trip you actually have.",
    modelsTitle: "Three models. Different cabins and capabilities.",
    ctaTitle: "Find the cabin that fits your journey.",
    caveat: "A heavy-jet label does not guarantee a private bedroom, a nonstop crossing or a cabin attendant.",
    cardBody: "Explore layouts for work, dining and rest. Confirm seats and sleeping positions.",
    examples: "Gulfstream G450 · Challenger 605",
    question: "How many people can sit, sleep and dine?",
    compareBody: "Focus on the actual cabin layout and mission.",
    quick: {
      fit: "Long flights for larger groups. A strong fit when seating, dining and sleeping positions all matter.",
      cabin: "Separate zones for work, dining and rest.",
      bags: "Bags for long trips, with in-flight access on many aircraft.",
    },
    roomTitle: "Check seating and sleeping layouts.",
    room: [
      ["Seats & sleeping", "Confirm both counts separately.", "seat"],
      ["Privacy & lavatories", "Ask about partitions, doors and facilities.", "person"],
      ["Service & connectivity", "Confirm attendant, catering and fitted Wi-Fi.", "cup"],
      ["Baggage", "Check dimensions, weight and in-flight access.", "bag"],
    ],
    nonstopTitle: "Can your route fly nonstop?",
    nonstopSub:
      "Airports, direction, winds, passenger load, baggage and fuel reserves all matter. Request an assessment for the aircraft offered.",
    nonstopTip: "A fuel stop or a different aircraft may be appropriate. Ask for both itineraries.",
    neighbors: {
      prev: { slug: "supermid", name: "Super-midsize", body: "Compare when a smaller cabin meets your needs." },
      next: { slug: "ultra", name: "Ultra-long-range", body: "Compare for longer missions or different cabin needs." },
    },
    faq: [
      ["Do all heavy jets have a private bedroom?", "No. Some layouts use convertible seats or divans. Confirm the sleeping arrangement, privacy and number of sleeping positions on the aircraft offered."],
      ["Will my flight operate nonstop?", "Published range is a planning reference. The operating carrier confirms nonstop capability for your route, load, winds and fuel reserves."],
      ["Is a cabin attendant or Wi-Fi included?", "Not always. Confirm attendant, catering and fitted Wi-Fi on the specific aircraft, and whether they are billed separately."],
      ["What should my quote include?", "The operating carrier, aircraft, included items, additional charges, and the change and cancellation terms."],
    ],
    cost: [
      ["Flight time & positioning", "plane"],
      ["Taxes & airport charges", "doc"],
      ["Crew, catering & requested services", "people"],
      ["Cancellation terms & possible extras", "calendar"],
    ],
    checklist: [
      "Approved passenger seating",
      "Sleeping positions and bedding",
      "Cabin privacy and lavatories",
      "Baggage size, weight and access",
      "Installed Wi-Fi and coverage",
      "Attendant and catering arrangements",
    ],
  },
  ultra: {
    name: "Ultra-long-range",
    plural: "Ultra-long-range jets",
    tagline: "Make room for the whole journey.",
    hero: `${L}page-12-hero.webp`,
    cabinImage: `${L}cabin-ultra.webp`,
    ctaImage: `${L}jet-ultra-flight.webp`,
    cta: "Request a charter quote",
    sideTitle: "Find the right long-range jet",
    compareLabel: "Compare categories",
    fitTitle: "Choose around the trip you actually have.",
    modelsTitle: "Three models. Different cabins and capabilities.",
    ctaTitle: "Find the cabin that fits your journey.",
    caveat: "A published maximum range is not a guarantee for your flight.",
    cardBody: "Compare options for long-distance travel. Check range assumptions and cabin privacy.",
    examples: "G650ER · Global 7500",
    question: "What speed, load and routing assumptions apply?",
    compareBody: "Compare range assumptions and cabin privacy.",
    quick: {
      fit: "Intercontinental journeys with privacy and rest. A strong fit for overnight flights and multi-stop itineraries.",
      cabin: "Privacy, sleeping positions and crew rest.",
      bags: "Bags for extended international travel.",
    },
    roomTitle: "Choose the layout for your journey.",
    room: [
      ["Seats & sleeping", "Confirm both counts and bed arrangements.", "seat"],
      ["Privacy & facilities", "Check doors, partitions, lavatories and any fitted shower.", "person"],
      ["Crew & cabin service", "Confirm crew-rest arrangements, attendant and catering.", "cup"],
      ["Connectivity & baggage", "Check installed Wi-Fi, coverage, bag sizes and access.", "bag"],
    ],
    nonstopTitle: "Nonstop begins with a trip-specific plan.",
    nonstopSub:
      "A published maximum range is not a guarantee for your flight. Ask the operating carrier to assess the aircraft, route, travel dates and load.",
    nonstopTip: "A fuel stop or another aircraft may be appropriate. High-speed cruise, winds and airport load all reduce range.",
    neighbors: {
      prev: { slug: "heavy", name: "Heavy jet", body: "Compare heavy jets when they meet your cabin and route requirements." },
      next: null,
    },
    faq: [
      ["Will every passenger have a bed?", "Not necessarily. Approved passenger seating and sleeping positions are different. Confirm the exact cabin arrangement and overnight needs before booking."],
      ["Does maximum range apply at high-speed cruise?", "Usually not. Published ranges assume a specific speed, load and reserves; flying faster reduces range."],
      ["Are a shower and streaming Wi-Fi included?", "Only on some aircraft. Confirm fitted equipment and coverage for your route on the specific tail."],
      ["Can my itinerary be confirmed nonstop?", "Only after the operating carrier assesses the aircraft, route, dates, winds, load and airports."],
    ],
    cost: [
      ["Flight time & positioning", "plane"],
      ["Crew, handling & airport charges", "people"],
      ["Taxes, catering & requested services", "doc"],
      ["Cancellation & possible additional charges", "calendar"],
    ],
    checklist: [
      "Approved passenger seats",
      "Sleeping positions and bedding",
      "Privacy, doors and partitions",
      "Any fitted shower and lavatories",
      "Crew rest, attendant and catering",
      "Wi-Fi coverage and baggage access",
    ],
    arrival: [
      ["Traveler documents", "Check passport, visa and entry requirements for each traveler.", "doc"],
      ["Airport arrangements", "Confirm arrival procedures and airport access with the operator.", "plane"],
      ["Local arrival details", "Coordinate local dates, times and ground transport.", "calendar"],
    ],
    lessRange: "Compare heavy jets when they meet your cabin and route requirements.",
  },
};

/** fleet.ts best-for icon keys → template line icons. */
export const BEST_FOR_ICON: Record<string, IconName> = {
  boltsmall: "bolt",
  compass: "compass",
  users: "people",
  calendar: "calendar",
  globe: "globe",
  shield: "shield",
  moon: "moon",
  table: "table",
};
