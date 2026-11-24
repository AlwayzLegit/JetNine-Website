// Output and input guards of the site chat (OPS-242). OWASP LLM Top 10: LLM02
// (no personal data in the chat) and LLM09 (no invented price).

export const PRICE_REPLACEMENT = "For a price, the cost calculator gives an estimate: /cost-calculator.";

export const PERSONAL_DETAILS_NOTICE =
  "Please do not share personal details here. For anything personal, use the contact form: /contact.";

// A money amount: a currency sign, a currency word, or a number "an hour".
// Deliberately wide: a false hit swaps one sentence for the calculator link, a
// miss would put a price in the chat's mouth.
const MONEY = new RegExp(
  [
    String.raw`[$€£¥]`,
    String.raw`\b(?:usd|eur|gbp|dollars?|euros?|pounds? sterling|bucks)\b`,
    String.raw`\d[\d,.]*\s?(?:k|thousand|million)?\s?(?:an|per|\/)\s?(?:hour|hr)\b`,
    String.raw`\b(?:hourly|per[- ]hour) rate\b`,
  ].join("|"),
  "i",
);

/** True when the text holds a money amount or a rate. */
export function hasMoney(text: string): boolean {
  return MONEY.test(text);
}

/**
 * Ends the answer where a money amount starts: keeps whole sentences before it
 * and puts the fixed calculator line in its place. Text without money comes back unchanged.
 */
export function guardAnswer(text: string): { text: string; guarded: boolean } {
  const m = MONEY.exec(text);
  if (!m) return { text, guarded: false };
  const before = text.slice(0, m.index);
  const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  const kept = cut >= 0 ? before.slice(0, cut + 1).trim() : "";
  return { text: kept ? `${kept}\n\n${PRICE_REPLACEMENT}` : PRICE_REPLACEMENT, guarded: true };
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Ten or more digits once spaces, dots, dashes and brackets are ignored, or a local "555-0199".
const PHONE = /(?:\+?\d[\s().-]?){10,}|\b\d{3}[-. ]\d{4}\b/;
// A date the visitor gives for a trip (2026-12-05) is not a phone number.
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

/** True when a visitor's message holds an email address or a phone number. */
export function hasPersonalDetails(text: string): boolean {
  const t = text.replace(ISO_DATE, " ");
  return EMAIL.test(t) || PHONE.test(t);
}
