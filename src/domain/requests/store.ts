import { d1Db, dbTarget } from "@/db";
import type { Quote, QuoteLeg } from "@/db/schema/quotes";
import type { HeldAircraft } from "@/components/admin/soft-hold-list";
import type { SourcedOptionRow } from "@/components/admin/sourced-options";
import { d1RequestStore } from "./store-d1";
import { pgRequestStore } from "./store-pg";

// The requests domain's one door to the database for the read half of the desk's
// requests (OPS-154): the request list and the one-request page (queries.ts), the SLA
// watch cron (the overdue claim and the due-soon list), the smoke-quote prune and the
// reports CSV export. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging first; the
// code refuses "d1" in production, see src/db/target.mjs). The desk's commands (status,
// assign, link a client, holds, options, send options: OPS-155) and convert-to-trip stay
// on Postgres until their own rows.

export type RequestListRow = {
  id: string;
  quoteCode: string;
  status: string;
  source: string;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  contactSnapshot: Quote["contactSnapshot"];
  memberId: string | null;
  memberTier: string | null;
  receivedAt: Date;
  slaDeadlineAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  updatedAt: Date;
  convertedTripId: string | null;
  dispatcherName: string | null;
};

export type RequestListLegRow = Pick<
  QuoteLeg,
  | "quoteId"
  | "legNumber"
  | "fromIata"
  | "fromCity"
  | "fromName"
  | "toIata"
  | "toCity"
  | "toName"
  | "departDate"
  | "departTime"
>;

export type RequestOptionCountRow = { quoteId: string; total: number; sent: number };

export type RequestMemberRow = {
  id: string;
  memberCode: string;
  preferredName: string | null;
  legalName: string | null;
  status: string;
  tier: string | null;
};

export type RequestStaffRow = { id: string; displayName: string };

/** A hold still in force on some aircraft, with the quote that placed it. */
export type RequestConflictRow = { aircraftId: string; relatedQuoteId: string | null; quoteCode: string };

/** Everything the one-request page reads about a quote except its thread (the message store's). */
export type RequestParts = {
  legs: QuoteLeg[];
  /** Every client, by member code: the picker shows the active ones, the linked row may be paused. */
  memberRows: RequestMemberRow[];
  dispatchers: RequestStaffRow[];
  assignee: RequestStaffRow | null;
  /** Trips the linked client has flown (draft and cancelled left out); null when no client is linked. */
  timesFlown: number | null;
  /** Soft holds placed for this request. */
  holds: HeldAircraft[];
  /** Holds still in force on any aircraft. */
  conflicts: RequestConflictRow[];
  sourcedOptions: SourcedOptionRow[];
};

export type RequestCandidateRow = {
  id: string;
  tailNumber: string;
  makeModel: string;
  yearManufactured: number | null;
  seats: number;
  rangeNm: number;
  speedKt: number | null;
  wifiType: string | null;
  baseIcao: string | null;
  status: string;
  operatorId: string;
  operatorName: string;
  isPreferred: boolean;
  argusRating: string | null;
  wyvernWingman: boolean | null;
};

/** A quote the SLA watch has just marked as alerted. */
export type SlaClaimRow = {
  id: string;
  quoteCode: string;
  status: string;
  slaDeadlineAt: Date;
  receivedAt: Date;
  assignedDispatcherId: string | null;
};

/** A quote whose reply deadline is within the next few minutes and that was not announced yet. */
export type DueSoonRow = {
  id: string;
  quoteCode: string;
  status: string;
  slaDeadlineAt: Date;
  contactSnapshot: Quote["contactSnapshot"];
  assignedDispatcherId: string | null;
};

/** One line of the reports CSV export. */
export type ExportRow = {
  received_at: Date | string | number;
  client_name: string | null;
  email: string | null;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  legs: number;
  pax_count: number;
  status: string;
  booked_usd: number | null;
};

export interface RequestStore {
  /**
   * Requests the desk lists: open ones, bookings since `bookedSince`, closed ones since
   * `closedSince`, smoke quotes hidden, newest first. `pattern` is a likePattern() search.
   */
  listRows(args: { bookedSince: Date; closedSince: Date; pattern: string | null; limit: number }): Promise<RequestListRow[]>;
  /** The legs of these quotes, by leg number. */
  legsFor(ids: string[]): Promise<RequestListLegRow[]>;
  /** How many options each of these quotes has, and how many were sent to the client. */
  optionCountsFor(ids: string[]): Promise<RequestOptionCountRow[]>;
  /** One quote, plain. */
  getQuote(id: string): Promise<Quote | undefined>;
  /** Everything else the one-request page reads about a quote. */
  requestParts(quote: Quote, now: Date): Promise<RequestParts>;
  /** Aircraft in our network that fit the request: preferred partners first, then rating, then Wyvern. At most 8. */
  candidates(args: { category: NonNullable<Quote["requestedCategory"]>; pax: number; longestLegNm: number }): Promise<RequestCandidateRow[]>;

  /**
   * The SLA watch's claim: stamp sla_alerted_at on the (at most `limit`) quotes past their
   * deadline that were not alerted yet, in one statement, and return them. A second caller
   * gets none of those.
   */
  claimSlaOverdue(now: Date, limit: number): Promise<SlaClaimRow[]>;
  /** Quotes whose deadline falls in (now, soon] and that have no audit row with this action yet. */
  dueSoon(now: Date, soon: Date, action: string, limit: number): Promise<DueSoonRow[]>;
  /** Delete the post-deploy smoke quotes older than 7 days with no trip, up to `batch`. Returns how many went. */
  pruneSmoke(now: Date, batch: number): Promise<number>;
  /** One row per request received since `start`, smoke quotes left out, newest first. */
  exportRows(start: Date, limit: number): Promise<ExportRow[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function requestStore(): RequestStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1RequestStore(client);
  }
  return pgRequestStore();
}
