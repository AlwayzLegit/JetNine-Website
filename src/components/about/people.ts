// Founders and desk for /about — carried over from the previous page
// (the light prototype's names match). Founder portraits are still to
// be supplied; the page shows initials discs until then.

export type Founder = {
  initials: string;
  name: string;
  /** Short role line from the light prototype. */
  role: string;
  focus: string;
  /** Full title, used in the Person JSON-LD (unchanged from before). */
  jobTitle: string;
  bio: string[];
};

export const FOUNDERS: Founder[] = [
  {
    initials: "AA",
    name: "Anna Agadzhanyan",
    role: "Founder & CEO",
    focus: "Dispatch lead",
    jobTitle: "Founder, CEO · Dispatch lead",
    bio: [
      "Anna runs the dispatch side of the company — the desk, the operator relationships, the standard for what a quote has to look like before it leaves the building.",
      "Her view of the business is unromantic: show up early, work the phones, vet every operator personally, refund without arguing. The dispatch culture comes from her.",
    ],
  },
  {
    initials: "AD",
    name: "Arman Adamson",
    role: "Co-founder & COO",
    focus: "Operations lead",
    jobTitle: "Co-founder, COO · Operations lead",
    bio: [
      "Arman owns the back end of the operation: operator network, audit cycle, finance, regulatory. He is the reason the Part 295 disclosure on every contract is in plain English.",
      "Operations is where charter brokerages quietly fail. His job is making sure the unglamorous parts — vetting, paperwork, insurance verification — hold to the same standard as the front desk.",
    ],
  },
];

export const TEAM = [
  { initials: "DG", name: "Daniel Garcia", role: "Senior dispatcher", meta: "East & Mid-Atlantic" },
  { initials: "RP", name: "Renata Padilla", role: "Senior dispatcher", meta: "Latin America" },
  { initials: "JL", name: "James Lee", role: "Senior dispatcher", meta: "Europe" },
  { initials: "SS", name: "Sarah Smith", role: "Dispatcher", meta: "Pacific Northwest" },
  { initials: "AT", name: "Aamir Tyler", role: "Dispatcher", meta: "Asia & Middle East" },
  { initials: "CA", name: "Catalina Anderson", role: "Senior dispatcher", meta: "West Coast" },
  { initials: "EM", name: "Eli Morison", role: "Dispatcher · nights", meta: "24h desk" },
  { initials: "PF", name: "Patrice Fields", role: "Chief pilot", meta: "Operator vetting" },
];
