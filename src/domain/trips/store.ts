import { d1Db, dbTarget } from "@/db";
import type { Trip, TripLeg } from "@/db/schema/trips";
import type { Invoice } from "@/db/schema/invoices";
import type { NewAircraftScheduleBlock } from "@/db/schema/schedule-blocks";
import type { LegLike } from "@/components/admin/trips/trip-words";
import { d1TripStore } from "./store-d1";
import { pgTripStore } from "./store-pg";

// The trips domain's one door to the database for the trip reads and the aircraft calendar
// (OPS-156): the desk's trip list and trip sheet (queries.ts), the trip lookups and the status
// write of the trip commands, the manual schedule blocks (src/domain/schedule/commands.ts), the
// client's two trip pages and the trip and block reads of the aircraft page. There is one
// adapter per database, chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see src/db/target.mjs).
//
// Not in this store, on purpose: the cancel refunds and the invoice editor in commands.ts
// (they write invoices and the reserve ledger and go with the invoices and payments row of
// OPS-93), and convert-to-trip (its own row, OPS-157). The trip's thread is the message
// store's (OPS-127).

// ─── The desk's trip list ────────────────────────────────────────────────

/** One joined row of the trip list: the trip, its client, its aircraft and operator, the request's ground option. */
export type TripListRow = {
  id: string;
  tripCode: string;
  status: Trip["status"];
  paxCount: number;
  missionType: Trip["missionType"];
  wheelsUpAt: Date | null;
  createdAt: Date;
  memberId: string;
  quoteId: string | null;
  memberCode: string;
  preferredName: string | null;
  legalName: string | null;
  memberEmail: string | null;
  memberPhone: string | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  makeModel: string | null;
  tailNumber: string | null;
  operatorName: string | null;
  groundOption: string | null;
};

export type TripListLegRow = LegLike & { tripId: string };

export type TripListInvoiceRow = {
  tripId: string | null;
  status: string;
  issuedOn: string;
  dueOn: string | null;
  paidOn: string | null;
  totalUsd: number | null;
  kind: string;
};

export type TripOptionRow = {
  quoteId: string;
  aircraftType: string | null;
  tailNumber: string | null;
  operatorNameRaw: string | null;
};

// ─── One trip ────────────────────────────────────────────────────────────

export type TripMemberRow = {
  id: string;
  memberCode: string;
  tier: string | null;
  preferredName: string | null;
  legalName: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
};

/** Everything the one-trip page reads about a trip except its thread (the message store's). */
export type TripParts = {
  trip: Trip;
  legs: TripLeg[];
  member: TripMemberRow | null;
  invoice: Invoice | null;
  quote: { id: string; quoteCode: string; status: string; groundOption: string | null } | null;
  aircraft: { tailNumber: string; makeModel: string; yearManufactured: number | null; operatorId: string } | null;
  operator: { id: string; name: string; certNumber: string | null } | null;
  /** The first sourced option of the request; read only when the trip has no aircraft yet. */
  chosenOption: {
    aircraftType: string | null;
    tailNumber: string | null;
    operatorNameRaw: string | null;
    totalFlightTimeMin: number | null;
  } | null;
};

// ─── Commands ────────────────────────────────────────────────────────────

export type TripMessageRow = {
  id: string;
  code: string;
  memberId: string;
  memberUserId: string;
  memberEmail: string | null;
  memberPhone: string | null;
};

export type TripStatusRow = { id: string; code: string; status: Trip["status"] };

/** What a status change writes on the trip row. */
export type TripStatusPatch = {
  status: Trip["status"];
  wheelsUpAt?: Date;
  wheelsDownAt?: Date;
};

/** Who a status notification goes to, and the client's say over texts. */
export type TripNoticeTarget = {
  memberUserId: string;
  memberEmail: string | null;
  memberPhone: string | null;
  memberFirstName: string | null;
  paxCount: number;
  smsOptIn: boolean | null;
  quietStart: string | null;
  quietEnd: string | null;
  quietTz: string | null;
};

export type TripNoticeLeg = { fromIcao: string | null; toIcao: string | null; departDate: string | null };

export type ScheduleBlockRow = {
  id: string;
  aircraftId: string;
  kind: NewAircraftScheduleBlock["kind"];
  relatedTripId: string | null;
  relatedQuoteId: string | null;
};

// ─── The client's trip pages ─────────────────────────────────────────────

