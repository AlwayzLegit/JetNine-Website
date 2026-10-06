// Short planning guides (the light handoff's "Guide 14" template).
// Content ported from the design pack's jn-guides14.js (ids 1-14) and
// jn-guides6.js (ids 15-20). Drives /guides/[slug], the two existing
// chapter pages that share the template (one-way-vs-round-trip,
// last-minute-private-jet) and the /guides library index.
//
// Copy was written by the design tool and is deliberately hedged ("ask",
// "confirm"); anything stating a hard fact we cannot back was removed or
// softened during the port.

export type GuideIcon =
  | "people" | "bag" | "plane" | "seat" | "route" | "clock" | "doc" | "card" | "calc" | "pin"
  | "warn" | "calendar" | "passport" | "door" | "scale" | "fuel" | "wind" | "paw" | "wifi"
  | "cup" | "tag" | "wheel";

export type GuideSource = { org: string; title: string; note: string; url: string };

export type GlossaryTerm = {
  slug: string;
  category: "Aircraft" | "Pricing" | "Airports" | "Booking";
  name: string;
  definition: string;
  why: string;
  ask: string[];
};

export type ShortGuide = {
  id: number;
  slug: string;
  /** Page H1. */
  title: string;
  /** Breadcrumb label + related-card subline. */
  short: string;
  /** <title> (the root template appends " · JetNine"). */
  metaTitle: string;
  description: string;
  eyebrow: string;
  dek: string;
  /** The "quick answer" strip under the hero. */
  takeaway: string;
  primaryCta: string;
  hero: string;
  /** Second hero photo — renders the split "charter vs first class" hero. */
  heroB?: string;
  inline?: string;
  sideImg?: string;
  band: string;
  sectionsTitle: string;
  sectionsSub: string;
  sections: { title: string; text: string; icon: GuideIcon }[];
  table: { title: string; headers: string[]; rows: string[][] };
  cardsTitle: string;
  cards: { img: string; title: string; body: string; href?: string }[];
  checklistTitle: string;
  checklist: string[];
  faq: { q: string; a: string }[];
  sources: SourceKey[];
  related: { slug: string; img?: string }[];
  /** Trip-brief panel title. */
  toolTitle: string;
  /** Guide-specific trip-brief fields (passed to the quote wizard as notes). */
  fields: { label: string; placeholder: string }[];
  bandTitle: string;
  /** Glossary only: replaces the numbered sections with a searchable term list. */
  terms?: GlossaryTerm[];
};

export const SHORT_GUIDE_SOURCES = {
  faa: {
    org: "FAA",
    title: "Charter safety",
    note: "U.S. operator and aircraft authorization.",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft"
  },
  nbaa: {
    org: "NBAA",
    title: "Charter consumer guide",
    note: "Questions for evaluating charter providers.",
    url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/aircraft-charter-consumer-guide/"
  },
  aca: {
    org: "The Air Charter Association",
    title: "Brokers",
    note: "Broker coordination and operator responsibilities.",
    url: "https://www.theaircharterassociation.aero/why-charter/aircharterbroker/"
  },
  dot: {
    org: "U.S. DOT",
    title: "Charter guidance",
    note: "Charter categories and applicable consumer rules.",
    url: "https://www.transportation.gov/airconsumer/charters"
  },
  state: {
    org: "U.S. State Department",
    title: "Travel checklist",
    note: "Document and destination checks for U.S. travelers.",
    url: "https://travel.state.gov/en/international-travel/planning/checklist.html"
  },
  cbp: {
    org: "U.S. CBP",
    title: "General aviation",
    note: "U.S. border processing for general aviation.",
    url: "https://www.cbp.gov/travel/general-aviation-processing"
  },
  range: {
    org: "Gulfstream",
    title: "G700 specifications",
    note: "Published performance assumptions; not a trip guarantee.",
    url: "https://www.gulfstream.com/en/aircraft/gulfstream-g700/"
  },
  aphis: {
    org: "USDA APHIS",
    title: "Pet travel",
    note: "Country-specific health certification planning.",
    url: "https://www.aphis.usda.gov/pet-travel/pet-travel-process-overview"
  },
  cdc: {
    org: "CDC",
    title: "Bringing a dog into the U.S.",
    note: "Use the current entry guidance for your dog’s travel history.",
    url: "https://www.cdc.gov/importation/dogs/index.html"
  },
  kids: {
    org: "FAA",
    title: "Flying with children",
    note: "Approved restraints, installation and child sizing.",
    url: "https://www.faa.gov/travelers/kids-corner"
  },
  minors: {
    org: "U.S. State Department",
    title: "Minors",
    note: "Check destination rules for children’s travel documents.",
    url: "https://travel.state.gov/en/international-travel/planning/personal-needs/minors.html"
  },
  mobility: {
    org: "FAA PackSafe",
    title: "Mobility devices",
    note: "Battery and equipment handling requirements vary by device.",
    url: "https://www.faa.gov/hazmat/packsafe/wheelchairs-mobility-devices"
  },
  access: {
    org: "U.S. DOT",
    title: "Passengers with disabilities",
    note: "Rights and assistance guidance; confirm applicability.",
    url: "https://www.transportation.gov/airconsumer/passengers-disabilities"
  },
  caa: {
    org: "UK CAA",
    title: "Assisted travel",
    note: "Questions to clarify assistance before travel.",
    url: "https://www.caa.co.uk/air-passengers/assisted-travel/how-to-access-help-and-support/"
  },
  s6_295: {
    org: "U.S. DOT",
    title: "Broker and carrier roles",
    note: "Regulatory definitions of broker and direct air carrier.",
    url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295/subpart-A/section-295.5"
  },
  s6_faa: {
    org: "FAA",
    title: "Charter authorization",
    note: "U.S. operating certificates and aircraft authorization.",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft"
  },
  s6_nbaa: {
    org: "NBAA",
    title: "Charter brokering",
    note: "Brokering roles and practical charter standards.",
    url: "https://nbaa.org/aircraft-operations/part-135/nbaa-best-practices-for-air-charter-brokering/"
  },
  s6_weather: {
    org: "FAA",
    title: "Aviation weather",
    note: "Weather observation resources for aviation.",
    url: "https://www.faa.gov/air_traffic/weather"
  },
  s6_gulf: {
    org: "Gulfstream",
    title: "Cabin specifications",
    note: "An example of manufacturer cabin and configuration information.",
    url: "https://www.gulfstream.com/en/aircraft/gulfstream-g700/"
  },
  s6_fda: {
    org: "FDA",
    title: "Food allergens",
    note: "Allergen labeling and cross-contact information.",
    url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies"
  },
  s6_dot: {
    org: "U.S. DOT",
    title: "Airline commitments",
    note: "Review participating airlines’ disruption commitments.",
    url: "https://www.transportation.gov/airconsumer/airline-customer-service-dashboard"
  },
  s6_fractional: {
    org: "FAA",
    title: "Fractional ownership",
    note: "FAA background on how fractional programs operate in the U.S.",
    url: "https://www.faa.gov/licenses_certificates/airline_certification/air_carrier/14_CFR_Part_91"
  },
  s6_91k: {
    org: "NBAA",
    title: "Fractional ownership programs",
    note: "Background on fractional aircraft programs.",
    url: "https://nbaa.org/aircraft-operations/part-91-subpart-k/"
  },
  s6_cbp: {
    org: "U.S. CBP",
    title: "General aviation",
    note: "U.S. border-processing resources for international trips.",
    url: "https://www.cbp.gov/travel/general-aviation-processing"
  },
  s6_slots: {
    org: "FAA",
    title: "Airport slots",
    note: "A slot is a scheduled takeoff or landing authorization, distinct from ATC clearance.",
    url: "https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/systemops/perf_analysis/slot_administration/slot_definition"
  }
} satisfies Record<string, GuideSource>;

export type SourceKey = keyof typeof SHORT_GUIDE_SOURCES;

