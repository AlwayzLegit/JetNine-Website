// The five steps on /how-it-works. Shared by the page (HowTo JSON-LD)
// and the client-side explorer so structured data tracks visible copy.

export type Step = {
  /** Who acts in this step — the small label over the short title. */
  label: string;
  /** Short title for the step list / chip strip. */
  short: string;
  title: string;
  body: string;
  metaLabel: string;
  items: string[];
};

export const STEPS: Step[] = [
  {
    label: "You",
    short: "Tell us the route",
    title: "You tell us the route.",
    body: "Phone, form, or email — whichever's faster. We need the city pair, the dates, the headcount. Everything else is optional & can be sorted later.",
    metaLabel: "What we ask",
    items: [
      "Departure & arrival cities (airport optional — we'll pick the best private terminal)",
      "Outbound date & flexible-hours window",
      "Passenger count & pet count",
      "Anything else? — special requests captured up front",
    ],
  },
  {
    label: "Dispatch",
    short: "A dispatcher picks up",
    title: "Dispatch picks up — within five minutes.",
    body: "A senior dispatcher (not a queue, not a chatbot, not a junior on their first month) reviews the brief and starts sourcing. Real human, every time.",
    metaLabel: "Who you get",
    items: [
      "14 years of average dispatch experience",
      "Direct line to your dispatcher for the life of the trip",
      "Same person handles the quote, the contract, and any in-flight changes",
      "24 / 7 / 365 — including holidays, weather days, and 3 a.m. callouts",
    ],
  },
  {
    label: "Quote",
    short: "3–5 aircraft, priced",
    title: "Three to five specific aircraft return — under thirty minutes.",
    body: "Not a category bracket. Real tail numbers, real years, real photos, real availability windows, real all-in pricing. Every option vetted to our safety floor before it lands in your inbox.",
    metaLabel: "What you see",
    items: [
      "Tail number, operator, year of manufacture, refurb date",
      "Cabin photos and floorplan",
      "All-in price (fuel, taxes, FET 7.5%, repositioning, crew, catering, ground)",
      "Availability window & soft-hold expiry",
      "Operator's ARG/US, Wyvern, IS-BAO standing",
    ],
  },
  {
    label: "Accept",
    short: "You pick, we hold it",
    title: "You pick. We hold the aircraft.",
    body: "No commitment until you accept. Soft hold — up to four hours — while you decide, share with the team, get a sign-off. After that, contract goes out and the aircraft locks.",
    metaLabel: "The decision window",
    items: [
      "Free 4-hour soft hold on your preferred aircraft",
      "Extend by request — most operators allow 24h with a deposit",
      "One-page charter agreement (Part 295 disclosure included)",
      "Wire, ACH, or major card — your choice",
    ],
  },
  {
    label: "Fly",
    short: "Show up and board",
    title: "Confirmation, trip sheet, take-off.",
    body: "Final trip sheet hits your inbox 24 hours before departure. Private-terminal instructions, ground transport details, crew names, weather brief. Everyone arrives ten minutes before scheduled wheels-up.",
    metaLabel: "Day of",
    items: [
      "Show up at the private terminal ten minutes before scheduled departure",
      "No security line, no boarding pass — your name is on the manifest",
      "Crew greets you on the ramp, bags loaded directly",
      "Wheels up within the agreed window — average ground time, eight minutes",
    ],
  },
];
