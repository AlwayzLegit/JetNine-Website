// The one tool of the site chat: start_quote (OPS-242). It fills the quote form's
// first step with what the visitor said and sends nothing (OWASP LLM06: no
// excessive agency). The visitor presses a button, finishes the form and sends it.
import type { QuoteStart } from "@/lib/start-quote";

export const START_QUOTE_TOOL = {
  name: "start_quote",
  description:
    "Offer the visitor a button that opens the quote form with their trip filled in. Call it only when the visitor has said where they want to fly and how many people. It sends nothing.",
  input_schema: {
    type: "object",
    properties: {
      trip: { type: "string", enum: ["oneway", "roundtrip", "multileg"] },
      pax: { type: "integer", minimum: 1, maximum: 100, description: "Number of passengers." },
      from: { type: "string", description: "Departure airport code or city, as the visitor said it." },
      to: { type: "string", description: "Arrival airport code or city, as the visitor said it." },
      depart: { type: "string", description: "Departure date, yyyy-mm-dd, only if the visitor gave one." },
      return: { type: "string", description: "Return date, yyyy-mm-dd, only for a round trip and only if given." },
    },
    required: ["trip", "pax"],
    additionalProperties: false,
  },
} as const;

const TRIPS = new Set(["oneway", "roundtrip", "multileg"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACE = /^[\p{L}\p{N} .,'()/-]{2,60}$/u;

function place(v: unknown): string | undefined {
  return typeof v === "string" && PLACE.test(v.trim()) ? v.trim() : undefined;
}

function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !DATE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

/**
 * The model's tool arguments mapped to the QuoteStart shape, or null when they are
 * not usable. Model output is data: every field is checked, anything else is dropped.
 */
export function toQuoteStart(input: unknown): QuoteStart | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.trip !== "string" || !TRIPS.has(o.trip)) return null;
  const pax = typeof o.pax === "number" ? o.pax : Number.NaN;
  if (!Number.isInteger(pax) || pax < 1 || pax > 100) return null;
  const start: QuoteStart = { trip: o.trip as QuoteStart["trip"], pax };
  const from = place(o.from);
  const to = place(o.to);
  const depart = isoDate(o.depart);
  const ret = start.trip === "roundtrip" ? isoDate(o.return) : undefined;
  if (from) start.from = from;
  if (to) start.to = to;
  if (depart) start.depart = depart;
  if (ret) start.return = ret;
  return start;
}