export const SHORT_GUIDES: ShortGuide[] = [
  {
    id: 1,
    slug: "how-to-choose-the-right-private-jet",
    title: "How to Choose the Right Private Jet for Your Trip",
    short: "Choose your aircraft",
    metaTitle: "How to Choose the Right Private Jet",
    description: "Match a private jet to your passengers, baggage, route and comfort priorities. Compare aircraft categories and build a practical trip brief.",
    eyebrow: "The right aircraft for your trip",
    dek: "Match a private jet to your passengers, baggage, route and comfort priorities. Compare aircraft categories and build a practical trip brief.",
    takeaway: "Start with people, bag dimensions and exact airports. Ask the operating carrier to confirm the proposed aircraft and cabin layout.",
    primaryCta: "Compare aircraft",
    hero: "/images/light/jet-golden-hour.webp",
    inline: "/images/light/cabin-white-roses.webp",
    band: "/images/light/wing-over-sunset-clouds.webp",
    sectionsTitle: "Four details shape your shortlist.",
    sectionsSub: "Match a private jet to your passengers, baggage, route and comfort priorities.",
    sections: [
      {
        title: "Four details shape your shortlist",
        text: "Count every traveler, including children, and describe the whole party’s needs. List each bag’s dimensions and weight, your exact airports and local departure times. Then rank nonstop travel, cabin space and budget. These details make proposals easier to compare.",
        icon: "people"
      },
      {
        title: "Seats are only the starting point",
        text: "Request the actual seating plan and recent cabin photos. Published passenger capacity does not show which seats suit work, rest or an approved child restraint. Ask separately about sleeping places, lavatory privacy, cabin height and connectivity.",
        icon: "bag"
      },
      {
        title: "Match the aircraft to the mission",
        text: "A smaller aircraft may work well for a short trip, but baggage shape or runway requirements can change the shortlist. A larger cabin does not automatically guarantee nonstop range. Ask the operator to assess route, payload, weather, reserves and airport suitability together.",
        icon: "plane"
      },
      {
        title: "Approve a specific proposal",
        text: "Confirm the operating carrier, proposed aircraft, full price and substitution terms. If an aircraft changes, recheck the cabin layout, baggage acceptance and assistance arrangements. Use the same route and passenger brief when comparing offers.",
        icon: "seat"
      }
    ],
    table: {
      title: "Where to start your shortlist.",
      headers: [
        "Category",
        "Often considered for",
        "Confirm first"
      ],
      rows: [
        [
          "Light jets",
          "Smaller parties and shorter trips",
          "Bag fit and cabin dimensions"
        ],
        [
          "Midsize jets",
          "More cabin room",
          "Actual layout and loaded range"
        ],
        [
          "Super-midsize jets",
          "Longer trips and workspace",
          "Route-specific nonstop feasibility"
        ],
        [
          "Heavy jets",
          "Larger parties and cabin zones",
          "Seats, sleeping places and baggage"
        ],
        [
          "Ultra-long-range jets",
          "Long international journeys",
          "Payload, crew and route requirements"
        ]
      ]
    },
    cardsTitle: "Make the choice around your trip.",
    cards: [
      {
        img: "/images/light/carry-ons-beside-jet.webp",
        title: "4 travelers + carry-ons",
        body: "Start with light or midsize; confirm every bag fits.",
        href: "/aircraft/light"
      },
      {
        img: "/images/light/golf-bags-beside-jet.webp",
        title: "6 travelers + golf bags",
        body: "Let luggage dimensions guide the shortlist.",
        href: "/aircraft/midsize"
      },
      {
        img: "/images/light/sleeping-cabin.webp",
        title: "8 travelers + overnight",
        body: "Confirm sleeping places separately from passenger seats.",
        href: "/aircraft/heavy"
      }
    ],
    checklistTitle: "Before you approve an aircraft.",
    checklist: [
      "Actual aircraft and cabin plan reviewed",
      "All travelers and baggage included",
      "Nonstop or fuel-stop plan explained",
      "Operating carrier identified",
      "Total price and change terms reviewed",
      "Special arrangements confirmed in writing"
    ],
    faq: [
      {
        q: "Does maximum range guarantee a nonstop flight?",
        a: "No. The operator must assess your route, payload, conditions and fuel requirements for the proposed aircraft."
      },
      {
        q: "Are all cabins in the same category identical?",
        a: "No. Layouts, seat counts, baggage holds and amenities vary between models and individual aircraft."
      },
      {
        q: "What should I send for golf bags or skis?",
        a: "Send item count, length, width, height and weight. Ask for loading-door and compartment fit confirmation."
      }
    ],
    sources: [
      "faa",
      "range"
    ],
    related: [
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "private-jet-range-and-fuel-stops"
      },
      {
        slug: "private-jet-accessibility"
      }
    ],
    toolTitle: "Compare aircraft priorities",
    fields: [
      {
        label: "Most important priority",
        placeholder: "Nonstop / space / budget"
      },
      {
        label: "Baggage and oversized items",
        placeholder: "Count, dimensions and weight"
      },
      {
        label: "Cabin requirements",
        placeholder: "Workspace, sleeping, lavatory or seating"
      }
    ],
    bandTitle: "A better flight starts with the right fit."
  },
  {
    id: 2,
    slug: "one-way-vs-round-trip",
    title: "One-Way vs. Round-Trip Private Jet Charter",
    short: "One-way or round-trip",
    metaTitle: "One-Way vs. Round-Trip Private Jet Charter",
    description: "Compare one-way and round-trip private jet charter. Understand aircraft positioning, waiting costs and the itinerary details that shape a quote.",
    eyebrow: "Itinerary structure",
    dek: "Compare one-way and round-trip private jet charter. Understand aircraft positioning, waiting costs and the itinerary details that shape a quote.",
    takeaway: "A round-trip booking is not automatically cheaper. Compare complete itineraries and the terms attached to each aircraft proposal.",
    primaryCta: "Read the guide",
    hero: "/images/light/jet-beside-glass-terminal.webp",
    inline: "/images/light/ground-service-golden-hour.webp",
    band: "/images/light/jet-mediterranean-sunset.webp",
    sectionsTitle: "Define the journey before comparing prices.",
    sectionsSub: "Compare one-way and round-trip private jet charter.",
    sections: [
      {
        title: "Define the journey before comparing prices",
        text: "Share every flight leg, dates, local times and acceptable alternatives. Include the return even if it is uncertain. A one-way quote covers a particular itinerary; it does not mean the aircraft has no positioning costs.",
        icon: "route"
      },
      {
        title: "One-way sourcing can be flexible",
        text: "A broker may source different aircraft for separate legs. Ask whether the operator and cabin can differ, how baggage and special needs will be reconfirmed, and whether one delayed leg affects the next booking.",
        icon: "clock"
      },
      {
        title: "A return flight changes the aircraft plan",
        text: "For some trips, keeping an aircraft nearby may be practical. For others, it may reposition or a different aircraft may operate the return. Waiting time, crew arrangements, parking and aircraft availability can affect the proposal.",
        icon: "plane"
      },
      {
        title: "Compare the total commitment",
        text: "Ask for a complete price and a breakdown of included versus conditional charges. Check change deadlines, aircraft substitution and cancellation exposure for each leg. Do not choose a structure using hourly rate alone.",
        icon: "doc"
      }
    ],
    table: {
      title: "Three itinerary structures.",
      headers: [
        "Structure",
        "Useful question",
        "Watch for"
      ],
      rows: [
        [
          "One-way",
          "What positioning is included?",
          "Return trip needs a separate plan"
        ],
        [
          "Round-trip with short stay",
          "Will the aircraft wait?",
          "Crew, parking and waiting charges"
        ],
        [
          "Return after a longer stay",
          "Same aircraft or separately sourced?",
          "Availability and terms for each leg"
        ],
        [
          "Multi-city",
          "Who coordinates all legs?",
          "Timing dependencies and multiple operators"
        ]
      ]
    },
    cardsTitle: "Three itinerary structures.",
    cards: [
      {
        img: "/images/light/boarding-golden-hour.webp",
        title: "One-way",
        body: "Ask what positioning is included."
      },
      {
        img: "/images/light/chauffeur-sedan.webp",
        title: "Round-trip, short stay",
        body: "Ask whether the aircraft waits."
      },
      {
        img: "/images/light/jet-over-golden-clouds.webp",
        title: "Return after a longer stay",
        body: "Ask whether the same aircraft returns."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "All legs and local times listed",
      "Return flexibility stated",
      "Positioning and waiting costs clarified",
      "Aircraft continuity confirmed",
      "Cancellation terms checked for each leg",
      "Backup plan for itinerary changes discussed"
    ],
    faq: [
      {
        q: "Is round-trip always better value?",
        a: "No. Aircraft location, time away and operating requirements can make different structures more suitable."
      },
      {
        q: "Will I have the same aircraft on the return?",
        a: "Only if the proposal and agreement confirm it. Ask what substitution rights apply."
      },
      {
        q: "Can an empty leg replace a one-way charter?",
        a: "It may suit a flexible trip, but its timing and operation can depend on another flight. Confirm cancellation and replacement arrangements."
      }
    ],
    sources: [
      "aca"
    ],
    related: [
      {
        slug: "private-jet-charter-cancellation-policy"
      },
      {
        slug: "how-far-in-advance-to-book-a-private-jet"
      },
      {
        slug: "last-minute-private-jet"
      }
    ],
    toolTitle: "Compare itinerary options",
    fields: [
      {
        label: "Outbound local time",
        placeholder: "Date, time and departure time zone"
      },
      {
        label: "Return local time",
        placeholder: "Date, time or flexible window"
      },
      {
        label: "Alternative plan",
        placeholder: "Nearby airports or separate aircraft acceptable?"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 3,
    slug: "on-demand-charter-vs-jet-cards-memberships",
    title: "On-Demand Charter vs. Jet Cards vs. Memberships",
    short: "Compare charter programs",
    metaTitle: "Charter vs. Jet Cards vs. Memberships",
    description: "Compare on-demand charter, jet cards and memberships by commitment, availability, pricing and contract terms before choosing a private travel option.",
    eyebrow: "Compare charter programs",
    dek: "Compare on-demand charter, jet cards and memberships by commitment, availability, pricing and contract terms before choosing a private travel option.",
    takeaway: "Product names are not standardized. Compare the actual agreement, total cost and availability conditions, not the label.",
    primaryCta: "Read the guide",
    hero: "/images/light/notebook-sunset-window.webp",
    inline: "/images/light/lounge-golden-hour.webp",
    band: "/images/light/wing-over-sunset-clouds.webp",
    sectionsTitle: "Start with how you expect to fly.",
    sectionsSub: "Compare on-demand charter, jet cards and memberships by commitment, availability, pricing and contract terms before choosing a private travel option.",
    sections: [
      {
        title: "Start with how you expect to fly",
        text: "Write down likely routes, annual flying, passenger count and peak-date needs. Separate firm trips from possible ones. A program that suits repeated domestic journeys may be less useful for changing international itineraries.",
        icon: "doc"
      },
      {
        title: "On-demand charter: decide trip by trip",
        text: "You source and approve a proposal for a specific itinerary. Aircraft and price can vary between trips. Compare full quotes and ask how changes, cancellation, substitution and payment are handled before confirming each booking.",
        icon: "plane"
      },
      {
        title: "Jet cards and memberships: read the conditions",
        text: "A card may involve prepaid funds or hours; a membership may charge access fees or use another structure. Availability, notice periods and pricing protections differ. Identify the contracting entity, operating carrier arrangements and what happens to unused funds.",
        icon: "card"
      },
      {
        title: "Test the program against real trips",
        text: "Request worked examples for your usual route, a peak date and a trip outside the main service area. Include taxes, minimum charges, repositioning, additional fees and renewal costs. Ask which benefits are commitments in writing.",
        icon: "calc"
      }
    ],
    table: {
      title: "Compare the agreement.",
      headers: [
        "Question",
        "On-demand",
        "Card or membership"
      ],
      rows: [
        [
          "Upfront commitment",
          "Usually tied to the agreed trip",
          "May involve deposits, hours or fees"
        ],
        [
          "Aircraft access",
          "Sourced for each itinerary",
          "Depends on notice, area and program rules"
        ],
        [
          "Pricing",
          "Quote for the requested flight",
          "Check fixed rates, exclusions and surcharges"
        ],
        [
          "Unused value",
          "Check cancellation/refund terms",
          "Check expiry, refund and transfer terms"
        ],
        [
          "Peak travel",
          "Availability must be confirmed",
          "Check blackout dates and peak rules"
        ]
      ]
    },
    cardsTitle: "Three ways to fly privately.",
    cards: [
      {
        img: "/images/light/jet-golden-hour.webp",
        title: "On-demand charter",
        body: "A proposal for one itinerary at a time."
      },
      {
        img: "/images/light/twin-engine-jet-golden-hour.webp",
        title: "Jet card",
        body: "Prepaid hours or funds with program rules."
      },
      {
        img: "/images/light/reception-marble-walnut.webp",
        title: "Membership",
        body: "Access fees and availability conditions."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Service area matches likely trips",
      "Notice and peak-date rules understood",
      "All fees and minimums documented",
      "Unused funds and expiry terms reviewed",
      "Aircraft substitution terms reviewed",
      "Exit and renewal conditions understood"
    ],
    faq: [
      {
        q: "Does a membership guarantee an aircraft?",
        a: "Do not assume so. Look for the written availability commitment and all conditions or exclusions."
      },
      {
        q: "Is a quoted hourly rate the total price?",
        a: "Not necessarily. Ask for a worked total including minimums, taxes and applicable charges."
      },
      {
        q: "Can I compare programs without knowing annual hours?",
        a: "Yes. Use a few realistic trip scenarios and assess both the likely cost and the flexibility you need."
      }
    ],
    sources: [
      "nbaa",
      "dot"
    ],
    related: [
      {
        slug: "one-way-vs-round-trip"
      },
      {
        slug: "private-jet-charter-cancellation-policy"
      },
      {
        slug: "how-far-in-advance-to-book-a-private-jet"
      }
    ],
    toolTitle: "Build a program comparison",
    fields: [
      {
        label: "Expected travel pattern",
        placeholder: "Typical routes and frequency"
      },
      {
        label: "Peak-date needs",
        placeholder: "Holidays, events and fixed dates"
      },
      {
        label: "Commitment comfort",
        placeholder: "Trip-by-trip / prepaid / annual fee"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 4,
    slug: "first-private-jet-flight",
    title: "What to Expect on Your First Private Jet Flight",
    short: "Your first private flight",
    metaTitle: "Your First Private Jet Flight: What to Expect",
    description: "Plan your first private jet flight with practical guidance on FBO arrival, boarding, baggage, onboard service and arrival arrangements.",
    eyebrow: "Your first private flight",
    dek: "Plan your first private jet flight with practical guidance on FBO arrival, boarding, baggage, onboard service and arrival arrangements.",
    takeaway: "Use the arrival time and exact FBO address in your confirmed trip instructions. Private aviation does not remove identification or border requirements.",
    primaryCta: "Read the guide",
    hero: "/images/light/golden-hour-boarding.webp",
    inline: "/images/light/reception-marble-walnut.webp",
    band: "/images/light/jet-over-golden-clouds.webp",
    sectionsTitle: "Before leaving home.",
    sectionsSub: "Plan your first private jet flight with practical guidance on FBO arrival, boarding, baggage, onboard service and arrival arrangements.",
    sections: [
      {
        title: "Before leaving home",
        text: "Check the final itinerary, operator contact and any updates. Confirm identification, baggage, catering and ground transport. Save the FBO name and address: an airport can have more than one private terminal.",
        icon: "doc"
      },
      {
        title: "At the FBO",
        text: "Follow the arrival time given for your trip. Staff may coordinate identification checks, baggage and your transfer to the aircraft. Procedures vary by airport, operator and route; ask where to wait and whom to contact if delayed.",
        icon: "pin"
      },
      {
        title: "Boarding and the cabin briefing",
        text: "Wait for staff or crew instructions before approaching the aircraft. Boarding may involve stairs and a narrow doorway. Listen to the safety briefing, follow the crew’s seating and baggage instructions, and keep restraints fastened when directed.",
        icon: "plane"
      },
      {
        title: "During the flight and after landing",
        text: "Confirm catering, Wi-Fi and cabin service in advance because equipment and staffing vary. On arrival, follow crew instructions for disembarking and border processing. Reconfirm the pickup location with your driver, especially after an airport change.",
        icon: "seat"
      }
    ],
    table: {
      title: "Your flight-day sequence.",
      headers: [
        "Stage",
        "Have ready",
        "Confirm with the team"
      ],
      rows: [
        [
          "Before departure",
          "Final itinerary and required ID",
          "FBO address and arrival time"
        ],
        [
          "At the terminal",
          "Passenger and baggage details",
          "Meeting point and any checks"
        ],
        [
          "Boarding",
          "Approved restraints if needed",
          "Assistance and seating plan"
        ],
        [
          "In flight",
          "Essential items in permitted storage",
          "Service and connectivity"
        ],
        [
          "Arrival",
          "Entry documents when required",
          "Customs process and ground transport"
        ]
      ]
    },
    cardsTitle: "Your flight day, step by step.",
    cards: [
      {
        img: "/images/light/arrival-private-terminal.webp",
        title: "Arriving at the terminal",
        body: "Use the exact address in your trip instructions."
      },
      {
        img: "/images/light/boarding-golden-hour.webp",
        title: "Boarding",
        body: "Wait for crew instructions before approaching."
      },
      {
        img: "/images/light/warm-midsize-cabin.webp",
        title: "In the cabin",
        body: "Follow the briefing and seating plan."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Final itinerary saved",
      "FBO address and arrival time confirmed",
      "Required identification ready",
      "Baggage and catering accepted",
      "Boarding needs agreed",
      "Arrival transport and contact saved"
    ],
    faq: [
      {
        q: "How early should I arrive?",
        a: "Follow your operator’s confirmed instructions. Timing depends on the airport, flight and any document or assistance requirements."
      },
      {
        q: "Can I drive directly to the aircraft?",
        a: "Access arrangements vary. Confirm with the FBO and operator; do not assume ramp access."
      },
      {
        q: "Is a cabin attendant always included?",
        a: "No. Confirm staffing, catering and onboard service for the proposed aircraft."
      }
    ],
    sources: [
      "aca",
      "cbp"
    ],
    related: [
      {
        slug: "private-jet-airports-and-fbos"
      },
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "private-jet-travel-with-children"
      }
    ],
    toolTitle: "Prepare my flight-day brief",
    fields: [
      {
        label: "FBO and meeting point",
        placeholder: "Exact terminal name and address"
      },
      {
        label: "Arrival instructions",
        placeholder: "Confirmed time and contact"
      },
      {
        label: "Onboard requests",
        placeholder: "Catering, connectivity or assistance"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 5,
    slug: "private-jet-charter-cancellation-policy",
    title: "Private Jet Charter Cancellation and Refund Policies",
    short: "Cancellation and refunds",
    metaTitle: "Private Jet Cancellation & Refund Policies",
    description: "Understand private jet charter cancellation terms, refund conditions, changes and replacement aircraft questions to check before you book.",
    eyebrow: "Cancellation and refunds",
    dek: "Understand private jet charter cancellation terms, refund conditions, changes and replacement aircraft questions to check before you book.",
    takeaway: "The applicable agreement and law determine your rights. Request clear written terms before payment; this guide does not set JetNine’s policy.",
    primaryCta: "Read the guide",
    hero: "/images/light/notebook-sunset-window.webp",
    inline: "/images/light/chair-at-sunset.webp",
    band: "/images/light/wing-over-sunset-clouds.webp",
    sectionsTitle: "Find the terms that apply to your booking.",
    sectionsSub: "Understand private jet charter cancellation terms, refund conditions, changes and replacement aircraft questions to check before you book.",
    sections: [
      {
        title: "Find the terms that apply to your booking",
        text: "Identify the contracting parties, operating carrier and governing agreement. Distinguish a customer cancellation from an operator cancellation, a timing change and an aircraft substitution. These events may have different consequences.",
        icon: "doc"
      },
      {
        title: "Read every deadline precisely",
        text: "Ask when a cancellation takes effect, which time zone applies and how notice must be delivered. Check staged charges, nonrefundable commitments and any special peak-date or international conditions. Keep evidence that notice was received.",
        icon: "clock"
      },
      {
        title: "Ask how a refund would be handled",
        text: "Clarify what can be refunded, retained or credited, who processes it and the stated timeframe. Check payment method and currency effects. Do not assume that a general airline rule or a card benefit automatically applies to your particular charter.",
        icon: "card"
      },
      {
        title: "Agree the disruption process",
        text: "Ask what happens after weather, maintenance or airport disruption. Can you decline a replacement aircraft, and under what terms? Get the treatment of changed routing, delays, unused legs and extra costs in writing. Seek qualified advice on a disputed contract.",
        icon: "warn"
      }
    ],
    table: {
      title: "Questions to resolve before payment.",
      headers: [
        "Event",
        "Ask about",
        "Keep a record of"
      ],
      rows: [
        [
          "You cancel",
          "Deadline, charge and notice method",
          "Applicable schedule and acknowledgement"
        ],
        [
          "You change the trip",
          "Repricing and new cancellation exposure",
          "Revised itinerary and agreement"
        ],
        [
          "Operator cancels",
          "Refund or replacement process",
          "Written options and your decision"
        ],
        [
          "Aircraft changes",
          "Acceptance rights and price difference",
          "New aircraft and confirmed suitability"
        ],
        [
          "Trip is disrupted",
          "Delay, rerouting and extra costs",
          "Updates and agreed next steps"
        ]
      ]
    },
    cardsTitle: "Three events to plan for.",
    cards: [
      {
        img: "/images/light/ivory-jet-open-stairs-sunset-mountains.webp",
        title: "You cancel",
        body: "Deadline, charge and notice method."
      },
      {
        img: "/images/light/ground-service-golden-hour.webp",
        title: "The operator cancels",
        body: "Refund or replacement process."
      },
      {
        img: "/images/light/jet-beside-glass-terminal.webp",
        title: "The aircraft changes",
        body: "Acceptance rights and price difference."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Contracting parties identified",
      "Deadlines and time zones clear",
      "Refund versus credit terms understood",
      "Notice method recorded",
      "Replacement aircraft terms reviewed",
      "Written confirmation retained"
    ],
    faq: [
      {
        q: "Is every charter refundable within 24 hours?",
        a: "Do not assume that. The charter arrangement, applicable law and contract must be checked."
      },
      {
        q: "Does bad weather always mean a full refund?",
        a: "No universal outcome applies. Ask how the agreement treats weather disruption and unflown legs."
      },
      {
        q: "Does this page describe JetNine’s cancellation policy?",
        a: "No. It is a planning guide. The terms supplied for a specific booking must be reviewed."
      }
    ],
    sources: [
      "dot"
    ],
    related: [
      {
        slug: "one-way-vs-round-trip"
      },
      {
        slug: "on-demand-charter-vs-jet-cards-memberships"
      },
      {
        slug: "last-minute-private-jet"
      }
    ],
    toolTitle: "Review cancellation terms",
    fields: [
      {
        label: "Cancellation deadline",
        placeholder: "Exact date, time and time zone"
      },
      {
        label: "Charges or retained funds",
        placeholder: "Copy the applicable contract wording"
      },
      {
        label: "Open questions",
        placeholder: "Refund method, timing or replacement terms"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 6,
    slug: "how-far-in-advance-to-book-a-private-jet",
    title: "How Far in Advance Should You Book a Private Jet?",
    short: "When to book",
    metaTitle: "How Far Ahead Should You Book a Private Jet?",
    description: "Plan private jet booking lead times around peak dates, aircraft needs and international requirements. Learn what to prepare for an urgent request.",
    eyebrow: "When to book",
    dek: "Plan private jet booking lead times around peak dates, aircraft needs and international requirements. Learn what to prepare for an urgent request.",
    takeaway: "Start once your dates and route are known. There is no universal minimum notice or guaranteed booking window for every charter.",
    primaryCta: "Read the guide",
    hero: "/images/light/jet-beside-glass-terminal.webp",
    inline: "/images/light/notebook-sunset-window.webp",
    band: "/images/light/jet-over-golden-clouds.webp",
    sectionsTitle: "Let the trip’s complexity set the pace.",
    sectionsSub: "Plan private jet booking lead times around peak dates, aircraft needs and international requirements.",
    sections: [
      {
        title: "Let the trip’s complexity set the pace",
        text: "An ordinary domestic request and a multi-country itinerary have different planning needs. Give your team the full route, dates, party size and baggage details early, even if some preferences are still flexible.",
        icon: "clock"
      },
      {
        title: "Start earlier for constrained trips",
        text: "Peak travel dates, major events, specific cabins, large parties and specialist assistance can narrow available options. International permits, border arrangements and pet documentation can also require additional preparation.",
        icon: "calendar"
      },
      {
        title: "Know what is actually secured",
        text: "An enquiry, quote or provisional hold is not the same as a confirmed booking. Ask how long a proposal is valid, what secures the aircraft and which operational arrangements remain pending.",
        icon: "doc"
      },
      {
        title: "If you need to travel soon",
        text: "Send a complete brief and stay reachable for decisions. Offer nearby airports or a flexible departure window where possible. The operator still needs to confirm the aircraft, crew, airports and a safe flight plan.",
        icon: "plane"
      }
    ],
    table: {
      title: "What affects the planning window?",
      headers: [
        "Trip feature",
        "Why it matters",
        "Prepare now"
      ],
      rows: [
        [
          "Peak dates or events",
          "More competition for aircraft and airport access",
          "Dates and alternatives"
        ],
        [
          "Specific cabin or equipment",
          "Smaller set of suitable aircraft",
          "Non-negotiable requirements"
        ],
        [
          "International itinerary",
          "Documents and operational permissions",
          "Nationality and route details securely"
        ],
        [
          "Pets or mobility equipment",
          "Acceptance and handling arrangements",
          "Item specifications and needs"
        ],
        [
          "Urgent departure",
          "Less time to resolve missing details",
          "Complete brief and prompt decisions"
        ]
      ]
    },
    cardsTitle: "What stretches the planning window.",
    cards: [
      {
        img: "/images/light/lounge-golden-hour.webp",
        title: "Peak dates and events",
        body: "More competition for aircraft and airports."
      },
      {
        img: "/images/light/jet-mediterranean-sunset.webp",
        title: "International itinerary",
        body: "Documents and permissions take time."
      },
      {
        img: "/images/light/cockapoo-pet-carrier.webp",
        title: "Pets or equipment",
        body: "Acceptance and handling arrangements."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Route and dates ready",
      "Flexible alternatives identified",
      "All passengers and bags included",
      "Special requirements disclosed",
      "Quote expiry checked",
      "Confirmation and pending items distinguished"
    ],
    faq: [
      {
        q: "Can I book a flight for today?",
        a: "It may be possible, but availability and operational feasibility must be checked for your trip."
      },
      {
        q: "Does booking earlier guarantee a lower price?",
        a: "No. It can allow more planning options, but price depends on the actual aircraft and itinerary."
      },
      {
        q: "When should I start international document checks?",
        a: "As soon as you know the likely destinations. Entry rules and document lead times vary by traveler and route."
      }
    ],
    sources: [
      "aca",
      "state"
    ],
    related: [
      {
        slug: "last-minute-private-jet"
      },
      {
        slug: "international-private-jet-travel"
      },
      {
        slug: "on-demand-charter-vs-jet-cards-memberships"
      }
    ],
    toolTitle: "Build a booking timeline",
    fields: [
      {
        label: "Travel dates and flexibility",
        placeholder: "Fixed dates or acceptable window"
      },
      {
        label: "Potential constraints",
        placeholder: "Event, specific aircraft or airport"
      },
      {
        label: "Outstanding items",
        placeholder: "Documents, assistance or approval decisions"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 7,
    slug: "private-jet-airports-and-fbos",
    title: "Private Jet Airports and FBOs Explained",
    short: "Airports and FBOs",
    metaTitle: "Private Jet Airports & FBOs Explained",
    description: "Understand FBOs and private jet airport selection. Compare ground access, operating hours, customs and boarding arrangements before choosing an airport.",
    eyebrow: "Airports and private terminals",
    dek: "Understand FBOs and private jet airport selection. Compare ground access, operating hours, customs and boarding arrangements before choosing an airport.",
    takeaway: "The closest airport is not always the best fit. Confirm aircraft suitability, operating access and the exact FBO before travel.",
    primaryCta: "Read the guide",
    hero: "/images/light/arrival-private-terminal.webp",
    inline: "/images/light/sunset-lounge-view.webp",
    band: "/images/light/twin-engine-jet-golden-hour.webp",
    sectionsTitle: "What is an FBO?.",
    sectionsSub: "Understand FBOs and private jet airport selection.",
    sections: [
      {
        title: "What is an FBO?",
        text: "A fixed-base operator provides services for general aviation at an airport. Depending on the location, these may include a passenger lounge, handling, fueling and coordination of ground services. An airport can have several FBOs with different entrances.",
        icon: "pin"
      },
      {
        title: "Compare the whole journey",
        text: "Consider your ground travel, airport hours, access restrictions and available services. A shorter drive may be offset by operating limitations. Ask the operator to assess the proposed aircraft against runway and airport requirements.",
        icon: "route"
      },
      {
        title: "International arrivals need a border plan",
        text: "Private terminals do not bypass customs or immigration. Ask where processing will occur, who coordinates it and whether the airport and timing suit the itinerary. For U.S. arrivals, use the operator’s confirmed CBP arrangements.",
        icon: "passport"
      },
      {
        title: "Check the details that matter on the day",
        text: "Save the exact terminal address, local arrival time and a contact number. Confirm parking, driver pickup, boarding assistance and any equipment. If the destination airport changes, recheck transport and border arrangements.",
        icon: "doc"
      }
    ],
    table: {
      title: "Compare airport options.",
      headers: [
        "Factor",
        "Ask",
        "Why it helps"
      ],
      rows: [
        [
          "Ground journey",
          "Realistic transfer time at your arrival hour?",
          "A practical door-to-door comparison"
        ],
        [
          "Operating access",
          "Hours, slots or prior permission needed?",
          "Avoid timing assumptions"
        ],
        [
          "Aircraft suitability",
          "Can the proposed aircraft operate safely?",
          "Operator-specific assessment"
        ],
        [
          "Border processing",
          "Where and when is clearance arranged?",
          "Correct international arrival plan"
        ],
        [
          "Passenger services",
          "Assistance, lounge and pickup location?",
          "A usable airport experience"
        ]
      ]
    },
    cardsTitle: "Compare the whole journey.",
    cards: [
      {
        img: "/images/light/black-suv-glass-terminal.webp",
        title: "Ground journey",
        body: "Compare realistic door-to-door time."
      },
      {
        img: "/images/light/chauffeur-sedan.webp",
        title: "Pickup and parking",
        body: "Confirm the meeting point with your driver."
      },
      {
        img: "/images/light/ground-service-golden-hour.webp",
        title: "Operating access",
        body: "Hours, slots and permissions vary."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Aircraft suitability confirmed",
      "Operating hours and access checked",
      "FBO name and address saved",
      "Border processing arranged if required",
      "Boarding assistance agreed",
      "Ground transport meeting point confirmed"
    ],
    faq: [
      {
        q: "Are an airport and an FBO the same thing?",
        a: "No. The airport is the wider facility; an FBO is a service provider or terminal at that airport."
      },
      {
        q: "Can every private airport accept international arrivals?",
        a: "No. Border-processing capability and arrangements must be checked for the route and arrival time."
      },
      {
        q: "Will the FBO have a boarding lift?",
        a: "Do not assume so. Confirm compatible equipment and trained assistance at both ends of the trip."
      }
    ],
    sources: [
      "aca",
      "cbp"
    ],
    related: [
      {
        slug: "first-private-jet-flight"
      },
      {
        slug: "international-private-jet-travel"
      },
      {
        slug: "private-jet-accessibility"
      }
    ],
    toolTitle: "Compare airport options",
    fields: [
      {
        label: "Preferred airport and FBO",
        placeholder: "Name, airport code and terminal"
      },
      {
        label: "Alternative airport",
        placeholder: "Ground travel and timing trade-off"
      },
      {
        label: "Services to confirm",
        placeholder: "Customs, parking, assistance or pickup"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 8,
    slug: "private-jet-baggage-limits",
    title: "Private Jet Baggage Limits",
    short: "Baggage planning",
    metaTitle: "Private Jet Baggage Limits & Oversized Items",
    description: "Plan private jet baggage using item dimensions, weight and loading access. Check suitcases, golf bags, skis, strollers and mobility equipment.",
    eyebrow: "Pack for the actual aircraft",
    dek: "Plan private jet baggage using item dimensions, weight and loading access. Check suitcases, golf bags, skis, strollers and mobility equipment.",
    takeaway: "There is no single baggage allowance for every private jet. Confirm each item against the actual aircraft, payload and loading access.",
    primaryCta: "Check what affects fit",
    hero: "/images/light/luggage-by-jet.webp",
    inline: "/images/light/golf-travel-case-by-private-jet.webp",
    band: "/images/light/wing-over-sunset-clouds.webp",
    sectionsTitle: "Measure items, not just suitcase count.",
    sectionsSub: "Plan private jet baggage using item dimensions, weight and loading access.",
    sections: [
      {
        title: "Measure items, not just suitcase count",
        text: "List length, width, height and weight for each bag, including handles and wheels. Note rigid cases and items that cannot be compressed. A baggage-volume figure alone does not show whether an object can pass through the loading door.",
        icon: "bag"
      },
      {
        title: "Account for the complete payload",
        text: "Travelers, baggage, equipment and fuel all affect the flight plan. The operator may need to balance loading and range for your route. Ask before booking whether an item changes the aircraft choice or fuel-stop plan.",
        icon: "door"
      },
      {
        title: "Flag unusual or essential equipment early",
        text: "Golf bags, skis, musical instruments, strollers and mobility devices need individual checks. Provide specifications and handling instructions. Batteries and other restricted goods require the operator’s dangerous-goods review.",
        icon: "scale"
      },
      {
        title: "Confirm where things will be stored",
        text: "Ask which compartments are available and whether they are accessible in flight. Keep essential items in operator-approved cabin storage. If an aircraft is substituted, reconfirm baggage fit instead of relying on the original acceptance.",
        icon: "plane"
      }
    ],
    table: {
      title: "A useful baggage list.",
      headers: [
        "Item",
        "Information to send",
        "Ask the operator"
      ],
      rows: [
        [
          "Suitcases",
          "Count, external dimensions and weight",
          "Hold and loading-door fit"
        ],
        [
          "Golf bags / skis",
          "Longest dimension and case type",
          "Permitted orientation and loading"
        ],
        [
          "Stroller / child seat",
          "Folded dimensions and weight",
          "Cabin use versus baggage storage"
        ],
        [
          "Mobility device",
          "Dimensions, mass and battery details",
          "Acceptance and handling plan"
        ],
        [
          "Fragile equipment",
          "Case dimensions and restrictions",
          "Secure storage and access"
        ]
      ]
    },
    cardsTitle: "Pack with the flight in mind.",
    cards: [
      {
        img: "/images/light/leather-duffel-on-seat.webp",
        title: "Choose practical bags",
        body: "Soft-sided bags may be easier to arrange, but dimensions and weight still matter."
      },
      {
        img: "/images/light/tan-handbag-jet-window.webp",
        title: "Keep essentials accessible",
        body: "Ask where documents, medication and valuables can be safely stowed."
      },
      {
        img: "/images/light/sunlit-cabin-silver-suitcase.webp",
        title: "Leave stowage to the crew",
        body: "Do not assume spare seats can hold luggage."
      }
    ],
    checklistTitle: "Get baggage acceptance in writing.",
    checklist: [
      "Every item measured",
      "Weight recorded in stated units",
      "Oversized and fragile items listed",
      "Battery details supplied if relevant",
      "Loading and storage confirmed",
      "Substitution recheck requested"
    ],
    faq: [
      {
        q: "Can I use a standard airline baggage allowance?",
        a: "No. Ask for acceptance on the particular aircraft and itinerary."
      },
      {
        q: "Do soft bags always solve a fit problem?",
        a: "They may be easier to arrange, but total size, weight and loading access still matter."
      },
      {
        q: "Can I access my suitcase during flight?",
        a: "It depends on the aircraft and compartment. Confirm before placing essential items in a hold."
      }
    ],
    sources: [
      "mobility",
      "range"
    ],
    related: [
      {
        slug: "how-to-choose-the-right-private-jet"
      },
      {
        slug: "private-jet-range-and-fuel-stops"
      },
      {
        slug: "private-jet-accessibility"
      }
    ],
    toolTitle: "Build my baggage list",
    fields: [
      {
        label: "Item description and count",
        placeholder: "Two rigid cases, one golf bag"
      },
      {
        label: "External dimensions and units",
        placeholder: "Length × width × height, cm or inches"
      },
      {
        label: "Total weight and special handling",
        placeholder: "kg or lb; battery or fragile item details"
      }
    ],
    bandTitle: "The right aircraft starts with the full packing list."
  },
  {
    id: 9,
    slug: "international-private-jet-travel",
    title: "International Private Jet Travel Guide",
    short: "International travel",
    metaTitle: "International Private Jet Travel Guide",
    description: "Prepare for international private jet travel with passport, visa, customs and immigration checks, airport planning and clear operator coordination.",
    eyebrow: "International travel",
    dek: "Prepare for international private jet travel with passport, visa, customs and immigration checks, airport planning and clear operator coordination.",
    takeaway: "Private aviation still requires border compliance. Check each traveler’s nationality, itinerary and documents against current destination rules.",
    primaryCta: "Read the guide",
    hero: "/images/light/jet-mediterranean-sunset.webp",
    inline: "/images/light/arrival-private-terminal.webp",
    band: "/images/light/jet-over-golden-clouds.webp",
    sectionsTitle: "Start with the full itinerary.",
    sectionsSub: "Prepare for international private jet travel with passport, visa, customs and immigration checks, airport planning and clear operator coordination.",
    sections: [
      {
        title: "Start with the full itinerary",
        text: "Include every destination, transit stop and return leg. Share passenger information through the agreed secure channel. A fuel stop or route change may create additional checks, so ask the operator how these will be handled.",
        icon: "route"
      },
      {
        title: "Verify documents for every traveler",
        text: "Check passport validity, visa or travel authorization requirements and any rules for minors. Requirements vary; there is no universal passport-validity rule for every destination. Consult the destination authorities and relevant consulate for your circumstances.",
        icon: "passport"
      },
      {
        title: "Confirm the border-processing plan",
        text: "Ask which airports will handle customs and immigration, what arrival timing applies and whether additional permissions are needed. The operator coordinates flight filings and operational arrangements; travelers must supply accurate information and required documents.",
        icon: "pin"
      },
      {
        title: "Plan for the return as carefully as the outbound",
        text: "Check onward and return entry requirements, declarations, pet documents and ground transport. Reconfirm the itinerary before departure. If the route changes, ask whether documents or border arrangements need to change too.",
        icon: "doc"
      }
    ],
    table: {
      title: "Who should confirm what?",
      headers: [
        "Topic",
        "Traveler preparation",
        "Ask the charter team"
      ],
      rows: [
        [
          "Identity and entry",
          "Valid documents and accurate details",
          "Secure submission process"
        ],
        [
          "Children",
          "Passports and applicable consent documents",
          "Any route-specific checks"
        ],
        [
          "Customs and immigration",
          "Declarations and personal entry requirements",
          "Airport, timing and clearance plan"
        ],
        [
          "Pets",
          "Current destination and return requirements",
          "Operator acceptance and cabin plan"
        ],
        [
          "Flight operations",
          "Provide complete itinerary",
          "Permits, filings and operating feasibility"
        ]
      ]
    },
    cardsTitle: "Who should confirm what.",
    cards: [
      {
        img: "/images/light/notebook-sunset-window.webp",
        title: "Documents for every traveler",
        body: "Passport, visa and rules for minors."
      },
      {
        img: "/images/light/reception-marble-walnut.webp",
        title: "Border processing",
        body: "Which airport and when clearance happens."
      },
      {
        img: "/images/light/cockapoo-pet-carrier.webp",
        title: "Pets and children",
        body: "Separate requirements and timelines."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "All legs and transit stops reviewed",
      "Passport and entry rules checked",
      "Child documents checked if relevant",
      "Customs and arrival airport confirmed",
      "Pet requirements checked if relevant",
      "Secure document handoff arranged"
    ],
    faq: [
      {
        q: "Does flying privately remove passport checks?",
        a: "No. Border and entry requirements still apply."
      },
      {
        q: "Is six months of passport validity always required?",
        a: "No single rule covers all destinations and travelers. Check the exact rules for your nationality and route."
      },
      {
        q: "Can I arrive at any airport?",
        a: "No. The airport, timing and required border arrangements must be confirmed for the trip."
      }
    ],
    sources: [
      "state",
      "cbp"
    ],
    related: [
      {
        slug: "private-jet-airports-and-fbos"
      },
      {
        slug: "private-jet-travel-with-pets"
      },
      {
        slug: "private-jet-travel-with-children"
      }
    ],
    toolTitle: "Prepare document questions",
    fields: [
      {
        label: "Countries and transit stops",
        placeholder: "Full outbound and return itinerary"
      },
      {
        label: "Checks still outstanding",
        placeholder: "Passport validity, visa or consent questions"
      },
      {
        label: "Border arrangements to confirm",
        placeholder: "Arrival airport, timing and contact — no document numbers"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 10,
    slug: "private-jet-range-and-fuel-stops",
    title: "Private Jet Range and Fuel Stops Explained",
    short: "Range and fuel stops",
    metaTitle: "Private Jet Range & Fuel Stops Explained",
    description: "Understand private jet range, payload and fuel stops. Learn why published range differs from route-specific nonstop feasibility and what to ask.",
    eyebrow: "Range and fuel stops",
    dek: "Understand private jet range, payload and fuel stops. Learn why published range differs from route-specific nonstop feasibility and what to ask.",
    takeaway: "Published range is a planning reference. Only the operator’s assessment can establish a practical flight plan for your trip.",
    primaryCta: "Read the guide",
    hero: "/images/light/jet-over-golden-clouds.webp",
    inline: "/images/light/wing-over-sunset-clouds.webp",
    band: "/images/light/jet-golden-hour.webp",
    sectionsTitle: "Range figures have assumptions.",
    sectionsSub: "Understand private jet range, payload and fuel stops.",
    sections: [
      {
        title: "Range figures have assumptions",
        text: "Manufacturer specifications use stated conditions, payload and operating assumptions. Your flight may differ. Ask how the advertised range relates to your actual passenger count, bags, route and preferred aircraft.",
        icon: "fuel"
      },
      {
        title: "The route is more than a straight line",
        text: "Winds, air traffic routing, weather and airport conditions can change fuel requirements. Required reserves and alternate-airport planning also matter. Avoid treating an online distance or range circle as an operational approval.",
        icon: "wind"
      },
      {
        title: "Understand the payload trade-off",
        text: "More passengers and baggage can affect fuel and performance options. Airport conditions may also limit the plan. The operator should explain whether the proposed aircraft can carry the full party and bags with the intended routing.",
        icon: "scale"
      },
      {
        title: "Compare the complete travel time",
        text: "A larger aircraft may offer a different nonstop option, but price and cabin needs still matter. For a planned stop, ask about the likely airport, passenger procedures, border implications and revised arrival time. Operational conditions can change the final plan.",
        icon: "clock"
      }
    ],
    table: {
      title: "What can change a nonstop plan?",
      headers: [
        "Factor",
        "Possible effect",
        "Question to ask"
      ],
      rows: [
        [
          "Payload",
          "Different fuel or performance options",
          "Is the assessment based on our full party and bags?"
        ],
        [
          "Wind and weather",
          "More fuel or a route change",
          "What could trigger a fuel stop?"
        ],
        [
          "Airport conditions",
          "Performance limits",
          "Are both airports suitable for this aircraft?"
        ],
        [
          "Routing and reserves",
          "More than direct distance",
          "What assumptions are included?"
        ],
        [
          "Fuel stop",
          "Longer elapsed journey",
          "Where, how long and what procedures?"
        ]
      ]
    },
    cardsTitle: "What can change a nonstop plan.",
    cards: [
      {
        img: "/images/light/luggage-by-jet.webp",
        title: "Payload",
        body: "Passengers and bags change fuel options."
      },
      {
        img: "/images/light/twin-engine-jet-golden-hour.webp",
        title: "Wind and weather",
        body: "More fuel or a changed route."
      },
      {
        img: "/images/light/ground-service-golden-hour.webp",
        title: "A planned stop",
        body: "Where, how long and what procedures."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Assessment uses actual travelers and bags",
      "Published assumptions distinguished from trip plan",
      "Nonstop feasibility discussed",
      "Fuel-stop alternative explained",
      "Arrival-time impact understood",
      "Border implications checked"
    ],
    faq: [
      {
        q: "Does a range map prove the flight can be nonstop?",
        a: "No. It is an illustration unless backed by an operator’s route-specific assessment."
      },
      {
        q: "Can a nonstop flight become a one-stop flight?",
        a: "Yes. Operational conditions may require a revised plan. Ask how updates and added costs are handled."
      },
      {
        q: "Must passengers leave the aircraft during a fuel stop?",
        a: "Procedures depend on the airport, operator and local requirements. Confirm the expected plan."
      }
    ],
    sources: [
      "range"
    ],
    related: [
      {
        slug: "how-to-choose-the-right-private-jet"
      },
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "international-private-jet-travel"
      }
    ],
    toolTitle: "Compare nonstop and stop options",
    fields: [
      {
        label: "Full payload brief",
        placeholder: "Passengers, bags and equipment"
      },
      {
        label: "Preferred outcome",
        placeholder: "Nonstop priority or acceptable stop"
      },
      {
        label: "Operator questions",
        placeholder: "Stop location, time, procedures and cost"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 11,
    slug: "private-jet-travel-with-pets",
    title: "Flying With Pets on a Private Jet",
    short: "Travel with pets",
    metaTitle: "Flying With Pets on a Private Jet",
    description: "Plan private jet travel with pets. Check operator acceptance, cabin arrangements, veterinary documents and destination and return entry requirements.",
    eyebrow: "Pet travel & planning",
    dek: "Plan private jet travel with pets. Check operator acceptance, cabin arrangements, veterinary documents and destination and return entry requirements.",
    takeaway: "Confirm both operator acceptance and entry requirements. Approval to board an aircraft does not establish permission to enter a country.",
    primaryCta: "Read the guide",
    hero: "/images/light/cockapoo-pet-carrier.webp",
    inline: "/images/light/black-suv-glass-terminal.webp",
    band: "/images/light/jet-mediterranean-sunset.webp",
    sectionsTitle: "Get acceptance for your pet and aircraft.",
    sectionsSub: "Plan private jet travel with pets.",
    sections: [
      {
        title: "Get acceptance for your pet and aircraft",
        text: "Share species, breed where requested, size, weight and number of animals. Ask about carrier or restraint arrangements, cabin restrictions, cleaning charges and how an aircraft substitution would affect acceptance. Discuss service animals through the applicable assistance process.",
        icon: "paw"
      },
      {
        title: "Make a practical cabin plan",
        text: "Agree where the animal will travel and how it will be secured during each phase of flight. Plan water, comfort items and airport relief opportunities with the team. Ask your veterinarian about fitness to travel and any individual health concerns.",
        icon: "seat"
      },
      {
        title: "Start international health checks early",
        text: "USDA APHIS advises U.S. travelers to involve an accredited veterinarian early. Destination rules may involve microchips, vaccinations, tests, treatments and health certificates in a specified order. Verify current requirements for every country and any return journey.",
        icon: "passport"
      },
      {
        title: "Recheck the return journey",
        text: "For dogs entering the U.S., consult current CDC guidance using the dog’s travel history and vaccination circumstances. Other animal-health and local requirements may also apply. Keep approved documents available and confirm where border checks will occur.",
        icon: "passport"
      }
    ],
    table: {
      title: "Two separate approvals.",
      headers: [
        "Check",
        "Who helps confirm it",
        "Prepare"
      ],
      rows: [
        [
          "Aircraft acceptance",
          "Operating carrier",
          "Species, size, weight and carrier details"
        ],
        [
          "Cabin arrangements",
          "Operating carrier",
          "Restraint and cleaning questions"
        ],
        [
          "Health documentation",
          "Accredited veterinarian and authorities",
          "Country-specific requirements and dates"
        ],
        [
          "Destination entry",
          "Destination authority",
          "Required permits or certificates"
        ],
        [
          "Return entry",
          "Relevant border and animal-health authorities",
          "Travel history and updated documents"
        ]
      ]
    },
    cardsTitle: "Agree the cabin arrangements.",
    cards: [
      {
        img: "/images/light/cockapoo-pet-carrier.webp",
        title: "Space & secure placement",
        body: "Share carrier dimensions and ask how your pet is secured."
      },
      {
        img: "/images/light/warm-midsize-cabin.webp",
        title: "Comfort & supplies",
        body: "Plan water, liners and familiar bedding."
      },
      {
        img: "/images/light/chauffeur-sedan.webp",
        title: "Airport & ground plans",
        body: "Confirm relief opportunities and pet-friendly transfers."
      }
    ],
    checklistTitle: "Your before-travel checklist.",
    checklist: [
      "Pet accepted for proposed aircraft",
      "Carrier or restraint arrangement agreed",
      "Applicable fees understood",
      "Veterinary timeline reviewed",
      "Destination and return rules checked",
      "Documents and airport plan ready"
    ],
    faq: [
      {
        q: "Can my pet sit anywhere in the cabin?",
        a: "Follow the operator’s agreed seating, carrier and restraint arrangements. Cabin freedom is not automatic."
      },
      {
        q: "Are the rules the same for every country?",
        a: "No. Requirements and timelines vary by destination, animal and travel history."
      },
      {
        q: "Can I use the outbound paperwork for the return?",
        a: "Do not assume so. Check the return country’s requirements and document validity separately."
      }
    ],
    sources: [
      "aphis",
      "cdc"
    ],
    related: [
      {
        slug: "international-private-jet-travel"
      },
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "how-far-in-advance-to-book-a-private-jet"
      }
    ],
    toolTitle: "Build my pet travel brief",
    fields: [
      {
        label: "Pet and carrier details",
        placeholder: "Species, count, weight and carrier dimensions"
      },
      {
        label: "Countries and travel history",
        placeholder: "Destination, transit and return questions"
      },
      {
        label: "Arrangements to confirm",
        placeholder: "Restraint, cleaning, relief and document timeline"
      }
    ],
    bandTitle: "Plan the journey for every member of the family."
  },
  {
    id: 12,
    slug: "private-jet-travel-with-children",
    title: "Flying With Children and Infants on a Private Jet",
    short: "Family travel",
    metaTitle: "Private Jet Travel With Children & Infants",
    description: "Plan a private jet flight with children and infants. Confirm seating, approved restraints, baggage, family needs and international travel documents.",
    eyebrow: "Family travel",
    dek: "Plan a private jet flight with children and infants. Confirm seating, approved restraints, baggage, family needs and international travel documents.",
    takeaway: "Confirm the actual seat and restraint combination before booking. A spacious cabin does not establish that a child restraint fits safely.",
    primaryCta: "Read the guide",
    hero: "/images/light/family-watches-jet.webp",
    inline: "/images/light/ivory-seat-lap-belt.webp",
    band: "/images/light/wing-over-sunset-clouds.webp",
    sectionsTitle: "Include every child in the trip brief.",
    sectionsSub: "Plan a private jet flight with children and infants.",
    sections: [
      {
        title: "Include every child in the trip brief",
        text: "Tell the charter team the number and ages of children, and the seating and support you need. Discuss the actual cabin plan before accepting an aircraft. Plan adjacent adult seating and check whether a substitution would change the arrangement.",
        icon: "people"
      },
      {
        title: "Confirm an approved restraint and compatible seat",
        text: "The FAA recommends an approved child restraint in the child’s own seat, including for children under two. Check device approval, child size limits, aircraft-seat compatibility and installation instructions with the operator. A carrier or ordinary booster is not a substitute for an approved flight restraint.",
        icon: "seat"
      },
      {
        title: "Plan the practical parts of family travel",
        text: "Confirm stroller dimensions, baggage space, food, allergies and changing arrangements. Ask what can be kept within reach in approved storage. Allow time for boarding and installing a restraint without rushing; follow the crew’s instructions throughout the flight.",
        icon: "bag"
      },
      {
        title: "Check documents for international journeys",
        text: "Each child’s required passport and entry documents should be checked for the route. Consent or custody documents may be required in some circumstances. Confirm destination and transit requirements rather than relying on a single universal consent-letter rule.",
        icon: "passport"
      }
    ],
    table: {
      title: "Family planning questions.",
      headers: [
        "Topic",
        "Send or ask",
        "Get confirmed"
      ],
      rows: [
        [
          "Seat and restraint",
          "Child size and device model",
          "Approval, fit and installation"
        ],
        [
          "Seating together",
          "Adult and child seating needs",
          "Actual cabin arrangement"
        ],
        [
          "Stroller and bags",
          "Folded sizes and weights",
          "Loading and storage"
        ],
        [
          "Food and comfort",
          "Meals, allergies and essential items",
          "What can be provided"
        ],
        [
          "International travel",
          "Route and document questions",
          "Applicable child-entry requirements"
        ]
      ]
    },
    cardsTitle: "Plan the practical parts.",
    cards: [
      {
        img: "/images/light/ivory-seat-lap-belt.webp",
        title: "Seat and restraint",
        body: "Approval, fit and installation."
      },
      {
        img: "/images/light/carry-ons-beside-jet.webp",
        title: "Stroller and bags",
        body: "Folded sizes, weights and storage."
      },
      {
        img: "/images/light/cabin-golden-hour.webp",
        title: "Food and comfort",
        body: "Meals, allergies and essential items."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Every child included in passenger count",
      "Restraint approval and sizing checked",
      "Aircraft seat compatibility confirmed",
      "Stroller and baggage accepted",
      "Food and comfort needs discussed",
      "Required child travel documents ready"
    ],
    faq: [
      {
        q: "Does a private jet remove the need for child restraints?",
        a: "No. Confirm applicable rules and the safest suitable restraint arrangement with the operating carrier."
      },
      {
        q: "Can I use any car seat?",
        a: "No. Verify aircraft-use approval, the manufacturer’s limits and fit on the proposed seat."
      },
      {
        q: "Are beds or bassinets usable during takeoff?",
        a: "Do not assume so. Use the seating and restraint arrangement approved by the operator for that phase of flight."
      }
    ],
    sources: [
      "kids",
      "minors"
    ],
    related: [
      {
        slug: "first-private-jet-flight"
      },
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "international-private-jet-travel"
      }
    ],
    toolTitle: "Plan seats and restraints",
    fields: [
      {
        label: "Children and seating needs",
        placeholder: "Ages and seating requirements; no full names"
      },
      {
        label: "Restraint details",
        placeholder: "Make, model, approval label and dimensions"
      },
      {
        label: "Family travel requests",
        placeholder: "Stroller, meals, boarding time or support"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 13,
    slug: "private-jet-accessibility",
    title: "Private Jet Accessibility and Mobility Assistance",
    short: "Accessibility and assistance",
    metaTitle: "Private Jet Accessibility & Mobility Assistance",
    description: "Confirm private jet boarding access, cabin fit, mobility equipment and assistance. Build a practical checklist for both departure and arrival airports.",
    eyebrow: "Accessibility and assistance",
    dek: "Confirm private jet boarding access, cabin fit, mobility equipment and assistance. Build a practical checklist for both departure and arrival airports.",
    takeaway: "Confirm the complete journey: ground access, boarding, seat transfer, cabin movement and arrival. Aircraft size alone does not prove accessibility.",
    primaryCta: "Read the guide",
    hero: "/images/light/lounge-conversation-wheelchair.webp",
    inline: "/images/light/arrival-private-terminal.webp",
    band: "/images/light/jet-golden-hour.webp",
    sectionsTitle: "Describe the assistance that would help.",
    sectionsSub: "Confirm private jet boarding access, cabin fit, mobility equipment and assistance.",
    sections: [
      {
        title: "Describe the assistance that would help",
        text: "Share functional needs and preferences with the team: steps, transfers, walking distances, seating support and equipment. You do not need to put diagnoses or medical records in an initial planning form. Ask who will coordinate the arrangements.",
        icon: "people"
      },
      {
        title: "Check the actual aircraft and both airports",
        text: "Request door, stair, aisle and seat details, along with photos or a cabin plan. Confirm compatible boarding equipment and trained staff at departure and arrival. Ask what happens if the aircraft or airport changes.",
        icon: "plane"
      },
      {
        title: "Make an equipment handling plan",
        text: "Provide mobility-device dimensions, weight, battery type and manufacturer handling instructions. Battery requirements depend on the device and battery design; follow the operator’s confirmed acceptance process. Agree on storage, return of equipment and protection from damage.",
        icon: "wheel"
      },
      {
        title: "Clarify assistance and personal care",
        text: "Discuss transfers, cabin movement and lavatory access in practical terms. Ask which services can be provided and whether a companion or specialist arrangement is needed. Consult the relevant passenger-rights authority for your flight; applicability can depend on the service and jurisdiction.",
        icon: "doc"
      }
    ],
    table: {
      title: "Check the journey end to end.",
      headers: [
        "Stage",
        "Details to confirm",
        "Responsible contact"
      ],
      rows: [
        [
          "At the terminal",
          "Step-free entry and accessible transport",
          "FBO or ground provider"
        ],
        [
          "Boarding",
          "Stairs, lift compatibility and trained help",
          "Operator and FBO"
        ],
        [
          "Seat transfer",
          "Method, equipment and seating support",
          "Operator"
        ],
        [
          "In the cabin",
          "Aisle, lavatory and movement needs",
          "Operator"
        ],
        [
          "Arrival",
          "Assistance and equipment handover",
          "Arrival team"
        ]
      ]
    },
    cardsTitle: "Check the journey end to end.",
    cards: [
      {
        img: "/images/light/black-suv-glass-terminal.webp",
        title: "At the terminal",
        body: "Step-free entry and accessible transport."
      },
      {
        img: "/images/light/golden-hour-boarding.webp",
        title: "Boarding",
        body: "Stairs, lift compatibility and trained help."
      },
      {
        img: "/images/light/chair-at-sunset.webp",
        title: "Seat transfer and cabin",
        body: "Method, equipment and seating support."
      }
    ],
    checklistTitle: "Before you book.",
    checklist: [
      "Functional needs discussed",
      "Actual aircraft dimensions reviewed",
      "Boarding plan confirmed at both ends",
      "Device and battery accepted",
      "Assistance responsibilities clear",
      "Substitution and disruption plan agreed"
    ],
    faq: [
      {
        q: "Are all large private jets wheelchair accessible?",
        a: "No. Boarding access, aisles, seat transfers and lavatories vary. Assess the specific aircraft and airport arrangements."
      },
      {
        q: "Is one battery limit valid for every mobility device?",
        a: "No. Requirements vary by battery type and how it is protected or installed. Confirm with the operator using the device specifications."
      },
      {
        q: "Should I send medical records in the trip brief?",
        a: "Use functional requirements for initial planning. If additional sensitive information is necessary, agree a secure and appropriate channel."
      }
    ],
    sources: [
      "mobility",
      "access",
      "caa"
    ],
    related: [
      {
        slug: "private-jet-airports-and-fbos"
      },
      {
        slug: "private-jet-baggage-limits"
      },
      {
        slug: "how-to-choose-the-right-private-jet"
      }
    ],
    toolTitle: "Build an assistance brief",
    fields: [
      {
        label: "Assistance preferences",
        placeholder: "Steps, transfers or walking distances"
      },
      {
        label: "Equipment details",
        placeholder: "Device dimensions, weight and battery type"
      },
      {
        label: "Arrangements to confirm",
        placeholder: "Boarding, seating, lavatory and arrival support"
      }
    ],
    bandTitle: "Plan the trip with someone who will answer every question."
  },
  {
    id: 14,
    slug: "last-minute-private-jet",
    title: "Last-Minute Private Jet Charter",
    short: "Urgent travel planning",
    metaTitle: "Last-Minute Private Jet Charter: What to Know",
    description: "Prepare an urgent private jet request with the right route, timing, documents and baggage details. Understand availability and practical departure limits.",
    eyebrow: "Urgent travel planning",
    dek: "Prepare an urgent private jet request with the right route, timing, documents and baggage details. Understand availability and practical departure limits.",
    takeaway: "Same-day charter may be possible, but there is no universal minimum notice. An enquiry or payment alone does not confirm departure.",
    primaryCta: "Read the guide",
    hero: "/images/light/twin-engine-jet-golden-hour.webp",
    inline: "/images/light/ground-service-golden-hour.webp",
    band: "/images/light/jet-over-golden-clouds.webp",
    sectionsTitle: "Send a complete trip brief.",
    sectionsSub: "Prepare an urgent private jet request with the right route, timing, documents and baggage details.",
    sections: [
      {
        title: "Send a complete trip brief",
        text: "Provide exact airports, departure date, earliest local departure time and any arrival deadline with its time zone. Include every passenger, baggage dimensions and special needs. Say whether nearby airports or a different departure time could work.",
        icon: "doc"
      },
      {
        title: "Understand what can limit departure",
        text: "A suitable aircraft and crew must be available. Airport access, operating hours, weather, permits, border arrangements and the flight plan may affect timing. Urgency does not remove these checks or the operator’s safety responsibilities.",
        icon: "warn"
      },
      {
        title: "Separate a quote from a confirmed booking",
        text: "Ask how long the offer is valid and what secures the booking. Confirm the operating carrier, proposed aircraft, complete price, payment instructions and change terms. Ask specifically what is confirmed and what is still pending.",
        icon: "card"
      },
      {
        title: "Leave for the airport with a clear plan",
        text: "Obtain written travel instructions, the exact FBO address and your arrival time. Keep a contact available for updates. Have required identification ready and confirm baggage acceptance, ground transport and the response if plans change.",
        icon: "pin"
      }
    ],
    table: {
      title: "The stages of an urgent booking.",
      headers: [
        "Stage",
        "What it means",
        "What to check"
      ],
      rows: [
        [
          "Request",
          "Your trip is being assessed",
          "Complete route, timing and needs"
        ],
        [
          "Proposal",
          "An option has been offered",
          "Aircraft, price and expiry"
        ],
        [
          "Acceptance",
          "Booking steps are being completed",
          "Contract, payment and pending conditions"
        ],
        [
          "Confirmation",
          "Written arrangements are supplied",
          "Operator, itinerary and instructions"
        ],
        [
          "Departure preparation",
          "Operational checks continue",
          "Latest updates and crew directions"
        ]
      ]
    },
    cardsTitle: "Three things to have ready.",
    cards: [
      {
        img: "/images/light/notebook-sunset-window.webp",
        title: "Send a complete brief",
        body: "Exact airports, times and every passenger."
      },
      {
        img: "/images/light/carry-ons-beside-jet.webp",
        title: "Have documents and bags ready",
        body: "Identification and accepted baggage."
      },
      {
        img: "/images/light/black-suv-glass-terminal.webp",
        title: "Leave with a clear plan",
        body: "Written instructions and the terminal address."
      }
    ],
    checklistTitle: "Before you leave for the airport.",
    checklist: [
      "Booking and operating carrier confirmed",
      "FBO address and arrival time received",
      "Passenger documents ready",
      "Baggage and special needs accepted",
      "Total price and terms reviewed",
      "Contact and change plan saved"
    ],
    faq: [
      {
        q: "How quickly can a private jet depart?",
        a: "It depends on suitable aircraft, crew, airports, documents and operational conditions. Ask for the earliest feasible plan for your trip."
      },
      {
        q: "Can I arrange international travel at short notice?",
        a: "Sometimes, but entry documents, permissions and border-processing arrangements can restrict what is feasible."
      },
      {
        q: "Does paying immediately guarantee departure?",
        a: "No. Obtain written booking confirmation and ask which operational arrangements remain pending."
      },
      {
        q: "Are empty legs suitable for an urgent trip?",
        a: "Only if their limitations fit your needs. Confirm timing reliability, cancellation terms and whether a replacement is available."
      }
    ],
    sources: [
      "faa",
      "aca",
      "cbp"
    ],
    related: [
      {
        slug: "how-far-in-advance-to-book-a-private-jet"
      },
      {
        slug: "private-jet-charter-cancellation-policy"
      },
      {
        slug: "international-private-jet-travel"
      }
    ],
    toolTitle: "Review quote and booking terms",
    fields: [
      {
        label: "Operator and aircraft",
        placeholder: "Named operating carrier and proposed aircraft"
      },
      {
        label: "Price and booking conditions",
        placeholder: "Total, quote expiry and payment instructions"
      },
      {
        label: "Pending arrangements",
        placeholder: "What remains subject to confirmation?"
      }
    ],
    bandTitle: "Ready to move? Send the brief now."
  },
  {
    id: 15,
    slug: "private-jet-disruptions-and-replacements",
    title: "Weather Delays, Mechanical Issues, and Replacement Aircraft",
    short: "Private Jet Delays & Replacement Aircraft",
    metaTitle: "Private Jet Delays & Replacement Aircraft",
    description: "Understand private jet weather delays, mechanical issues and replacement aircraft. Check recovery options, extra costs and revised arrangements first.",
    eyebrow: "Disruption & recovery",
    dek: "Understand private jet weather delays, mechanical issues and replacement aircraft. Check recovery options, extra costs and revised arrangements before accepting.",
    takeaway: "Safety and aircraft availability determine recovery options. A replacement aircraft or departure time is not guaranteed.",
    primaryCta: "Review recovery options",
    hero: "/images/light/six-01-jet-at-fbo.webp",
    inline: "/images/light/six-02-maintenance-hangar.webp",
    band: "/images/light/six-21-jet-at-dusk-banner.webp",
    sectionsTitle: "Build a clear recovery plan.",
    sectionsSub: "Understand private jet weather delays, mechanical issues and replacement aircraft.",
    sections: [
      {
        title: "Find out what has changed",
        text: "Ask for the reason, current operating status and next update time. Separate an estimated departure from an approved plan. Weather at either airport or along the route may matter.",
        icon: "clock"
      },
      {
        title: "Compare realistic alternatives",
        text: "Ask about waiting, another airport, a later departure or a replacement aircraft. Include ground-transfer time and your latest useful arrival, with its time zone.",
        icon: "route"
      },
      {
        title: "Check the replacement carefully",
        text: "Reconfirm seats, bags, cabin access, range, amenities and the named operating carrier. A similar aircraft category does not ensure the same layout or service.",
        icon: "plane"
      },
      {
        title: "Agree costs before accepting",
        text: "Request written treatment of additional charges, unused arrangements and cancellation. Confirm who approves a change and whether the original booking is being replaced.",
        icon: "card"
      }
    ],
    table: {
      title: "Understand the disruption and the proposed response.",
      headers: [
        "Situation",
        "Possible response",
        "Confirm before you agree"
      ],
      rows: [
        [
          "Weather or airport restrictions",
          "Wait, adjust routing or assess another airport",
          "Operator feasibility, ground journey and next review time"
        ],
        [
          "Mechanical issue",
          "Maintenance assessment or alternative aircraft",
          "Aircraft suitability, availability and revised total"
        ],
        [
          "Crew or scheduling limits",
          "Revise timing or use another operating plan",
          "Crew availability and impact on later legs"
        ],
        [
          "Trip no longer useful",
          "Discuss cancellation or other travel",
          "Applicable contract, refund position and written agreement"
        ]
      ]
    },
    cardsTitle: "",
    cards: [],
    checklistTitle: "Before accepting a replacement.",
    checklist: [
      "Next update time and contact agreed",
      "Revised route and timing reviewed",
      "Operating carrier and aircraft identified",
      "Seats, baggage and amenities rechecked",
      "Extra costs and cancellation treatment agreed",
      "Written revised arrangements received"
    ],
    faq: [
      {
        q: "Is a replacement aircraft guaranteed?",
        a: "No. Ask what the contract promises and which suitable aircraft are actually available. A proposed option remains subject to operational confirmation."
      },
      {
        q: "Who decides whether the flight can operate?",
        a: "The operating carrier and flight crew make the relevant operational safety decisions. A customer’s deadline does not remove weather, maintenance or other operating limits."
      },
      {
        q: "Will I pay more for a replacement?",
        a: "It depends on the booking terms and the option offered. Ask for a written total, exclusions and the treatment of the original payment before accepting."
      },
      {
        q: "Can we use a different airport?",
        a: "Possibly. The operator must assess its suitability and permissions. Check the FBO address, transfers, border arrangements and full door-to-door time."
      }
    ],
    sources: [
      "s6_weather",
      "s6_faa",
      "s6_nbaa"
    ],
    related: [
      {
        slug: "private-jet-charter-cancellation-policy",
        img: "/images/light/six-03-reviewing-booking-documents.webp"
      },
      {
        slug: "last-minute-private-jet",
        img: "/images/light/six-04-jet-with-boarding-stairs.webp"
      },
      {
        slug: "private-jet-airports-and-fbos",
        img: "/images/light/six-05-private-airport-transfer.webp"
      }
    ],
    toolTitle: "Compare recovery options",
    fields: [
      {
        label: "Latest useful arrival and time zone",
        placeholder: "Optional"
      },
      {
        label: "Next update time and contact",
        placeholder: "Optional"
      },
      {
        label: "Questions about charges or refunds",
        placeholder: "Optional"
      }
    ],
    bandTitle: "Plans changed? Clarify your options."
  },
  {
    id: 16,
    slug: "private-jet-cabin-amenities",
    title: "Private Jet Cabin Amenities, Wi-Fi, and Catering",
    short: "Private Jet Cabin Amenities, Wi-Fi & Catering",
    metaTitle: "Private Jet Cabin Amenities, Wi-Fi & Catering",
    description: "Check private jet seating, Wi-Fi, catering and onboard facilities. Confirm the exact aircraft, service limits and passenger requirements before booking.",
    eyebrow: "Onboard comfort",
    dek: "Check private jet seating, Wi-Fi, catering and onboard facilities. Confirm the exact aircraft, service limits and passenger requirements before booking.",
    takeaway: "Confirm features on the exact aircraft. Photos and model brochures do not establish what will be supplied on your flight.",
    primaryCta: "Check the cabin",
    hero: "/images/light/six-06-cabin-dining-hero.webp",
    inline: "/images/light/six-07-catering-meal-closeup.webp",
    band: "/images/light/six-21-jet-at-dusk-banner.webp",
    sectionsTitle: "Verify the cabin before you book.",
    sectionsSub: "Check private jet seating, Wi-Fi, catering and onboard facilities.",
    sections: [
      {
        title: "Check the actual cabin",
        text: "Request current photos and a seat plan for the proposed aircraft. Ask about seat use, sleeping arrangements, lavatory privacy, cabin height, baggage access and boarding steps.",
        icon: "seat"
      },
      {
        title: "Define what Wi-Fi must do",
        text: "Say whether you need email, VPN access, streaming or a video call. Ask about the installed system, route coverage, charges, limits and a plan if connectivity is unavailable.",
        icon: "wifi"
      },
      {
        title: "Make catering specific",
        text: "Confirm menu, quantities, meal times, dietary needs and charges. Ask about storage, heating equipment, cutlery and crew service; the galley does not always support a full hot meal.",
        icon: "cup"
      },
      {
        title: "Recheck after a substitution",
        text: "Record essential features in writing. If the aircraft changes, repeat the cabin, connectivity and catering checks rather than relying on the original proposal.",
        icon: "doc"
      }
    ],
    table: {
      title: "Ask for aircraft-specific confirmation.",
      headers: [
        "Feature",
        "What to verify",
        "Useful evidence"
      ],
      rows: [
        [
          "Seating and rest",
          "Seat count, layout and realistic sleeping positions",
          "Current seat plan and aircraft-specific photos"
        ],
        [
          "Connectivity",
          "System, coverage, limits and charges",
          "Written confirmation from the trip team"
        ],
        [
          "Food and drinks",
          "Menu, handling, timing and equipment",
          "Accepted catering order and total cost"
        ],
        [
          "Special requirements",
          "Boarding, equipment and functional needs",
          "Operator acceptance for this aircraft"
        ]
      ]
    },
    cardsTitle: "Plan for how you will use the cabin.",
    cards: [
      {
        img: "/images/light/six-08-working-onboard-laptop.webp",
        title: "Working onboard",
        body: "Say what your connection must support and agree a backup plan."
      },
      {
        img: "/images/light/six-09-cabin-rest-seat.webp",
        title: "Resting onboard",
        body: "Confirm realistic sleeping positions on the actual aircraft."
      },
      {
        img: "/images/light/six-07-catering-meal-closeup.webp",
        title: "Dining onboard",
        body: "Agree menu, timing, dietary needs and charges in writing."
      }
    ],
    checklistTitle: "Before you confirm the cabin.",
    checklist: [
      "Current cabin and seat plan reviewed",
      "Lavatory and boarding access confirmed",
      "Wi-Fi requirements and limitations checked",
      "Catering order and charges accepted",
      "Allergen questions addressed with provider",
      "Essential features rechecked if aircraft changes"
    ],
    faq: [
      {
        q: "Does every private jet have Wi-Fi?",
        a: "No. Equipment varies by aircraft, and available service may vary along the route. Ask about the exact aircraft and explain your intended use."
      },
      {
        q: "Can I rely on a video meeting in flight?",
        a: "Treat it as a requirement to verify, not an assumed capability. Ask about coverage, performance limits and a backup plan for essential work."
      },
      {
        q: "Can catering be allergen-free?",
        a: "Do not assume it. Ask the catering provider about ingredients, handling and cross-contact controls, and discuss whether it can meet your requirements."
      },
      {
        q: "Are cabin photos always of the aircraft I will fly?",
        a: "They may be illustrative or show another configuration. Request the proposed aircraft’s current photos and reconfirm following any substitution."
      }
    ],
    sources: [
      "s6_gulf",
      "s6_fda",
      "s6_nbaa"
    ],
    related: [
      {
        slug: "how-to-choose-the-right-private-jet",
        img: "/images/light/six-04-jet-with-boarding-stairs.webp"
      },
      {
        slug: "first-private-jet-flight",
        img: "/images/light/six-11-cabin-notebook.webp"
      },
      {
        slug: "private-jet-accessibility",
        img: "/images/light/six-10-accessible-boarding.webp"
      }
    ],
    toolTitle: "Open cabin requirements",
    fields: [
      {
        label: "Seating, rest and lavatory needs",
        placeholder: "Optional"
      },
      {
        label: "Connectivity tasks and backup plan",
        placeholder: "Optional"
      },
      {
        label: "Catering and dietary questions",
        placeholder: "Optional"
      }
    ],
    bandTitle: "The right cabin starts with the right questions."
  },
  {
    id: 17,
    slug: "private-jet-charter-vs-first-class",
    title: "Private Jet Charter vs. Commercial First Class",
    short: "Private Jet Charter vs. Commercial First Class",
    metaTitle: "Private Jet Charter vs. Commercial First Class",
    description: "Compare private jet charter with commercial first class by privacy, scheduling, airport access and complete trip cost for your group.",
    eyebrow: "Compare your journey",
    dek: "Compare private jet charter with commercial first class by privacy, scheduling, airport access and complete trip cost for your group.",
    takeaway: "Compare the same route, dates, group and service needs. An hourly charter rate and a per-seat airline fare are different price bases.",
    primaryCta: "Compare the options",
    hero: "/images/light/six-12-private-cabin-flowers.webp",
    heroB: "/images/light/six-13-commercial-first-class-suite.webp",
    inline: "/images/light/six-14-fbo-lounge-luggage.webp",
    band: "/images/light/six-21-jet-at-dusk-banner.webp",
    sectionsTitle: "Compare the whole journey.",
    sectionsSub: "Compare private jet charter with commercial first class by privacy, scheduling, airport access and complete trip cost for your group.",
    sections: [
      {
        title: "Privacy and shared space",
        text: "Charter gives your travelling group use of the booked aircraft cabin, with crew present. First class is an airline cabin product and may involve shared boarding areas and nearby passengers.",
        icon: "people"
      },
      {
        title: "Timing and flexibility",
        text: "A charter itinerary can be proposed around your plans, subject to operational feasibility. An airline ticket follows published schedules and the fare’s change and cancellation rules.",
        icon: "clock"
      },
      {
        title: "Airport and ground access",
        text: "Compare the actual airports and terminal addresses. A smaller airport may reduce a transfer, but runway, operating hours, customs and aircraft suitability can constrain the choice.",
        icon: "pin"
      },
      {
        title: "Total cost for everyone",
        text: "Use the full charter quote for the group and the complete airline fare for every traveller. Add transfers, applicable extras and any necessary hotel nights on both sides.",
        icon: "card"
      }
    ],
    table: {
      title: "Compare privacy, timing, airports and price.",
      headers: [
        "Factor",
        "Private jet charter",
        "Commercial first class"
      ],
      rows: [
        [
          "Privacy",
          "Cabin for your booked group; crew still present",
          "Premium airline cabin with other passengers"
        ],
        [
          "Schedule",
          "Proposed itinerary, subject to approval and availability",
          "Published departures and fare conditions"
        ],
        [
          "Airports",
          "Suitable airport choices assessed for the trip",
          "Airports served by the airline itinerary"
        ],
        [
          "Pricing",
          "Aircraft/trip quote; verify all inclusions",
          "Fare per traveller plus applicable extras"
        ],
        [
          "Disruptions",
          "Recovery depends on operator options and contract",
          "Airline rules and applicable passenger protections"
        ]
      ]
    },
    cardsTitle: "Which deserves a closer look?",
    cards: [
      {
        img: "/images/light/six-13-commercial-first-class-suite.webp",
        title: "First class",
        body: "A nonstop schedule fits, you need only a few seats, and private cabin use is not essential."
      },
      {
        img: "/images/light/six-04-jet-with-boarding-stairs.webp",
        title: "Private charter",
        body: "Group privacy, several stops or suitable airport access may justify the full charter price."
      },
      {
        img: "/images/light/six-15-trip-planning-map.webp",
        title: "Compare both",
        body: "A group is travelling together or dates are flexible. Obtain like-for-like quotes; do not assume charter is cheaper."
      }
    ],
    checklistTitle: "Before you choose.",
    checklist: [
      "Same journey and dates compared",
      "Exact airport and terminal addresses checked",
      "Complete costs entered for the entire group",
      "Door-to-door timing assessed on both sides",
      "Cabin and baggage needs checked",
      "Change and disruption terms reviewed"
    ],
    faq: [
      {
        q: "Is charter always faster door to door?",
        a: "No. Airport location, aircraft availability, transfers, weather and stops can change the result. Compare the actual journeys, not just flight time."
      },
      {
        q: "Is charter cheaper for a group?",
        a: "It can change the per-person comparison, but there is no universal answer. Use current written quotes for the same group and itinerary."
      },
      {
        q: "Is airline first class always a lie-flat seat?",
        a: "No. The product varies by airline, route and aircraft. Check the seat type and operating aircraft for every leg."
      },
      {
        q: "Which should I choose?",
        a: "Record your priorities—privacy, schedule, airport access, cabin facilities and budget—then compare suitable offers against them. Neither option wins every trip."
      }
    ],
    sources: [
      "s6_faa",
      "s6_nbaa",
      "s6_dot"
    ],
    related: [
      {
        slug: "how-to-choose-the-right-private-jet",
        img: "/images/light/six-04-jet-with-boarding-stairs.webp"
      },
      {
        slug: "private-jet-airports-and-fbos",
        img: "/images/light/six-05-private-airport-transfer.webp"
      },
      {
        slug: "private-jet-cabin-amenities",
        img: "/images/light/six-16-cabin-drinks.webp"
      }
    ],
    toolTitle: "Compare total trip costs",
    fields: [
      {
        label: "Route, dates and group",
        placeholder: "Optional"
      },
      {
        label: "Privacy and schedule priorities",
        placeholder: "Optional"
      },
      {
        label: "Door-to-door timing assumptions",
        placeholder: "Optional"
      }
    ],
    bandTitle: "The right choice starts with your itinerary."
  },
  {
    id: 18,
    slug: "private-jet-charter-vs-fractional-ownership",
    title: "Private Jet Charter vs. Fractional Ownership",
    short: "Private Jet Charter vs. Fractional Ownership",
    metaTitle: "Private Jet Charter vs. Fractional Ownership",
    description: "Compare on-demand charter and fractional ownership by commitment, access, annual costs and exit terms. Build a like-for-like review for frequent travel.",
    eyebrow: "Frequent travel",
    dek: "Compare on-demand charter and fractional ownership by commitment, access, annual costs and exit terms. Build a like-for-like review for frequent travel.",
    takeaway: "Annual flying hours alone do not decide the better fit. Compare suitable aircraft, access terms, complete costs and your commitment horizon.",
    primaryCta: "Compare the models",
    hero: "/images/light/six-17-two-jets-fractional.webp",
    inline: "/images/light/six-11-cabin-notebook.webp",
    band: "/images/light/six-18-wing-above-clouds.webp",
    sectionsTitle: "Match the model to how you travel.",
    sectionsSub: "Compare on-demand charter and fractional ownership by commitment, access, annual costs and exit terms.",
    sections: [
      {
        title: "Start with your travel pattern",
        text: "Map typical routes, passengers, seasonality and booking notice. Separate predictable travel from occasional peaks, and identify where aircraft size changes between trips.",
        icon: "route"
      },
      {
        title: "Understand the commitment",
        text: "On-demand charter buys individual trips under their booking terms. Fractional programs involve an ownership interest and program agreements, with ongoing obligations to review.",
        icon: "doc"
      },
      {
        title: "Model all the costs",
        text: "Request written program pricing and comparable charter quotes. Include capital at risk, fixed charges, occupied-hour costs, surcharges and exit assumptions; advertised hourly figures are not equivalent.",
        icon: "calc"
      },
      {
        title: "Read the access and exit terms",
        text: "Ask about peak-day limits, notice, service area, aircraft interchange, unused hours and recovery. Review resale, fees and early-exit provisions with qualified advisers.",
        icon: "warn"
      }
    ],
    table: {
      title: "Understand the tradeoffs before committing.",
      headers: [
        "Question",
        "On-demand charter",
        "Fractional ownership"
      ],
      rows: [
        [
          "Commitment",
          "Trip-by-trip booking terms",
          "Ownership interest and program obligations"
        ],
        [
          "Aircraft choice",
          "Source suitable aircraft for each request",
          "Program fleet and interchange provisions"
        ],
        [
          "Availability",
          "Suitable capacity must be sourced",
          "Access subject to program terms"
        ],
        [
          "Cost structure",
          "Trip quotes and applicable extras",
          "Capital, fixed and variable charges"
        ],
        [
          "Exit",
          "Cancel or change under booking terms",
          "Sale or exit process defined by agreements"
        ]
      ]
    },
    cardsTitle: "Which model fits your travel?",
    cards: [
      {
        img: "/images/light/six-04-jet-with-boarding-stairs.webp",
        title: "On-demand charter",
        body: "Occasional or irregular travel, with the aircraft chosen trip by trip."
      },
      {
        img: "/images/light/six-12-private-cabin-flowers.webp",
        title: "Fractional ownership",
        body: "Frequent, predictable travel where the program terms fit your pattern."
      },
      {
        img: "/images/light/six-15-trip-planning-map.webp",
        title: "Mixed approach",
        body: "A program for core travel, with charter for peaks or a different aircraft size."
      }
    ],
    checklistTitle: "Before you commit.",
    checklist: [
      "Representative routes and hours mapped",
      "Equivalent aircraft categories compared",
      "Peak-day and notice terms reviewed",
      "Fixed, variable and capital costs included",
      "Unused hours and recovery terms checked",
      "Exit assumptions reviewed with advisers"
    ],
    faq: [
      {
        q: "Is there a universal break-even number of hours?",
        a: "No. Results depend on routes, aircraft, notice, program terms, capital cost and exit assumptions. A single hours threshold can conceal material differences."
      },
      {
        q: "Do fractional owners always fly their own aircraft?",
        a: "Programs may use aircraft interchange under their agreements. Ask what aircraft types and substitutions are permitted and how any differences are charged."
      },
      {
        q: "Does fractional ownership guarantee every request?",
        a: "Review the actual program commitments, notice requirements, service area, peak-day provisions and recovery terms. Avoid assuming unrestricted access."
      },
      {
        q: "What does the cost worksheet calculate?",
        a: "It compares figures you enter on a consistent annual basis. It does not model financing, tax, investment returns or the time value of money unless you include appropriate costs yourself."
      }
    ],
    sources: [
      "s6_fractional",
      "s6_91k",
      "s6_nbaa"
    ],
    related: [
      {
        slug: "on-demand-charter-vs-jet-cards-memberships",
        img: "/images/light/six-04-jet-with-boarding-stairs.webp"
      },
      {
        slug: "how-to-choose-the-right-private-jet",
        img: "/images/light/six-12-private-cabin-flowers.webp"
      },
      {
        slug: "private-jet-disruptions-and-replacements",
        img: "/images/light/six-18-wing-above-clouds.webp"
      }
    ],
    toolTitle: "Open annual cost worksheet",
    fields: [
      {
        label: "Typical routes, passengers and booking notice",
        placeholder: "Optional"
      },
      {
        label: "Peak-day and service-area questions",
        placeholder: "Optional"
      },
      {
        label: "Unused hours, exit and substitution terms",
        placeholder: "Optional"
      }
    ],
    bandTitle: "Compare both models against how you really fly."
  },
  {
    id: 19,
    slug: "corporate-multi-city-private-jet-charter",
    title: "Corporate and Multi-City Private Jet Charter",
    short: "Corporate & Multi-City Private Jet Charter",
    metaTitle: "Corporate & Multi-City Private Jet Charter",
    description: "Plan corporate private jet itineraries with multiple stops, passenger changes and meeting deadlines. Coordinate each leg, airport, cost and recovery plan.",
    eyebrow: "Corporate travel planning",
    dek: "Plan corporate private jet itineraries with multiple stops, passenger changes and meeting deadlines. Coordinate each leg, airport, cost and recovery arrangement.",
    takeaway: "A proposed schedule is not a confirmed itinerary. Aircraft, crew, airports and permissions must be checked for every leg.",
    primaryCta: "Plan every leg",
    hero: "/images/light/six-19-corporate-travellers-boarding.webp",
    inline: "/images/light/six-11-cabin-notebook.webp",
    band: "/images/light/six-21-jet-at-dusk-banner.webp",
    sectionsTitle: "One itinerary. Every detail accounted for.",
    sectionsSub: "Plan corporate private jet itineraries with multiple stops, passenger changes and meeting deadlines.",
    sections: [
      {
        title: "Start with the business schedule",
        text: "List meeting locations, earliest departures and latest useful arrivals. Include local dates, time zones and realistic ground-transfer buffers for each stop.",
        icon: "calendar"
      },
      {
        title: "Plan each passenger movement",
        text: "Record the number travelling on every leg, including anyone joining or leaving. Reconfirm baggage, catering and assistance as the group changes.",
        icon: "people"
      },
      {
        title: "Check the whole operating day",
        text: "Waiting between meetings can affect the operating plan. Ask about crew availability, airport hours, parking, slots and the effect of a later departure on remaining legs.",
        icon: "clock"
      },
      {
        title: "Agree how changes are approved",
        text: "Name one travel coordinator and a budget approver. Ask the operator to reassess affected legs before distributing a revised, versioned itinerary.",
        icon: "doc"
      }
    ],
    table: {
      title: "Plan every leg, including passenger changes.",
      headers: [
        "Planning item",
        "Record for every leg",
        "Owner"
      ],
      rows: [
        [
          "Timing",
          "Date, local time zone, departure window and arrival deadline",
          "Travel coordinator"
        ],
        [
          "Passengers",
          "Count and changes to traveller list or requirements",
          "Passenger coordinator"
        ],
        [
          "Airports",
          "Exact airport, FBO address and ground contact",
          "Trip team"
        ],
        [
          "Cost and changes",
          "Full itinerary price, extra charges and approval process",
          "Budget approver"
        ]
      ]
    },
    cardsTitle: "",
    cards: [],
    checklistTitle: "Before the first leg departs.",
    checklist: [
      "All legs and time zones reviewed",
      "Passenger counts and changes checked by leg",
      "Airports, FBOs and transfers checked",
      "Complete price and exclusions reviewed",
      "Documents and assistance arrangements confirmed",
      "Change contact and recovery plan agreed"
    ],
    faq: [
      {
        q: "Can passengers join or leave at different stops?",
        a: "Yes, subject to operator confirmation and applicable requirements. Update each leg’s traveller list, baggage and assistance needs before departure."
      },
      {
        q: "Can the aircraft wait while we attend meetings?",
        a: "Ask about aircraft and crew availability, parking, waiting charges, daily minimums and overnight costs. A long gap may favour a different operating plan."
      },
      {
        q: "Will every leg use the same aircraft and crew?",
        a: "Do not assume so. Ask which aircraft and operating carrier are proposed for each leg and how substitutions or crew changes will be communicated."
      },
      {
        q: "What happens if a meeting runs late?",
        a: "Contact the trip team before changing the departure plan. Ask how the delay affects crew limits, airport access, added costs and later legs."
      }
    ],
    sources: [
      "s6_nbaa",
      "s6_slots",
      "s6_cbp"
    ],
    related: [
      {
        slug: "one-way-vs-round-trip",
        img: "/images/light/six-04-jet-with-boarding-stairs.webp"
      },
      {
        slug: "international-private-jet-travel",
        img: "/images/light/six-20-coastal-private-jet.webp"
      },
      {
        slug: "private-jet-cabin-amenities",
        img: "/images/light/six-11-cabin-notebook.webp"
      }
    ],
    toolTitle: "Open leg-by-leg planner",
    fields: [
      {
        label: "Company or trip label",
        placeholder: "Optional"
      },
      {
        label: "Coordinator and approval roles",
        placeholder: "Optional"
      },
      {
        label: "Meeting deadlines and change process",
        placeholder: "Optional"
      }
    ],
    bandTitle: "One itinerary. One clear plan."
  },
  {
    id: 20,
    slug: "private-jet-charter-glossary",
    title: "Private Jet Charter Glossary",
    short: "Private Jet Charter Glossary: Terms Explained",
    metaTitle: "Private Jet Charter Glossary: Terms Explained",
    description: "Understand private jet charter terms for aircraft, pricing, airports and booking, including FBO, empty leg, block time and charter brokers.",
    eyebrow: "Charter terms, explained",
    dek: "Understand private jet charter terms for aircraft, pricing, airports and booking, including FBO, empty leg, block time and charter brokers.",
    takeaway: "Plain-language guide. Definitions and charges can vary by operator and contract.",
    primaryCta: "Find a term",
    hero: "/images/light/six-01-jet-at-fbo.webp",
    sideImg: "/images/light/six-11-cabin-notebook.webp",
    band: "/images/light/six-21-jet-at-dusk-banner.webp",
    sectionsTitle: "Find the term. Know what to check.",
    sectionsSub: "Understand private jet charter terms for aircraft, pricing, airports and booking, including FBO, empty leg, block time and charter brokers.",
    sections: [],
    table: {
      title: "Common terms that are easy to confuse.",
      headers: [
        "Terms",
        "The difference",
        "What to ask"
      ],
      rows: [
        [
          "Broker / operator",
          "Arranges the trip / operates the flight",
          "Who is the named operating carrier?"
        ],
        [
          "Block / airborne time",
          "Includes taxi / takeoff to landing",
          "Which time basis is billed?"
        ],
        [
          "Quote / confirmation",
          "A proposal / written booking arrangements",
          "What is confirmed and what is pending?"
        ],
        [
          "Hourly rate / total quote",
          "One component / proposed trip total",
          "Which taxes, fees and contingencies apply?"
        ]
      ]
    },
    cardsTitle: "",
    cards: [],
    checklistTitle: "Before you accept a quote.",
    checklist: [
      "Named operating carrier identified",
      "Aircraft and itinerary checked",
      "Total price and possible extras reviewed",
      "Billable time and minimums understood",
      "Cancellation and change terms reviewed",
      "Written confirmation and pending items checked"
    ],
    faq: [
      {
        q: "Does a quote mean my aircraft is booked?",
        a: "No. Ask for written confirmation, the operating carrier, accepted terms and anything still pending."
      },
      {
        q: "Is an empty leg guaranteed to operate?",
        a: "No. It depends on the underlying aircraft schedule. Confirm its cancellation terms and a backup plan."
      },
      {
        q: "Does an hourly rate include every charge?",
        a: "Not necessarily. Ask about billable time, minimums, positioning and every potential additional charge."
      },
      {
        q: "Is an FBO the same as the airport?",
        a: "No. An FBO provides services at an airport. Confirm both the airport and the exact FBO or meeting address."
      }
    ],
    sources: [
      "s6_slots",
      "s6_nbaa",
      "s6_295"
    ],
    related: [
      {
        slug: "private-jet-cabin-amenities",
        img: "/images/light/six-12-private-cabin-flowers.webp"
      },
      {
        slug: "private-jet-disruptions-and-replacements",
        img: "/images/light/six-01-jet-at-fbo.webp"
      },
      {
        slug: "corporate-multi-city-private-jet-charter",
        img: "/images/light/six-19-corporate-travellers-boarding.webp"
      }
    ],
    toolTitle: "Ask about a charter term",
    fields: [
      {
        label: "Term or phrase",
        placeholder: "Optional"
      },
      {
        label: "Your question",
        placeholder: "Optional"
      },
      {
        label: "Route or booking context",
        placeholder: "Optional"
      }
    ],
    bandTitle: "Clear terms. Better booking decisions.",
    terms: [
      {
        slug: "tail-number",
        category: "Aircraft",
        name: "Tail number",
        definition: "An aircraft’s registration identifier; it does not prove charter authorization.",
        why: "Identify the actual aircraft and ask the operator to establish its authorization.",
        ask: [
          "What is the proposed registration?",
          "Is this aircraft authorized for the proposed charter?"
        ]
      },
      {
        slug: "range",
        category: "Aircraft",
        name: "Range",
        definition: "How far an aircraft can fly; payload, weather and routing affect your trip.",
        why: "A published figure is not a nonstop commitment for your route.",
        ask: [
          "Is a fuel stop planned?",
          "What assumptions support the proposed routing?"
        ]
      },
      {
        slug: "payload",
        category: "Aircraft",
        name: "Payload",
        definition: "The load carried, including passengers and baggage.",
        why: "Available capacity depends on the aircraft and flight plan.",
        ask: [
          "Are our passengers and bags accepted?",
          "Are there weight or loading restrictions?"
        ]
      },
      {
        slug: "cabin-category",
        category: "Aircraft",
        name: "Cabin category",
        definition: "A market grouping such as light or midsize; layouts vary by aircraft.",
        why: "Compare actual dimensions and seats rather than relying on a category name.",
        ask: [
          "Can I see the current seat plan?",
          "Which essential features are installed?"
        ]
      },
      {
        slug: "nautical-mile-nm",
        category: "Aircraft",
        name: "Nautical mile (NM)",
        definition: "An aviation distance unit equal to 1.852 kilometres.",
        why: "Range and route distances are often quoted in nautical miles.",
        ask: [
          "Which units are being used?",
          "Is this routing distance or straight-line distance?"
        ]
      },
      {
        slug: "hourly-rate",
        category: "Pricing",
        name: "Hourly rate",
        definition: "A time-based charge; ask which billable hours and extras apply.",
        why: "An hourly figure is only part of many trip quotes.",
        ask: [
          "Which time basis is billed?",
          "What is the complete proposed trip total?"
        ]
      },
      {
        slug: "block-time",
        category: "Pricing",
        name: "Block time",
        definition: "Time from leaving parking to parking at arrival, including taxi.",
        why: "The time basis in your quote affects what you pay. Illustrative example: 10 minutes taxi out + 60 airborne + 5 taxi in = 75 minutes block time. Billing definitions can differ.",
        ask: [
          "Is taxi time included in billed hours?",
          "Do minimum hours or rounding apply?"
        ]
      },
      {
        slug: "positioning",
        category: "Pricing",
        name: "Positioning",
        definition: "Moving an aircraft to or from your trip; this may affect the price.",
        why: "Your occupied legs may not be the aircraft’s only movements.",
        ask: [
          "Are positioning charges included?",
          "Can the price change if aircraft positioning changes?"
        ]
      },
      {
        slug: "empty-leg",
        category: "Pricing",
        name: "Empty leg",
        definition: "An otherwise unoccupied positioning flight offered for charter.",
        why: "Availability depends on the underlying aircraft schedule, which can change.",
        ask: [
          "What is the exact departure window?",
          "What happens if the underlying trip changes?"
        ]
      },
      {
        slug: "daily-minimum",
        category: "Pricing",
        name: "Daily minimum",
        definition: "A minimum billable time or charge per day, if applied by the contract.",
        why: "Time spent waiting between legs may still affect the total.",
        ask: [
          "Which days attract a minimum?",
          "How is a multi-day itinerary calculated?"
        ]
      },
      {
        slug: "fbo",
        category: "Airports",
        name: "FBO",
        definition: "Fixed-base operator: a provider of ground services at an airport.",
        why: "The FBO address is often the meeting point; confirm it for your flight.",
        ask: [
          "Which FBO and address should we use?",
          "What arrival time has been agreed?"
        ]
      },
      {
        slug: "airport-slot",
        category: "Airports",
        name: "Airport slot",
        definition: "Permission for a takeoff or landing time; separate from ATC clearance.",
        why: "A slot does not itself confirm every operational permission or parking space.",
        ask: [
          "Is the requested time approved?",
          "Are parking and other permissions arranged?"
        ]
      },
      {
        slug: "ppr",
        category: "Airports",
        name: "PPR",
        definition: "Prior permission required; airport approval may be needed before arrival.",
        why: "An airport’s access conditions can affect your itinerary.",
        ask: [
          "Has the required permission been secured?",
          "What happens if our timing changes?"
        ]
      },
      {
        slug: "technical-stop",
        category: "Airports",
        name: "Technical stop",
        definition: "An intermediate stop for fuel or another operational need.",
        why: "A stop adds time and may affect passenger or border arrangements.",
        ask: [
          "Where and why is the stop planned?",
          "Must passengers leave the aircraft?"
        ]
      },
      {
        slug: "customs-clearance",
        category: "Airports",
        name: "Customs clearance",
        definition: "Border formalities for an international flight; arrangements vary.",
        why: "Airport suitability and document preparation matter on international trips.",
        ask: [
          "Where will border processing take place?",
          "What documents and advance arrangements are required?"
        ]
      },
      {
        slug: "charter-broker",
        category: "Booking",
        name: "Charter broker",
        definition: "Arranges charter transport with an operating carrier.",
        why: "Establish the role of the party you are contracting with.",
        ask: [
          "Who is the named operating carrier?",
          "What capacity is the broker acting in?"
        ]
      },
      {
        slug: "operating-carrier",
        category: "Booking",
        name: "Operating carrier",
        definition: "The carrier responsible for operating your flight.",
        why: "Operational responsibility and arranging a booking are distinct roles.",
        ask: [
          "Which carrier operates each leg?",
          "Who provides operational updates?"
        ]
      },
      {
        slug: "quote",
        category: "Booking",
        name: "Quote",
        definition: "A proposed price and terms, subject to validity and availability.",
        why: "A proposal should identify what is offered and what remains conditional.",
        ask: [
          "When does this quote expire?",
          "What must happen to confirm the booking?"
        ]
      },
      {
        slug: "hold-option",
        category: "Booking",
        name: "Hold / option",
        definition: "A temporary arrangement with an expiry; ask what it actually reserves.",
        why: "A hold can have conditions and may not be a confirmed booking.",
        ask: [
          "When does the hold expire?",
          "What is reserved and what remains pending?"
        ]
      },
      {
        slug: "cancellation-terms",
        category: "Booking",
        name: "Cancellation terms",
        definition: "The rules and charges that apply if a trip is cancelled.",
        why: "Check the accepted contract, timing thresholds and the reason for cancellation.",
        ask: [
          "Which charges apply at each stage?",
          "How are refunds or credits handled?"
        ]
      }
    ]
  }
];

export function getShortGuide(slug: string): ShortGuide | undefined {
  return SHORT_GUIDES.find((g) => g.slug === slug);
}

export function shortGuideHref(slug: string): string {
  return `/guides/${slug}`;
}

/**
 * Slugs that have their own static folder under src/app/(marketing)/guides
 * (they render the same template with their existing metadata) — the
 * dynamic [slug] route must not generate params for them.
 */
export const SHORT_GUIDE_STATIC_SLUGS = ["one-way-vs-round-trip", "last-minute-private-jet"];

// ---------------------------------------------------------------------------
// The /guides library index (Light - Guides.dc.html). Every guide on the
// site, long-form and short, in the prototype's order. The long-form
// pages (cost, beginner's guide, booking, broker vs operator, fees, ...)
// live in their own route folders; the short ones come from SHORT_GUIDES.

export type GuideTopic = "first" | "costs" | "aircraft" | "booking" | "intl";

export type LibraryGuide = {
  tag: string;
  topic: GuideTopic;
  title: string;
  body: string;
  href: string;
  img: string;
  /** "What you'll learn" lines for the preview window. */
  learn?: string[];
};

export const GUIDE_TOPICS: { key: GuideTopic | "all"; label: string }[] = [
  { key: "all", label: "All guides" },
  { key: "first", label: "First flight" },
  { key: "costs", label: "Costs & pricing" },
  { key: "aircraft", label: "Aircraft & cabins" },
  { key: "booking", label: "Booking & safety" },
  { key: "intl", label: "International & pets" },
];

const L = "/images/light/";
const FLEET = "/images/fleet/";
const HERO = "/images/hero/";

export const GUIDE_LIBRARY: LibraryGuide[] = [
  { tag: "Start here", topic: "first", title: "Private Jet Charter: A Beginner’s Guide", body: "Understand the people, aircraft and steps involved.", href: "/guides/private-jet-charter-guide", img: `${L}hero-jet-hero.webp`, learn: ["Who arranges and operates your flight", "How to compare aircraft and proposals", "What to confirm before you travel"] },
  { tag: "Costs", topic: "costs", title: "How Much Does a Private Jet Charter Cost?", body: "Understand what changes the complete trip price.", href: "/guides/private-jet-charter-cost", img: `${HERO}aircraft.webp`, learn: ["Why an hourly rate is only the start", "How positioning, taxes and extras add up", "What a written quote must include"] },
  { tag: "Booking", topic: "booking", title: "How to Book a Private Jet Charter", body: "Turn your itinerary into a clear request and proposal.", href: "/guides/how-to-book-a-private-jet", img: `${FLEET}supermid.webp`, learn: ["How to write a trip brief", "What to review in the proposal and agreement", "When a flight is actually confirmed"] },
  { tag: "Aircraft", topic: "aircraft", title: "How to Choose the Right Private Jet", body: "Match cabin, baggage and route requirements.", href: "/guides/how-to-choose-the-right-private-jet", img: `${FLEET}midsize.webp`, learn: ["The main categories and what they fit", "Cabin, baggage and route checks", "Questions to ask about the exact aircraft"] },
  { tag: "Safety", topic: "booking", title: "Private Jet Charter Safety Checklist", body: "Prepare questions about the operator and aircraft.", href: "/guides/private-jet-charter-safety-checklist", img: `${FLEET}heavy.webp`, learn: ["How to verify the operating carrier", "What the FAA suggests you ask", "Audit programs and what they cover"] },
  { tag: "International", topic: "intl", title: "International Private Jet Travel", body: "Plan travel documents, airport arrival and local requirements.", href: "/guides/international-private-jet-travel", img: `${HERO}how-it-works.webp`, learn: ["Documents and entry requirements", "Customs and arrival procedures", "Coordinating local arrival details"] },
  { tag: "Pets", topic: "intl", title: "Private Jet Travel With Pets", body: "Prepare your pet’s needs and destination paperwork.", href: "/guides/private-jet-travel-with-pets", img: `${FLEET}light.webp`, learn: ["Confirming pet acceptance on board", "Destination and return-entry paperwork", "Working with a USDA-accredited vet"] },
  { tag: "Aircraft", topic: "aircraft", title: "Private Jet Sizes and Aircraft Types Explained", body: "Compare cabin, seats, baggage and range by category.", href: "/guides/private-jet-sizes-and-types", img: `${FLEET}midsize.webp`, learn: ["What each category offers", "Matching the cabin to your trip", "Why the quote names the exact aircraft"] },
  { tag: "Booking", topic: "booking", title: "One-Way vs. Round-Trip Private Jet Charter", body: "Positioning, waiting costs and the itinerary details that shape a quote.", href: "/guides/one-way-vs-round-trip", img: `${L}jet-beside-glass-terminal.webp` },
  { tag: "Booking", topic: "booking", title: "On-Demand Charter vs. Jet Cards vs. Memberships", body: "Compare commitment, availability, pricing and contract terms.", href: "/guides/on-demand-charter-vs-jet-cards-memberships", img: `${L}notebook-sunset-window.webp` },
  { tag: "First flight", topic: "first", title: "What to Expect on Your First Private Jet Flight", body: "Terminal arrival, boarding, baggage and onboard service.", href: "/guides/first-private-jet-flight", img: `${L}golden-hour-boarding.webp` },
  { tag: "Booking", topic: "booking", title: "Private Jet Charter Cancellation and Refund Policies", body: "Deadlines, refunds, changes and replacement aircraft.", href: "/guides/private-jet-charter-cancellation-policy", img: `${L}notebook-sunset-window.webp` },
  { tag: "Booking", topic: "booking", title: "How Far in Advance Should You Book a Private Jet?", body: "Lead times around peak dates, aircraft needs and international trips.", href: "/guides/how-far-in-advance-to-book-a-private-jet", img: `${L}jet-beside-glass-terminal.webp` },
  { tag: "First flight", topic: "first", title: "Private Jet Airports and FBOs Explained", body: "Ground access, operating hours, customs and boarding.", href: "/guides/private-jet-airports-and-fbos", img: `${L}arrival-private-terminal.webp` },
  { tag: "Aircraft", topic: "aircraft", title: "Private Jet Baggage Limits", body: "Item dimensions, weight, loading access and oversized gear.", href: "/guides/private-jet-baggage-limits", img: `${L}luggage-by-jet.webp` },
  { tag: "Aircraft", topic: "aircraft", title: "Private Jet Range and Fuel Stops Explained", body: "Why published range differs from route-specific feasibility.", href: "/guides/private-jet-range-and-fuel-stops", img: `${L}jet-over-golden-clouds.webp` },
  { tag: "Family", topic: "intl", title: "Flying With Children and Infants on a Private Jet", body: "Seating, approved restraints, baggage and documents.", href: "/guides/private-jet-travel-with-children", img: `${L}family-watches-jet.webp` },
  { tag: "Accessibility", topic: "first", title: "Private Jet Accessibility and Mobility Assistance", body: "Boarding access, cabin fit, equipment and assistance.", href: "/guides/private-jet-accessibility", img: `${L}lounge-conversation-wheelchair.webp` },
  { tag: "Booking", topic: "booking", title: "Last-Minute Private Jet Charter", body: "Route, timing, documents and what confirms departure.", href: "/guides/last-minute-private-jet", img: `${L}twin-engine-jet-golden-hour.webp` },
  { tag: "Booking", topic: "booking", title: "Weather Delays, Mechanical Issues, and Replacement Aircraft", body: "Recovery options, replacement aircraft and revised costs.", href: "/guides/private-jet-disruptions-and-replacements", img: `${L}six-01-jet-at-fbo.webp` },
  { tag: "Aircraft", topic: "aircraft", title: "Private Jet Cabin Amenities, Wi-Fi, and Catering", body: "Seating, connectivity and catering on the actual aircraft.", href: "/guides/private-jet-cabin-amenities", img: `${L}six-06-cabin-dining-hero.webp` },
  { tag: "Booking", topic: "booking", title: "Private Jet Charter vs. Commercial First Class", body: "Privacy, timing, airports and the whole-trip cost.", href: "/guides/private-jet-charter-vs-first-class", img: `${L}six-12-private-cabin-flowers.webp` },
  { tag: "Booking", topic: "booking", title: "Private Jet Charter vs. Fractional Ownership", body: "Commitment, access, annual costs and exit terms.", href: "/guides/private-jet-charter-vs-fractional-ownership", img: `${L}six-17-two-jets-fractional.webp` },
  { tag: "Booking", topic: "booking", title: "Corporate and Multi-City Private Jet Charter", body: "Plan every leg, passenger change and approval.", href: "/guides/corporate-multi-city-private-jet-charter", img: `${L}six-19-corporate-travellers-boarding.webp` },
  { tag: "First flight", topic: "first", title: "Private Jet Charter Glossary", body: "Plain-language charter terms and what to ask.", href: "/guides/private-jet-charter-glossary", img: `${L}six-01-jet-at-fbo.webp` },
  { tag: "Booking", topic: "booking", title: "How to Choose a Private Jet Charter Company", body: "Who arranges, who operates, and what to verify.", href: "/guides/how-to-choose-a-charter-company", img: `${HERO}how-it-works.webp`, learn: ["Broker or operator", "Questions to ask", "Comparing the same trip"] },
  { tag: "Costs", topic: "costs", title: "Empty Leg Flights Explained", body: "Opportunity with limits: dates, airports and withdrawals.", href: "/guides/empty-legs-explained", img: `${FLEET}light.webp`, learn: ["How empty legs arise", "Is one right for me?", "Terms to confirm"] },
  { tag: "Booking", topic: "booking", title: "Private Jet Charter Broker vs. Aircraft Operator", body: "Know who does what before you sign.", href: "/guides/private-jet-broker-vs-operator", img: `${FLEET}heavy.webp`, learn: ["Operational control", "Broker disclosures", "Replacement aircraft"] },
  { tag: "Costs", topic: "costs", title: "Private Jet Charter Fees and Additional Charges", body: "Positioning, de-icing, catering, parking and taxes.", href: "/guides/private-jet-charter-fees", img: `${FLEET}ultra.webp`, learn: ["What is usually included", "Items billed at cost", "Questions before you accept"] },
  { tag: "Costs", topic: "costs", title: "How to Compare Private Jet Quotes", body: "Compare inclusions, potential charges and terms.", href: "/guides/how-to-compare-private-jet-quotes", img: `${FLEET}ultra.webp`, learn: ["Line items every quote should show", "Spotting excluded and charged-if-used items", "Comparing cancellation and substitution terms"] },
  { tag: "Costs", topic: "costs", title: "Private Jet Cost per Hour, by Category", body: "Hourly rates by category and what an hour includes.", href: "/guides/private-jet-cost-per-hour", img: `${HERO}aircraft.webp` },
  { tag: "Costs", topic: "costs", title: "What Affects a Private Jet Charter Price", body: "The line items behind every quote and which you can influence.", href: "/guides/what-affects-charter-price", img: `${FLEET}supermid.webp` },
];
