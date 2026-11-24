// The facts the site chat may use (OPS-242). Every line is something the site
// already says in its own pages or constants; the chat adds nothing. There is
// no price, rate, discount or timing promise in here, and a test fails if a
// money amount ever appears. TODO(human): attorney or owner review is not
// needed for facts the site already publishes, but a person should read this
// list before go-live.
import { SITE } from "@/lib/constants";

export const CHAT_LINKS = {
  cost: "/cost-calculator",
  contact: "/contact",
  guides: "/guides",
  aircraft: "/aircraft",
  howItWorks: "/how-it-works",
  safety: "/safety",
  bookingGuide: "/guides/how-to-book-a-private-jet",
  firstFlight: "/guides/first-private-jet-flight",
  costGuide: "/guides/private-jet-charter-cost",
} as const;

export const FACTS: readonly string[] = [
  `${SITE.brand} is a private jet charter broker. ${SITE.legal.part295}`,
  "Dispatch is available 24/7. The contact page (/contact) has the dispatch phone and the contact form, and the email is " +
    `${SITE.email}. The dispatch phone is ${SITE.dispatchPhone}.`,
  "Aircraft are grouped by cabin class: Turboprop, Light, Midsize, Super-mid, Heavy and Ultra long range. The aircraft page (/aircraft) compares them.",
  `How booking works: a visitor sends a trip brief (route, dates, passengers) through the quote form, compares the options that come back, and confirms. The page ${CHAT_LINKS.howItWorks} explains each step.`,
  `For any price or cost estimate, the cost calculator (${CHAT_LINKS.cost}) and the pricing guide (${CHAT_LINKS.costGuide}) are the places to look. The chat never states a price.`,
  `The booking checklist is at ${CHAT_LINKS.bookingGuide}, and a guide for a first private flight is at ${CHAT_LINKS.firstFlight}. More guides: ${CHAT_LINKS.guides}.`,
  `Safety and operator vetting are explained at ${CHAT_LINKS.safety}.`,
  "Empty-leg flights are listed at /empty-legs. Whether a specific flight is available can only be confirmed by dispatch.",
  "Availability of a specific aircraft on a specific date can only be confirmed by dispatch, after a quote request.",
];

export const FACTS_TEXT = FACTS.map((f) => `- ${f}`).join("\n");
