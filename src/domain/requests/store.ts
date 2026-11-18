import { d1Db, dbTarget } from "@/db";
import type { Quote, QuoteLeg } from "@/db/schema/quotes";
import type { NewAircraftScheduleBlock } from "@/db/schema/schedule-blocks";
import type { NewInvoice } from "@/db/schema/invoices";
import type { NewTrip, NewTripLeg } from "@/db/schema/trips";
import type { DrawdownOutcome } from "@/lib/membership-balance";
import type { NewSourcedOption, SourcedOption } from "@/db/schema/sourced-option";
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
// assign, link a client, holds, options, send options) go through the same door since
// OPS-155; convert-to-trip stays on Postgres until the trips and invoices rows.

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

/** A request's id and code: the head the hold, option and assign commands load first. */
export type RequestHeadRow = { id: string; code: string };

/** The linked client's account: the user id (the client's inbox) and the account email. */
export type RequestMemberContactRow = { userId: string | null; email: string | null };

export type RequestHoldBlockRow = {
  id: string;
  kind: string;
  relatedQuoteId: string | null;
  aircraftId: string;
  tailNumber: string | null;
};

/** An operator the pasted seller name matched, with the vetting fields the safety floor reads. */
export type RequestOperatorRow = {
  id: string;
  name: string;
  status: string;
  argusRating: SourcedOption["argusRating"];
  wyvernWingman: boolean;
  isbaoStage: number | null;
  insuranceRenewsOn: string | null;
  nextAuditOn: string | null;
};

/** Thrown by insertHold when the aircraft is already held for this request (the unique index). */
export class HoldTaken extends Error {
  constructor() {
    super("Already holding this aircraft for this quote");
    this.name = "HoldTaken";
  }
}

/** What convert-to-trip writes (OPS-157): the trip and legs, the invoice, and whether to try the reserve draw. */
export type ConvertPlan = {
  quoteId: string;
  memberId: string;
  /** The trip without its code (the store makes it). */
  trip: Omit<NewTrip, "tripCode">;
  legs: Omit<NewTripLeg, "tripId">[];
  /** The invoice without its code, trip id and status (the store sets them). */
  invoice: Omit<NewInvoice, "invoiceCode" | "tripId" | "status">;
  /** The invoice total, the amount to draw. */
  totalUsd: number | null;
  /** True when the total is above 0: the invoice opens as due and the draw is tried. */
  tryDraw: boolean;
};

