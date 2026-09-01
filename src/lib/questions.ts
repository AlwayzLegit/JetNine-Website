// Question hub registry — one entry per standalone question page
// (/questions/{slug}) plus the categorized hub. The audited pattern:
// VistaJet's 42 question-slug pages earn snippet traffic with no
// FAQPage schema on any of them; we clone the architecture at small
// scale with the schema they forgot, answer-shaped (question as H1,
// one-line answer first) for snippets and AI answers alike.
//
// Every figure here comes from the site's published claims — the rate
// card, the guarantee, the vetting floor, fleet ranges. No new facts.
export type Question = {
  slug: string;
  category: string;
  /** The literal question — page H1 and hub label. */
  q: string;
  /** One-line answer, number-first where applicable. Rendered first and
   *  used as the FAQPage answer head + meta description. */
  short: string;
  /** Body paragraphs, plain text. */
  body: string[];
  /** Cross-links into the site's proof and pricing pages. */
  goDeeper: { label: string; href: string }[];
  /** Optional checklist items (rendered as a checkmarked list). */
  checklist?: string[];
};

export const QUESTION_CATEGORIES = [
  "The broker",
  "The money",
  "The flying",
  "Before you book",
] as const;

export const QUESTIONS: Question[] = [
  // ── The broker ──
  {
    slug: "what-does-a-private-jet-broker-do",
    category: "The broker",
    q: "What does a private jet broker do?",
    short:
      "A broker doesn't own aircraft — it sources, vets, and negotiates them for you from the operators that do, then stands behind the trip. The product is judgment: which airframes to trust, at what price, and what to do when something goes sideways.",
    body: [
      "In the US, nearly every private flight is operated by an FAA Part 135 certificated carrier — the company that owns the aircraft, employs the crew, and holds the operating certificate. A broker (formally, a Part 295 indirect air carrier registered with the DOT — that's what JetNine is) sits between you and roughly 5,000 of those operators. For any mission, dozens could technically fly it. The broker's job is knowing which of them should.",
      "The work has three layers. Before you ever call: vetting — auditing operators' certificates, insurance, pilots, maintenance, and safety records, and dropping the ones that fail. When you request a trip: sourcing — pulling real availability from the vetted network, negotiating the rate, and returning specific airframes with all-in pricing (ours come back within 30 minutes). And after you book: accountability — trip-level checks before wheels-up, and a remedy in writing if the operator fails the call-out. We publish ours: substitute aircraft at no charge, commercial first-class, or flight credit.",
      "What separates brokers is how seriously they take the first layer. Anyone can resell the same 5,000 operators; our vetting funnel approves 380 of them, re-audits every twelve months, and holds a one-strike policy on safety events. A broker that displays certification logos but can't tell you its floor is a travel agent with a nicer website.",
      "The honest caveat: a broker adds a margin. What you're buying with it is the vetting, the negotiating leverage of repeat volume, the 24/7 desk, and someone whose problem it is when fuel spikes or an operator cancels. If you fly the same tail on the same lane every week, a direct operator relationship can make sense — and a good broker will tell you so.",
    ],
    goDeeper: [
      { label: "How we vet operators", href: "/safety/operator-vetting" },
      { label: "How to choose a broker", href: "/questions/how-do-i-choose-a-private-jet-broker" },
      { label: "How it works, end to end", href: "/how-it-works" },
    ],
  },
  {
    slug: "how-do-i-choose-a-private-jet-broker",
    category: "The broker",
    q: "How do I choose a private jet broker?",
    short:
      "Ask four questions: What's your written safety floor? Will you show me real prices before I commit? What happens, specifically, if the operator fails? And who answers the phone at 2am? A good broker answers all four without flinching.",
    body: [
      "The safety floor question separates policy from decoration. Every broker shows ARG/US and Wyvern logos; ask whether the rating is a requirement (no operator flies without it) or a description (some operators happen to have it). Ask how often operators are re-checked and what removes one from the network. If the answer is vague, the floor is too.",
      "The pricing question is simpler: a broker confident in its rates publishes them. Ours are on the site — $2,950 to $9,850 an hour locked by category, market ranges alongside — and every quote is all-in with the 7.5% federal excise tax printed on it. A quote that needs a callback to become a number isn't a quote; it's a lead form.",
      "The failure question matters most and gets asked least. Operators cancel — weather, maintenance, crew timing. The difference between brokers is whether the remedy is written down before you book. Ask for it in writing; we publish ours on the memberships page, and it doesn't require a membership.",
      "And the 2am question: charter problems don't keep office hours. A desk that answers live, around the clock, with the same dispatcher who built your trip, is worth more than any lounge perk.",
    ],
    goDeeper: [
      { label: "The written safety floor", href: "/safety" },
      { label: "The published rate card", href: "/cost-calculator" },
      { label: "The guarantee, in writing", href: "/memberships" },
    ],
  },
  {
    slug: "do-i-need-a-membership-to-charter",
    category: "The broker",
    q: "Do I need a membership to charter a private jet?",
    short:
      "No. On-demand charter — pay per flight, no commitment, no annual fee — is the default, and at JetNine it books at the same desk with the same aircraft as every program we run.",
    body: [
      "Membership programs exist because some flyers want two things on-demand can't promise: hourly rates locked against the market, and guaranteed availability on short call-out windows. If you fly 25+ hours a year on predictable lanes, locking $2,950–$9,850 per hour by category for 24 months is real money. Below that, the math rarely closes — and we'll tell you so.",
      "What a membership never should be is a toll booth in front of a price. Everything on this site — the rate card, the cost calculator, the route pages, the quote wizard — works for a first-time flyer with no account. The wizard returns live indicative pricing in four steps; a senior dispatcher confirms exact airframes within 30 minutes. No callback required, no card on file.",
    ],
    goDeeper: [
      { label: "Three ways to fly, compared", href: "/memberships" },
      { label: "Price a mission now", href: "/quote/mission" },
    ],
  },
  {
    slug: "how-far-in-advance-should-i-book",
    category: "Before you book",
    q: "How far in advance should I book a private jet?",
    short:
      "For choice: a week or more. For a flight at all: hours. Charter rates don't rise as the date approaches the way airline fares do — what shrinks late is the selection of airframes in position, not the rate card.",
    body: [
      "Booking early buys options, not discounts. A week out, dispatch can usually offer the exact category you want at the airport you want; peak dates — holiday weekends, Aspen Saturdays in ski season, fight nights in Vegas — are the exception, and those can sell the local fleet out days ahead.",
      "Booking late is still routine: same-day departures happen daily at major markets, limited only by crew duty time and what's parked nearby. The quote itself always takes 30 minutes or less during operating hours. And if your dates are genuinely loose, late booking flips into an advantage — empty legs list days or hours before departure at 30–60% off.",
    ],
    goDeeper: [
      { label: "Last-minute charter, honestly", href: "/guides/last-minute-private-jet" },
      { label: "The live empty-legs board", href: "/empty-legs" },
    ],
  },
  // ── The money ──
  {
    slug: "why-do-charter-quotes-differ-between-brokers",
    category: "The money",
    q: "Why do charter quotes differ between brokers?",
    short:
      "Three reasons: what's included, which operators were asked, and when the price can still move. Two quotes for the same trip can differ by thousands and both be 'right' — until you compare them all-in, at acceptance, from comparable operators.",
    body: [
      "Inclusion is the big one. A bare hourly rate looks great until fuel surcharge, crew overnight, landing fees, catering, de-icing, and the 7.5% federal excise tax arrive as separate lines. Always compare the number you'd actually pay. Ours is all-in by policy: fuel, crew, landing, repositioning, FET, standard catering, sedan transfer — printed on the quote.",
      "Operator pool matters just as much. A quote sourced from an operator with a lapsed audit or thin insurance will beat one sourced from an ARG/US Platinum operator with $500M coverage — that's not a better deal, it's a different product. Ask any broker which operator is behind the number and what floor they cleared.",
      "And timing: some quotes float until signature, so the fuel spike between quote and booking becomes your problem. Ours lock at acceptance — the number you accept is the number on the invoice, and variance after that is our cost, not yours.",
    ],
    goDeeper: [
      { label: "The six lines behind every quote", href: "/guides/what-affects-charter-price" },
      { label: "The published rate card", href: "/cost-calculator" },
    ],
  },
  {
    slug: "what-is-a-jet-card",
    category: "The money",
    q: "What is a jet card?",
    short:
      "A prepaid charter account with locked hourly rates and guaranteed call-out availability — you deposit a fixed amount, fly against it at fixed rates, and skip the quote-negotiate cycle on every trip.",
    body: [
      "The mechanics: choose a deposit tier, and the card locks hourly rates by category for its term — ours run $2,950 (light) to $9,850 (ultra-long-range) locked for 24 months, with call-out windows for guaranteed availability and no peak-day surcharges. The deposit draws down as you fly; ours stays refundable.",
      "Whether it's worth it is arithmetic, not marketing: the value is the spread between the locked rate and the market on the days you actually fly, times your hours. At 25+ hours a year on predictable missions it usually clears. Below that, on-demand wins — and a card that costs you flexibility you'd otherwise use (empty legs, category shopping per trip) can be worth less than no card at all.",
    ],
    goDeeper: [
      { label: "Card tiers and locked rates", href: "/memberships" },
      { label: "Cost per hour, explained", href: "/guides/private-jet-cost-per-hour" },
    ],
  },
  {
    slug: "what-is-federal-excise-tax-on-charter",
    category: "The money",
    q: "What is the federal excise tax on charter flights?",
    short:
      "7.5% of the charter price, on every domestic US flight, whoever you book with. It's federal law, not a broker fee — a quote that doesn't show it isn't cheaper, it's incomplete.",
    body: [
      "The FET applies to domestic commercial air transportation, which charter is. It's calculated on the amount paid for the flight; on our sample transcon itemization it's the $3,300 line on a $47,260 trip. International flights are structured differently (segment fees and international facility charges rather than the 7.5%), which your quote itemizes when it applies.",
      "The practical use of knowing this: it's a fast honesty test for quotes. Any domestic quote should carry the line, computed and visible. If it appears only after you commit, ask what else does.",
    ],
    goDeeper: [
      { label: "A real itemized quote", href: "/guides/private-jet-charter-cost" },
      { label: "Every price driver", href: "/guides/what-affects-charter-price" },
    ],
  },
  {
    slug: "what-is-block-time",
    category: "The money",
    q: "What is block time, and why am I billed on it?",
    short:
      "Block time runs from engine start at the departure ramp to shutdown at arrival — taxi, climb, cruise, descent, all of it. It's the industry's billing unit because it's what the aircraft and crew actually spend.",
    body: [
      "The difference from 'flight time' matters on short legs: a 45-minute hop can be an hour-plus of block once taxi and departure sequencing are counted, and at $3,000+ per hour the distinction is real money. Our indicative engine pads great-circle flight time for exactly this, which is why wizard estimates track final quotes closely instead of surprising you upward.",
      "Block time is also why the faster airframe sometimes wins on price: past roughly 1,500 NM, a super-mid's speed can buy back enough billed hours to beat a cheaper hourly in a slower cabin — the wizard runs that math per route automatically.",
    ],
    goDeeper: [
      { label: "Cost per hour, by category", href: "/guides/private-jet-cost-per-hour" },
      { label: "Run your route", href: "/cost-calculator" },
    ],
  },
  // ── The flying ──
  {
    slug: "how-far-can-a-light-jet-fly",
    category: "The flying",
    q: "How far can a light jet fly?",
    short:
      "About 1,600 to 2,200 nautical miles with reserves — Los Angeles to Seattle nonstop with margin, New York to Miami easily, coast-to-coast only with a fuel stop.",
    body: [
      "The airframes on our board bracket the range: a Phenom 300E does about 2,010 NM, a Citation CJ4 about 2,165, a Learjet 75 Liberty about 2,040 — all at 450+ knots with six or seven aboard. Real-world reach depends on load and winds; a full cabin flying westbound into winter headwinds lands short of the brochure number, which is why dispatch plans with reserves rather than optimism.",
      "Rule of thumb for the category: legs up to about three hours are the light jet's home turf, and it does them at the lowest jet hourly on the card. Past 2,000 NM, the honest quote is usually a midsize or super-mid — nonstop beats a fuel stop on both the clock and, often, the total.",
    ],
    goDeeper: [
      { label: "Light jet charter — rates & specs", href: "/aircraft/light" },
      { label: "Compare every category", href: "/aircraft" },
    ],
  },
  {
    slug: "can-i-bring-my-dog-on-a-private-jet",
    category: "The flying",
    q: "Can I bring my dog on a private jet?",
    short:
      "Yes — in the cabin, uncrated on most airframes, no cargo hold involved. Pet policy belongs to each operator, so tell dispatch when you quote and we source an airframe that welcomes yours.",
    body: [
      "This is one of charter's genuinely better answers: no carrier under a seat, no cargo manifest, no tranquilizer debate. Most operators in our network fly pets in the cabin routinely; some tails have restrictions by size or count, and a cleaning fee can apply — both itemized before you accept, never discovered after.",
      "Two practical notes from the desk. International missions add documentation (health certificates, destination rules) — dispatch walks the requirements with the quote. And our empty-legs board flags pet-friendly legs, so the discount inventory works for four-legged passengers too.",
    ],
    goDeeper: [
      { label: "Price a trip, pet included", href: "/quote/mission" },
      { label: "The empty-legs board", href: "/empty-legs" },
    ],
  },
  {
    slug: "is-flying-private-safe",
    category: "The flying",
    q: "Is flying private safe?",
    short:
      "Charter safety is a floor you choose. Part 135 operators range widely — which is why we approve 380 of roughly 5,000, require ARG/US Gold or better on every flight, and re-audit annually. On that floor, you're flying the audited top of the industry.",
    body: [
      "The honest framing: 'private aviation' spans everything from meticulously run flight departments to operators a hangar visit disqualifies in an hour. The variance is the risk — and vetting is how it's removed. Every airframe we quote flies for an operator that cleared certification and insurance filters ($300–500M liability floors), current third-party audits, pilot minimums (two ATP-rated pilots, 3,500-hour PIC floor), and an in-person operations visit. Roughly half the operators that look good on paper don't survive that visit.",
      "The checks don't stop at approval: documents are re-reviewed and sites re-visited every twelve months, a trip-level review runs before every booking (crew duty time, maintenance status, weather, alternates), and one safety strike removes an operator. Ask any broker for the same specifics; the answer tells you what floor you're flying on.",
    ],
    goDeeper: [
      { label: "The written safety floor", href: "/safety" },
      { label: "The vetting funnel, filter by filter", href: "/safety/operator-vetting" },
      { label: "Who's flying you", href: "/safety/pilot-standards" },
    ],
  },
  {
    slug: "how-do-empty-leg-flights-work",
    category: "The flying",
    q: "How do empty leg flights work?",
    short:
      "An aircraft that dropped its passengers has to fly home — that repositioning flight goes on sale at 30–60% off. Same airframe, same crew, same safety floor; the trade is a locked date and route.",
    body: [
      "The mechanics in one pass: an outbound charter creates the leg, the operator lists it (ours hit the board within fifteen minutes of listing), and the first confirmed booking takes it — legs aren't held or waitlisted. If the outbound charter that created the leg cancels, the leg cancels with it: your payment is refunded in full plus a credit toward a regular charter, but you'll want a backup plan for anything time-critical.",
      "The way to actually catch one: a watchlist. Set your city pair and date window and we match it against the live board every fifteen minutes, then text the moment a leg fits — one SMS per match, no marketing, cancel any time. No competitor offers route alerts at all; it's the difference between browsing a board and having the board watch for you.",
    ],
    goDeeper: [
      { label: "The live board + watchlist", href: "/empty-legs" },
      { label: "One-way vs round-trip economics", href: "/guides/one-way-vs-round-trip" },
    ],
  },
  // ── Before you book ──
  {
    slug: "what-happens-if-my-flight-is-canceled",
    category: "Before you book",
    q: "What happens if my charter flight is canceled?",
    short:
      "With us, one of three written remedies: a substitute aircraft at no additional charge, commercial first-class rebooking, or a full refund plus flight credit. The remedy exists in writing before you book — that's the point.",
    body: [
      "Operator call-out failures are rare and real: mechanical findings, crew timing, weather positioning. What separates charter experiences isn't whether that ever happens — it's whether anyone wrote down what happens next. Our guarantee is published, applies without a membership, and doesn't require a negotiation while you're standing on a ramp.",
      "Refunds follow the same policy: err on the client's side, written the same day. If a refund conversation ever feels like a fight, something has gone wrong on our end — and we treat it that way.",
    ],
    goDeeper: [
      { label: "The guarantee, in full", href: "/memberships" },
      { label: "How the desk works", href: "/how-it-works" },
    ],
  },
  {
    slug: "private-jet-charter-checklist",
    category: "Before you book",
    q: "What should I check before chartering a private jet?",
    short:
      "Ten questions, five minutes, most of the industry's bad experiences avoided. Run any broker — us included — through this list before you book.",
    body: [
      "The list below is the one we'd want a client to bring to any desk. A broker that answers all ten quickly is telling you something; a broker that stalls on three of them is telling you more.",
    ],
    checklist: [
      "Is the quote all-in — fuel, crew, landing fees, repositioning, and the 7.5% FET printed on it?",
      "Is the price locked at acceptance, or can it move before departure?",
      "Which operator flies the trip, and what certificate do they hold?",
      "What third-party safety rating does that operator carry — and is it a requirement or a coincidence?",
      "What are the pilot minimums — hours, type rating, two-crew?",
      "What insurance does the operator carry, and is a certificate available before booking?",
      "What is the written remedy if the operator fails the call-out?",
      "What's the cancellation and refund policy, in writing?",
      "Who do you call mid-trip, and do they answer around the clock?",
      "Are catering, ground transfer, and pet or baggage fees itemized before acceptance?",
    ],
    goDeeper: [
      { label: "Our answers to all ten", href: "/how-it-works" },
      { label: "The safety floor", href: "/safety" },
      { label: "The rate card", href: "/cost-calculator" },
    ],
  },
];

export function getQuestion(slug: string): Question | undefined {
  return QUESTIONS.find((q) => q.slug === slug);
}

export function relatedQuestions(question: Question, limit = 3): Question[] {
  const sameCat = QUESTIONS.filter(
    (q) => q.slug !== question.slug && q.category === question.category,
  );
  const rest = QUESTIONS.filter(
    (q) => q.slug !== question.slug && q.category !== question.category,
  );
  return [...sameCat, ...rest].slice(0, limit);
}
