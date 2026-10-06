// The charter pricing guide — chapter registry. Drives the /guides hub,
// per-chapter prev/next navigation, and sitemap entries, so adding a
// chapter is one entry here plus its page file.
//
// Strategy (four-broker audit): one canonical cost page drives ~30% of
// the two closest competitors' entire organic traffic — and neither of
// them prints a real price. Every chapter here carries actual figures
// from the shared rate card and quote engine.
export type GuideChapter = {
  slug: string;
  href: string;
  /** 1-based chapter number, order of the registry. */
  chapter: number;
  /** Full page H1 / hub card heading. */
  title: string;
  /** Short label for prev/next + hub nav. */
  navTitle: string;
  description: string;
};

const CHAPTERS: Omit<GuideChapter, "chapter" | "href">[] = [
  {
    slug: "private-jet-charter-cost",
    title: "How much does a private jet charter cost?",
    navTitle: "What charter costs",
    description:
      "The whole answer with real numbers: hourly rates by category, a fully itemized $47,260 quote, per-passenger math, and how to pay less.",
  },
  {
    slug: "private-jet-cost-per-hour",
    title: "Private jet cost per hour, by category.",
    navTitle: "Cost per hour",
    description:
      "Market and locked hourly rates for all six categories, what an hour includes, and why a heavy jet costs three times a light jet.",
  },
  {
    slug: "one-way-vs-round-trip",
    title: "Is one-way cheaper than a round trip?",
    navTitle: "One-way vs round trip",
    description:
      "Usually, but rarely half — the aircraft flies home either way. How repositioning economics set the price, and when an empty leg beats both.",
  },
  {
    slug: "last-minute-private-jet",
    title: "What a last-minute private jet costs.",
    navTitle: "Last-minute charter",
    description:
      "Same-day and next-day missions: what changes about price, what changes about availability, and the one lever that cuts the cost instead of raising it.",
  },
  {
    slug: "what-affects-charter-price",
    title: "What actually moves a charter price.",
    navTitle: "Price drivers",
    description:
      "The six line items behind every quote — aircraft time, fuel, repositioning, crew and catering, FET, ground — and which ones you can influence.",
  },
];

export const GUIDE_CHAPTERS: GuideChapter[] = CHAPTERS.map((c, i) => ({
  ...c,
  chapter: i + 1,
  href: `/guides/${c.slug}`,
}));

export function getGuideChapter(slug: string): GuideChapter | undefined {
  return GUIDE_CHAPTERS.find((c) => c.slug === slug);
}

// Long-form planning guides (light redesign). Separate from the pricing
// chapters above so the chapter count, prev/next and hub numbering stay
// as they are. Each entry is one static route under /guides/<slug>.
export type LongGuide = {
  slug: string;
  href: string;
  /** Page H1. */
  title: string;
  /** Short label for crumbs, cards and links. */
  navTitle: string;
  description: string;
  /** Card / hero image under /public. */
  image: string;
};

const LONG: Omit<LongGuide, "href">[] = [
  {
    slug: "private-jet-charter-guide",
    title: "Private Jet Charter: A Complete Beginner’s Guide",
    navTitle: "Beginner’s guide",
    description:
      "New to private jet charter? Learn how it works, understand costs, compare aircraft, check operators and prepare for your first flight with JetNine.",
    image: "/images/light/page-03-hero.webp",
  },
  {
    slug: "how-to-book-a-private-jet",
    title: "How to Book a Private Jet Charter",
    navTitle: "How to book a private jet",
    description:
      "Learn how to book a private jet charter, from requesting aircraft options and reviewing your quote to confirming your booking and preparing for departure.",
    image: "/images/light/golden-hour-boarding.webp",
  },
  {
    slug: "private-jet-broker-vs-operator",
    title: "Private Jet Charter Broker vs. Aircraft Operator",
    navTitle: "Broker vs. operator",
    description:
      "Understand how private jet charter brokers and aircraft operators differ, who operates your flight, and which documents and disclosures to check.",
    image: "/images/light/page-29-hero.webp",
  },
  {
    slug: "private-jet-charter-fees",
    title: "Private Jet Charter Fees and Additional Charges",
    navTitle: "Charter fees",
    description:
      "Understand private jet charter fees, including repositioning, deicing, catering and parking. Learn what to confirm before approving your quote.",
    image: "/images/light/page-30-hero.webp",
  },
  {
    slug: "how-to-choose-a-charter-company",
    title: "How to Choose a Private Jet Charter Company",
    navTitle: "Choosing a charter company",
    description:
      "Compare private jet charter providers on operator transparency, service, complete pricing and booking terms. Use practical questions before choosing a company.",
    image: "/images/light/page-25-hero.webp",
  },
  {
    slug: "how-to-compare-private-jet-quotes",
    title: "How to Read and Compare Private Jet Charter Quotes",
    navTitle: "Comparing charter quotes",
    description:
      "Compare private jet charter quotes on equivalent aircraft, itinerary, services, total pricing and terms. Learn which exclusions and changes to clarify.",
    image: "/images/light/page-27-hero.webp",
  },
  {
    slug: "empty-legs-explained",
    title: "Empty Leg Flights Explained",
    navTitle: "Empty legs explained",
    description:
      "Learn how empty leg flights work, why pricing can differ, and how availability, route restrictions and cancellation terms affect your travel plans.",
    image: "/images/light/page-28-hero.webp",
  },
  {
    slug: "private-jet-sizes-and-types",
    title: "Private Jet Sizes and Aircraft Types Explained",
    navTitle: "Private jet sizes",
    description:
      "Compare light, midsize, super-midsize and heavy private jets. Learn what to check for cabin comfort, baggage, range and your actual itinerary.",
    image: "/images/light/page-24-hero.webp",
  },
  {
    slug: "private-jet-charter-safety-checklist",
    title: "Private Jet Charter Safety: What to Verify",
    navTitle: "Charter safety checklist",
    description:
      "Use a private jet charter safety checklist to request operator credentials, aircraft details, crew information and insurance evidence before booking.",
    image: "/images/light/ground-service-golden-hour.webp",
  },
];

export const LONG_GUIDES: LongGuide[] = LONG.map((g) => ({ ...g, href: `/guides/${g.slug}` }));

export function getLongGuide(slug: string): LongGuide {
  const g = LONG_GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`Unknown long-form guide: ${slug}`);
  return g;
}

// Independent authorities the guides cite (handoff AUTHORITY-SOURCES).
// None of them endorses JetNine; pages say so next to every list.
export const GUIDE_AUTHORITIES = {
  faa: {
    name: "FAA — Charter authorization",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
    used: "Ask to see the operating certificate and confirm charter authorization; do not transfer operational control casually.",
  },
  nbaa: {
    name: "NBAA — Charter quote checklist",
    url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/",
    used: "Operator, aircraft, crew, total price, extra charges, changes and cancellation questions.",
  },
  dot: {
    name: "U.S. DOT / eCFR — Air charter brokers",
    url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295",
    used: "Broker capacity, operating-carrier identity, insurance and requested cost disclosures; U.S. scope.",
  },
  aca: {
    name: "The Air Charter Association — Using a broker",
    url: "https://www.theaircharterassociation.aero/why-charter/aircharterbroker/",
    used: "Sourcing, coordination and the role of a charter broker.",
  },
  winter: {
    name: "FAA — Winter operations",
    url: "https://www.faa.gov/blog/clearedfortakeoff/frost-flight",
    used: "Safety purpose of aircraft de-icing and winter preparation.",
  },
} as const;
