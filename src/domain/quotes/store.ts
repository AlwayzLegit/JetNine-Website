import { d1Db, dbTarget } from "@/db";
import type { AirportRow } from "@/lib/airport-rows";
import type { NewQuote, NewQuoteLeg } from "@/db/schema/quotes";
import { d1QuoteStore } from "./store-d1";
import { pgQuoteStore } from "./store-pg";

// The quote domain's one door to the database for the public half of
// "quotes and requests" (OPS-153): the quote wizard's submit (idempotency
// lookup, the quote with its code, any missing airports, the legs), the client's
// request page (the quote by its status token, its legs, options, dispatcher,
// trip) and the client choosing an option. There is one adapter per database,
// chosen per request by dbTarget(): Postgres until the move, D1 where DB_TARGET
// is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). The desk's request commands, the SLA watch and the reports
// export stay on Postgres: they are the next row of the move.

/** The same quote already exists under this client idempotency key. */
export class DuplicateIdempotencyKey extends Error {
  constructor() {
    super("duplicate client idempotency key");
    this.name = "DuplicateIdempotencyKey";
  }
}

/** A quote found by its idempotency key: what the submit hands back on a retry. */
export type ExistingQuote = { id: string; quoteCode: string; statusToken: string };

/** One quote to create: its row (no code yet), its legs (no quote id yet) and the airports it needs. */
export type NewQuoteInput = {
  /** Everything but the code: the store makes it. */
  values: Omit<NewQuote, "quoteCode" | "id">;
  legs: Omit<NewQuoteLeg, "quoteId" | "id">[];
  /** Picker airports the legs point at; rows that already exist are left untouched. */
  airports: AirportRow[];
  /** The code's year (UTC). */
  year: number;
};

export type RequestQuoteRow = {
  id: string;
  code: string;
  status: string;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  contactSnapshot: { firstName?: string; lastName?: string; email?: string; phoneE164?: string } | null;
  receivedAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  assignedDispatcherId: string | null;
  convertedTripId: string | null;
};

export type RequestLegRow = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  distanceNm: number | null;
};

export type RequestOptionRow = {
  id: string;
  optionNumber: number;
  aircraftType: string | null;
  category: string | null;
  paxCapacity: number | null;
  yearOfMake: number | null;
  totalFlightTimeMin: number | null;
  clientPriceUsd: number | null;
  softHoldExpiry: Date | null;
  isChosen: boolean;
  status: string;
};

export type RequestTripLegRow = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
};

/** Everything the request page reads for one quote, raw: the page builds its view from it. */
export type RequestRows = {
  quote: RequestQuoteRow;
  legs: RequestLegRow[];
  options: RequestOptionRow[];
  dispatcher: { displayName: string; directLineE164: string | null } | null;
  /** Only when the quote was converted to a trip that still exists. */
  trip: {
    code: string;
    status: string;
    aircraftId: string | null;
    aircraftMakeModel: string | null;
    legs: RequestTripLegRow[];
  } | null;
};

export type QuoteForChoice = {
  id: string;
  code: string;
  status: string;
  contactSnapshot: { firstName?: string; lastName?: string } | null;
};

export type OptionForChoice = {
  id: string;
  status: string;
  aircraftType: string | null;
  clientPriceUsd: number | null;
};

export interface QuoteStore {
  /** A quote already made under this key, if any. */
  findByIdempotencyKey(key: string): Promise<ExistingQuote | undefined>;
  /**
   * Make the quote with its code, any missing airports and its legs, all or
   * nothing. Throws DuplicateIdempotencyKey when the key is already used (the
   * database enforces it). Any other failure throws as it is: a lead must never
   * be lost silently.
   */
  createQuote(input: NewQuoteInput): Promise<{ id: string; quoteCode: string }>;
  /** Null when no quote has this status token. */
  loadRequestRows(token: string): Promise<RequestRows | null>;
  quoteForChoice(token: string): Promise<QuoteForChoice | undefined>;
  optionForChoice(quoteId: string, optionId: string): Promise<OptionForChoice | undefined>;
  /**
   * The client's pick: the quote moves to accepted only while it is still open
   * (options_sent or held), and the chosen option becomes the only chosen one.
   * True when this call made the claim, false when another got there first or the
   * quote was no longer open.
   */
  claimOption(quoteId: string, optionId: string, now: Date): Promise<boolean>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function quoteStore(): QuoteStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1QuoteStore(client);
  }
  return pgQuoteStore();
}