export type ConvertResult = {
  trip: { id: string; tripCode: string };
  invoice: { id: string };
  drawdown: DrawdownOutcome | null;
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

  // ─── The desk's commands (OPS-155) ─────────────────────────────────────────
  // Loads return raw rows (undefined when there is none); the commands keep every rule,
  // result code and message. Convert-to-trip is not here: it goes with the trips rows.

  /** The request's id and code, or undefined. */
  quoteHead(id: string): Promise<RequestHeadRow | undefined>;
  /** What the status command needs about a request. */
  quoteForStatus(id: string): Promise<
    { id: string; status: Quote["status"]; code: string; memberId: string | null; contactSnapshot: Quote["contactSnapshot"] } | undefined
  >;
  /** The linked client's user id and account email (members joined to users), or undefined. */
  memberContact(memberId: string): Promise<RequestMemberContactRow | undefined>;
  /** The linked client's user id alone (members, no join), or undefined. */
  memberUserId(memberId: string): Promise<{ userId: string | null } | undefined>;
  /** Set the status; `respondedAt` undefined leaves responded_at as it is. */
  setStatus(id: string, status: Quote["status"], respondedAt: Date | undefined): Promise<void>;
  /** What the message command needs about a request. */
  quoteForMessage(id: string): Promise<
    { id: string; code: string; memberId: string | null; contactSnapshot: Quote["contactSnapshot"] } | undefined
  >;
  /** What the send-options command needs about a request. */
  quoteForSendOptions(id: string): Promise<
    | {
        id: string;
        code: string;
        status: Quote["status"];
        paxCount: number;
        memberId: string | null;
        contactSnapshot: Quote["contactSnapshot"];
        statusToken: string | null;
      }
    | undefined
  >;
  /** Options that passed the safety floor, in option order. */
  vettedOptions(quoteId: string): Promise<SourcedOption[]>;
  /** The request's legs as from and to airport codes, in leg order. */
  legRoute(quoteId: string): Promise<{ fromIata: string | null; toIata: string | null }[]>;
  /**
   * Flip these options to sent_to_client and, when the request is still submitted, triaged or
   * sourcing, move it to options_sent with responded_at: the condition is in the WHERE, so a
   * status that moved on in between is never pulled back. Both writes are one unit on D1.
   */
  markOptionsSent(quoteId: string, optionIds: string[], now: Date): Promise<void>;
  /** What the assign command needs about a request. */
  quoteForAssign(id: string): Promise<{ id: string; code: string; assignedDispatcherId: string | null } | undefined>;
  /** One dispatcher (a staff row), or undefined. */
  staffById(id: string): Promise<{ id: string; displayName: string } | undefined>;
  /** Assign a dispatcher (null clears). */
  assign(quoteId: string, staffId: string | null): Promise<void>;
  /** What the link-a-client command needs about a request. */
  quoteForLink(id: string): Promise<
    { id: string; code: string; memberId: string | null; convertedTripId: string | null } | undefined
  >;
  /** One client by id: its id and member code, or undefined. */
  memberById(id: string): Promise<{ id: string; memberCode: string } | undefined>;
  /** Link a client (null unlinks). */
  linkMember(quoteId: string, memberId: string | null, now: Date): Promise<void>;
  /** What the soft-hold command needs about a request. */
  quoteForHold(id: string): Promise<{ id: string; code: string; status: Quote["status"] } | undefined>;
  /** One aircraft: its id, tail and status, or undefined. */
  aircraftById(id: string): Promise<{ id: string; tailNumber: string; status: string } | undefined>;
  /** The request's leg dates and times, earliest first. */
  holdLegs(quoteId: string): Promise<{ departDate: string | null; departTime: string | null }[]>;
  /** The soft hold this request already has on this aircraft, if any. */
  holdFor(quoteId: string, aircraftId: string): Promise<{ id: string } | undefined>;
  /** Place a soft hold. Throws HoldTaken when the (aircraft, request) pair is already held. */
  insertHold(values: NewAircraftScheduleBlock): Promise<{ id: string }>;
  /** One schedule block with its aircraft's tail, or undefined. */
  holdById(id: string): Promise<RequestHoldBlockRow | undefined>;
  /** Release (delete) a soft hold. */
  deleteHold(id: string): Promise<void>;
  /** First operator whose name contains the pattern (a `%text%` pattern, as typed), or undefined. */
  operatorLike(pattern: string): Promise<RequestOperatorRow | undefined>;
  /** The ordinal the request's next option takes: the highest so far plus one, 1 for the first. */
  nextOptionNumber(quoteId: string): Promise<number>;
  /** Add a sourced option. */
  insertOption(values: NewSourcedOption): Promise<{ id: string }>;
  /** One option of this request, or undefined (an option of another request is none). */
  optionOf(quoteId: string, optionId: string): Promise<SourcedOption | undefined>;
  /** Change an option's fields. */
  updateOption(id: string, fields: Partial<NewSourcedOption>, now: Date): Promise<void>;
  /** Make this option the request's one chosen option (every other one is unchosen first). One unit. */
  chooseOption(quoteId: string, optionId: string, now: Date): Promise<void>;
  /** Remove an option. */
  deleteOption(id: string): Promise<void>;
  /** The request an option belongs to, or undefined. */
  quoteIdForOption(optionId: string): Promise<string | undefined>;

  /** The request's legs by leg number, whole rows (OPS-157). */
  quoteLegsInOrder(quoteId: string): Promise<QuoteLeg[]>;
  /** The option the desk chose for this request, if any. */
  chosenOption(quoteId: string): Promise<SourcedOption | undefined>;
  /** An aircraft's id by tail number. */
  aircraftIdByTail(tail: string): Promise<string | undefined>;
  /** A client's name and email. */
  clientName(memberId: string): Promise<{ firstName: string | null; lastName: string | null; email: string | null } | undefined>;
  /** The trip a request was converted to, with the request's code; undefined for no such request. */
  convertedTripOf(quoteId: string): Promise<{ convertedTripId: string | null; quoteCode: string } | undefined>;
  /**
   * Book the request: the trip with its code, its legs, the aircraft's calendar block, the invoice
   * with its code (due when a draw is tried, else draft), the draw from the client's reserve when
   * the active membership's balance covers the total (then the invoice is paid), the request's soft
   * holds released and the request marked converted, all or nothing. A second convert of the same
   * request throws the unique violation of trips(quote_id) and writes nothing.
   */
  convertToTrip(plan: ConvertPlan): Promise<ConvertResult>;
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
