// The five steps on /how-it-works (Light - How it works). Shared by the
// page body and the HowTo JSON-LD so structured data tracks visible copy.

export type Step = {
  id: string;
  n: string;
  nav: string;
  title: string;
  sub: string;
  provide: string;
  receive: string;
  link: { label: string; href?: string; window?: "brief" | "confirmation" };
  note?: string;
  image?: boolean;
};

export const STEPS: Step[] = [
  {
    id: "request",
    n: "01",
    nav: "Request",
    title: "Share your trip brief.",
    sub: "Start with the route, dates, passengers and luggage.",
    provide: "Itinerary, timing flexibility and special requests.",
    receive: "A clear starting brief for suitable options.",
    link: { label: "Start a trip request", href: "/quote/mission" },
  },
  {
    id: "compare",
    n: "02",
    nav: "Compare",
    title: "Compare suitable aircraft.",
    sub: "Review the actual aircraft, proposed routing and operating carrier.",
    provide: "Your cabin priorities and questions.",
    receive: "Aircraft details and a complete trip proposal.",
    link: { label: "Explore aircraft categories", href: "/aircraft" },
    image: true,
  },
  {
    id: "review",
    n: "03",
    nav: "Review",
    title: "Review the price and agreement.",
    sub: "Check inclusions, payment, cancellation and change terms.",
    provide: "Your selection and any clarification requests.",
    receive: "Written terms to review before committing.",
    link: { label: "Understand total charter cost", href: "/guides/private-jet-charter-cost" },
  },
  {
    id: "confirm",
    n: "04",
    nav: "Confirm",
    title: "Receive booking confirmation.",
    sub: "Confirm the status in writing and resolve anything outstanding.",
    provide: "The agreement and payment steps required for your booking.",
    receive: "Confirmed itinerary, operator details and next actions.",
    link: { label: "View confirmation details", window: "confirmation" },
    note: "An inquiry or quote alone does not confirm a flight.",
  },
  {
    id: "prepare",
    n: "05",
    nav: "Prepare",
    title: "Prepare for departure.",
    sub: "Follow the final instructions for your specific itinerary.",
    provide: "Required passenger information and confirmed baggage details.",
    receive: "Private terminal address, local times and trip contact.",
    link: { label: "Charter planning guides", href: "/guides" },
  },
];