export type AccountTripRow = {
  id: string;
  tripCode: string;
  status: string;
  paxCount: number;
  missionType: string;
  revenueUsd: number | null;
  createdAt: Date;
  aircraft: string | null;
};

export type AccountLegRow = {
  tripId: string;
  legNumber: number;
  fromIata: string | null;
  toIata: string | null;
  fromCity: string | null;
  toCity: string | null;
  departDate: string | null;
};

export type AccountTripParts = {
  trip: Trip;
  legs: TripLeg[];
  invoice: Invoice | null;
  aircraft: { makeModel: string; category: string; seats: number; yearManufactured: number | null } | null;
  operator: { name: string } | null;
};

// ─── The aircraft page ───────────────────────────────────────────────────

export type TailBlockRow = {
  id: string;
  kind: NewAircraftScheduleBlock["kind"];
  startAt: Date;
  endAt: Date;
  relatedTripId: string | null;
  notes: string | null;
  tripCode: string | null;
};

export type TailTripRow = {
  id: string;
  tripCode: string;
  status: string;
  paxCount: number;
  revenueUsd: number | null;
  wheelsUpAt: Date | null;
  createdAt: Date;
};

export type TailTotals = { lifetimeTrips: number; lifetimeRevenue: number; totalPax: number };

export interface TripStore {
  /**
   * The newest trips (at most `limit`) with their client, aircraft, operator and the request's
   * ground option. `pattern` is a likePattern() search over the client's names and email, the
   * member's names and the legs' cities.
   */
  listRows(args: { pattern: string | null; limit: number }): Promise<TripListRow[]>;
  /** The legs of these trips, by leg number. */
  legsForTrips(tripIds: string[]): Promise<TripListLegRow[]>;
  /** The invoices of these trips, oldest first. */
  invoicesForTrips(tripIds: string[]): Promise<TripListInvoiceRow[]>;
  /** The sourced options of these quotes: the chosen one first, then by option number, per quote. */
  optionsForQuotes(quoteIds: string[]): Promise<TripOptionRow[]>;
  /** The one-trip page's rows, or null when there is no such trip. */
  tripParts(id: string): Promise<TripParts | null>;

  /** The trip, its client's user and contact points, for posting a message. */
  tripForMessage(id: string): Promise<TripMessageRow | undefined>;
  /** The trip's code and status, before a status change. */
  tripForStatus(id: string): Promise<TripStatusRow | undefined>;
  /** The client, contact points and text preferences behind a status notification; undefined for no such trip. */
  noticeTarget(id: string): Promise<TripNoticeTarget | undefined>;
  /** The trip's legs by leg number, for the notification's itinerary lines. */
  noticeLegs(id: string): Promise<TripNoticeLeg[]>;
  /** Write the status (and the wheels stamps), then bring the aircraft calendar in step. */
  setStatus(id: string, patch: TripStatusPatch): Promise<void>;

  /** An aircraft by id, for a manual block. */
  aircraftForBlock(id: string): Promise<{ id: string; tailNumber: string } | undefined>;
  /** Insert a manual block and return its id. */
  insertBlock(values: NewAircraftScheduleBlock): Promise<{ id: string }>;
  /** A block with the links that tell whether a trip or a hold owns it. */
  blockById(id: string): Promise<ScheduleBlockRow | undefined>;
  deleteBlock(id: string): Promise<void>;

  /** The client's newest trips (at most `limit`) with the aircraft's make and model. */
  memberTrips(memberId: string, limit: number): Promise<AccountTripRow[]>;
  /** The legs of these trips, by leg number. */
  accountLegs(tripIds: string[]): Promise<AccountLegRow[]>;
  /** One trip of this client with its legs, invoice, aircraft and operator; null for another client's trip. */
  memberTripParts(id: string, memberId: string): Promise<AccountTripParts | null>;
  /** A dispatcher's name and direct line. */
  staffContact(id: string): Promise<{ displayName: string; directLineE164: string | null } | undefined>;

  /** Blocks of a tail that overlap [from, to), earliest first, with the trip code of a trip block. */
  tailBlocks(aircraftId: string, from: Date, to: Date): Promise<TailBlockRow[]>;
  /** The newest trips (at most `limit`) flown or booked on a tail. */
  tailRecentTrips(aircraftId: string, limit: number): Promise<TailTripRow[]>;
  /** Lifetime trips, revenue and passengers of a tail. */
  tailTotals(aircraftId: string): Promise<TailTotals>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function tripStore(): TripStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1TripStore(client);
  }
  return pgTripStore();
}
