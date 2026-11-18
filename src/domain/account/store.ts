import { d1Db, dbTarget } from "@/db";
import type { Quote, QuoteLeg } from "@/db/schema/quotes";
import type { Trip, TripLeg } from "@/db/schema/trips";
import type { Invoice } from "@/db/schema/invoices";
import type { Aircraft } from "@/db/schema/aircraft";
import { d1AccountStore } from "./store-d1";
import { pgAccountStore } from "./store-pg";

// The account domain's one door to the database for the signed-in client's home and Quotes
// list (OPS-164): the account home (src/app/account/page.tsx: the quotes in progress, their
// legs, the member's trips and trip legs, the aircraft cards and the invoice facts) and the
// Quotes list (src/app/account/quotes/page.tsx). Nothing is written. The active membership,
// the reserve balance and the dispatcher's contact are read through the member store and the
// trip store, which already answer them. There is one adapter per database, chosen per request
// by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging first; the code
// refuses "d1" in production, see src/db/target.mjs).

/**
 * Whose quotes: the ones the user made, plus the ones linked to the member when the user has
 * one. `memberId` null means ownership by `createdByUserId` only, as the pages have always done.
 */
export type QuoteOwner = { userId: string; memberId: string | null };

export type QuoteStatus = Quote["status"];

/** A quote still in progress, for the account home. */
export type OpenQuoteRow = {
  id: string;
  status: QuoteStatus;
  paxCount: number;
  statusToken: string;
  slaDeadlineAt: Date;
  assignedDispatcherId: string | null;
};

/** A quote of the client's Quotes list. */
export type ClientQuoteRow = {
  id: string;
  quoteCode: string;
  status: QuoteStatus;
  statusToken: string;
  paxCount: number;
  requestedCategory: Quote["requestedCategory"];
  receivedAt: Date;
  slaDeadlineAt: Date;
  indicativeLowUsd: number | null;
  indicativeHighUsd: number | null;
};

export type AccountQuoteLegRow = Pick<
  QuoteLeg,
  "quoteId" | "legNumber" | "fromIata" | "toIata" | "fromCity" | "toCity" | "departDate"
>;

/** One of the member's trips, for the account home. */
export type HomeTripRow = {
  id: string;
  code: string;
  status: Trip["status"];
  paxCount: number;
  aircraftId: string | null;
  revenueUsd: number | null;
  assignedDispatcherId: string | null;
};

export type HomeTripLegRow = Pick<
  TripLeg,
  | "tripId"
  | "fromIata"
  | "toIata"
  | "fromCity"
  | "toCity"
  | "fromName"
  | "departDate"
  | "departTime"
  | "scheduledDepAt"
  | "scheduledArrAt"
>;

export type AircraftCardRow = Pick<Aircraft, "id" | "makeModel" | "category" | "seats">;

export type InvoiceFactRow = Pick<Invoice, "status" | "totalUsd" | "paidOn">;

export interface AccountStore {
  /** The owner's quotes in one of `statuses`, newest received first, at most `limit`. */
  openQuotes(args: { owner: QuoteOwner; statuses: QuoteStatus[]; limit: number }): Promise<OpenQuoteRow[]>;
  /** Every quote of the owner whatever its status, newest received first, at most `limit`. */
  clientQuotes(args: { owner: QuoteOwner; limit: number }): Promise<ClientQuoteRow[]>;
  /** The legs of these quotes, by leg number (each quote's legs stay in leg order). */
  quoteLegsOf(quoteIds: string[]): Promise<AccountQuoteLegRow[]>;
  /** The member's trips, newest created first, at most `limit`. */
  homeTrips(memberId: string, limit: number): Promise<HomeTripRow[]>;
  /** The legs of these trips, by leg number (each trip's legs stay in leg order). */
  homeTripLegs(tripIds: string[]): Promise<HomeTripLegRow[]>;
  /** Model, category and seats of these aircraft. */
  aircraftCards(ids: string[]): Promise<AircraftCardRow[]>;
  /** Status, total and paid-on date of every invoice of the member. */
  invoiceFacts(memberId: string): Promise<InvoiceFactRow[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function accountStore(): AccountStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1AccountStore(client);
  }
  return pgAccountStore();
}
