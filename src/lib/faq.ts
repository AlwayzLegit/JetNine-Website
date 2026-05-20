// FAQ catalog — static for now. Moves to CMS or DB later.

export type FaqItem = {
  id: string;
  q: string;
  a: string;
  pullQuote?: string;
};

export type FaqCategory = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const FAQ: FaqCategory[] = [
  {
    id: "booking",
    title: "Booking & quotes",
    items: [
      { id: "q01", q: "How fast can you actually get me a quote?", a: "Inside thirty minutes during business hours. Often a lot faster — most domestic city pairs come back in under fifteen. International, multi-stop, or unusual routings can take up to two hours because the dispatcher is sourcing across multiple operators and checking permitting. The quote you get is specific. Not a price band — three to five named airframes with tail numbers, photos, year of manufacture, operator, and an all-in price.", pullQuote: "P95 quote turnaround, last 12 months: 22 minutes." },
      { id: "q02", q: "What's the latest I can book before a flight?", a: "Six hours wheels-up is reliable for most US city pairs, light jet to heavy. Three hours is achievable on busy lanes (KTEB ↔ KOPF, KVNY ↔ KSFO) where positioned aircraft and crews are abundant. International with customs adds two to four hours of overhead. Below three hours we'll still pick up the phone and try — but the price premium climbs steeply and availability narrows." },
      { id: "q03", q: "Do I need an account to get a quote?", a: "No. The quote form needs a name, contact, route and date — that's it. You'll only create an account if you decide to book, and the dispatcher can do that for you on the phone in two minutes." },
      { id: "q04", q: "Will my information get sent to operators?", a: "No. Operators receive the route, date, passenger count, and category — never your name, contact, or any details that identify you. The dispatcher signs the contract on JetNine's paper, and you sign with us." },
      { id: "q05", q: "Can I book a one-way flight?", a: "Yes — every flight is priced one-way. Most charters in our category are. You're not paying for the aircraft to come back unless you ask us to hold it for a return leg. If your route happens to match an existing repositioning leg, you'll see significant savings on the empty legs board." },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & payment",
    items: [
      { id: "q06", q: "What's actually included in the price?", a: "Everything we can see in advance. Specifically: aircraft & crew time, fuel, all surcharges, Federal Excise Tax (7.5%), segment fees, landing fees, ramp & FBO handling, international handling & customs (where applicable), and standard catering and onboard beverage stock. What's not included: ground transport (we book it; passed through at cost), in-flight catering upgrades above standard, and de-icing if required day-of (rare; charged at operator cost). All of that is itemized on the trip sheet before you sign." },
      { id: "q07", q: "How do I pay?", a: "Bank wire is the default. ACH and credit card are accepted for trips under $50,000 (cards add 3% to cover processor fees — we don't mark this up). Frequent clients can run on net-30 invoicing once a relationship is established. Reserve members and Card holders pay against the deposit balance — the dispatcher debits the trip cost on confirmation, and you see the running balance on your account dashboard." },
      { id: "q08", q: "Do I pay a deposit, or the full amount?", a: "Full payment is required before wheels-up. Industry standard. The dispatcher will give you a clear timeline on the trip sheet — typically wire received 24h before departure for domestic, 48h for international. For larger or repeat clients we'll work with shorter windows. Just ask." },
      { id: "q09", q: "Why does the same route cost different amounts on different days?", a: "Three things, mostly. (1) Demand — Friday afternoon out of KTEB is the most expensive slot in private aviation. (2) Aircraft positioning — if a midsize is finishing a charter and sitting at your departure airport, the price drops. (3) Operator availability — fewer operators willing to release on short notice means a higher floor. The dispatcher will tell you, on the call, which of these is moving the price — and what flexibility on dates or airports would do to it." },
      { id: "q10", q: "Are quotes negotiable?", a: "The quoted price is the operator's price plus our fixed markup. There isn't margin to negotiate down — the markup is the same on a $25,000 trip as on a $250,000 trip, and you can see it on the invoice. What we can do: source again with different parameters. Different airframe, slightly different times, alternate airport pair. That's where price moves, and it's the dispatcher's job to find it." },
    ],
  },
  {
    id: "aircraft",
    title: "Aircraft & cabin",
    items: [
      { id: "q11", q: "How do I know which category I need?", a: "The dispatcher decides this with you on the call. Inputs: number of passengers, route distance, baggage, whether stand-up cabin matters, whether you need a lavatory or just a toilet. We'll quote across two categories if your trip sits on the boundary so you can see the price-vs-comfort tradeoff. Or browse: all six categories side-by-side." },
      { id: "q12", q: "Can I see the specific aircraft before I book?", a: "Yes. Every quote names specific tail numbers. You'll see year of manufacture, cabin photos, year of last refurb, and operator. If you have an aversion to a particular type or operator, the dispatcher will source around it." },
      { id: "q13", q: "Are pets allowed?", a: "On almost every aircraft in our network, yes — and they sit in the cabin with you, not in cargo. Tell the dispatcher: species, weight, whether they're crated, and any handling notes. We source aircraft that allow pets and will note it on the trip sheet so the crew is prepared. International pet travel needs paperwork (health certificates, EU pet passports). The dispatcher will tell you what you need and how far in advance to start." },
      { id: "q14", q: "Will there be Wi-Fi?", a: "Most super-mid, heavy, and ultra-long-range aircraft have Wi-Fi installed. Many midsize do. Light jets and turboprops typically don't. The quote will tell you — and \"Wi-Fi required\" can be set as a preference and we'll only source aircraft that have it. Speed varies. Domestic Ka-band on a heavy is genuinely good (50+ Mbps). Older Ku systems on transoceanic legs are usable for email, not video calls." },
      { id: "q15", q: "What about a flight attendant?", a: "Standard on heavy and ultra-long-range. Optional on super-mid (often included on flights over 4 hours). Available on midsize for a flat add-on (~$1,800–2,500). Light jets and below: not typically." },
    ],
  },
  {
    id: "flight",
    title: "The flight itself",
    items: [
      { id: "q16", q: "How early do I need to arrive at the FBO?", a: "Fifteen minutes is plenty for domestic. The crew is on board, the FBO has your details, you walk straight to the aircraft. International with customs: thirty minutes for departures, sometimes nothing on arrivals (cleared on the ramp)." },
      { id: "q17", q: "Is there security screening?", a: "Not in the TSA sense. Operators verify passenger identity (TSA Twelve-Five Standard Security Program for aircraft over 12,500 lbs) and may check ID at the FBO. No bag X-rays, no shoes off, no liquids restrictions. International outbound flights still go through customs & immigration at the FBO." },
      { id: "q18", q: "Can I bring more bags than the published count?", a: "Probably. Tell the dispatcher in advance and we'll confirm baggage volume on the specific airframe. If you're at the limit on a light jet, sometimes a midsize with a slightly larger hold is the same price." },
      { id: "q19", q: "Can I drive directly to the aircraft?", a: "At most FBOs in our network: yes. Your car is escorted onto the ramp by FBO staff and you transfer at the aircraft. A handful of FBOs (mainly slot-restricted European airports) don't allow ramp access — the dispatcher will tell you on the trip sheet." },
    ],
  },
  {
    id: "international",
    title: "International",
    items: [
      { id: "q20", q: "What does customs look like on a private flight?", a: "Departure: thirty minutes earlier at the FBO so a CBP officer can check passports. Arrival: usually faster than commercial — the officer comes to the aircraft or meets you in the FBO, stamps passports, and you're out the door. Some airports require advance APIS filing (we handle it), some require the GenDec (we handle it), and some smaller fields don't have customs and route you to a nearby AOE first." },
      { id: "q21", q: "Are there destinations you don't fly to?", a: "Sanctioned countries (US OFAC list), active conflict zones, and a handful of fields with structural issues we won't operate into. Everywhere else, we'll find an aircraft and operator. About 5,000 airports worldwide are reliably available; another 5,000 are case-by-case." },
      { id: "q22", q: "Do I need a visa for the crew's stops?", a: "Crew permits are the operator's problem, not yours. Your visa requirements are based on your passport and destination — same as commercial. The dispatcher will flag visa requirements on the trip sheet but recommends checking with your travel attorney for anything non-routine." },
    ],
  },
  {
    id: "changes",
    title: "Changes & cancellations",
    items: [
      { id: "q23", q: "Can I change times or airports after booking?", a: "Yes. Inside 48 hours of departure: usually free for time shifts of a couple hours, sometimes a re-positioning fee for airport changes. Inside 24 hours: depends on the operator and aircraft availability; the dispatcher will quote you the delta before you commit. Adding passengers, catering changes, baggage: free, just call." },
      { id: "q24", q: "What happens if I cancel?", a: "Outside 72 hours: full refund minus a small admin fee. Inside 72 hours: 25% of trip cost. Inside 24 hours: 50% of trip cost. Inside 6 hours: full charter cost. Empty legs and one-off discounted flights have stricter terms — the dispatcher will tell you on the call. Reserve and Card members get more flexibility." },
      { id: "q25", q: "What if you cancel?", a: "If we can't deliver the aircraft we quoted — mechanical, crew, or weather we should have caught — we re-source on our cost and get you in the air. The dispatcher works the phones for as long as it takes; we've put clients on backup aircraft within 90 minutes of a cancellation. Weather no-go is a different beast. Safety calls we don't argue with. You get a full refund and we'll re-fly when the weather clears." },
    ],
  },
  {
    id: "safety",
    title: "Safety & standards",
    items: [
      { id: "q26", q: "How do you vet operators?", a: "Hard floor: ARG/US Gold Plus or Wyvern Wingman. Plus a JetNine review of the operator's last five years of FAA enforcement actions, insurance coverage ($300M minimum), and pilot experience minimums. Roughly 12% of US Part 135 carriers clear our floor. Full standards: safety page." },
      { id: "q27", q: "Are there always two pilots?", a: "Yes. Single-pilot operations exist in Part 135 — we don't allow them on JetNine flights regardless of the aircraft type. Both pilots type-rated on the airframe, both current, both meeting our duty-time standards." },
      { id: "q28", q: "What's your insurance coverage?", a: "$300M combined single-limit liability minimum on every trip. Most heavy and ULR aircraft in our network carry $500M to $1B. Specifics on the trip sheet." },
    ],
  },
  {
    id: "memberships",
    title: "Memberships",
    items: [
      { id: "q29", q: "Should I join Reserve or Card?", a: "Quick math. If you fly 25 hours a year and want price certainty: Card. If you fly 50+ hours and want guaranteed availability with shorter call-out windows: Reserve. If you fly under 25 hours: stay on-demand. Membership only pays back at volume. Full breakdown: memberships page." },
      { id: "q30", q: "Does the deposit expire?", a: "No. Card balances roll forward indefinitely. If you fly less than expected one year, the balance is still there next year at the same locked rates." },
      { id: "q31", q: "Can I refund the unused deposit?", a: "Yes, anytime, with 30 days' notice. We'll refund the unused balance minus an admin fee. No questions asked, no retention sequence." },
    ],
  },
];

export const FAQ_QUICK_TAGS = ["Deposit", "Pets", "Wi-Fi", "Cancellation", "Catering", "Customs"];

export function matchesQuery(item: FaqItem, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle)
  );
}
