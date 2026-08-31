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
      "The six line items behind every quote — airframe time, fuel, repositioning, crew and catering, FET, ground — and which ones you can influence.",
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
