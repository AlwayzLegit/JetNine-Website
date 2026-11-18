import { d1Db, dbTarget } from "@/db";
import type { Member, NewMember } from "@/db/schema/members";
import type {
  Companion,
  MemberLane,
  MemberPreferences,
  NewCompanion,
  NewMemberLane,
  NewMemberPreferences,
} from "@/db/schema/member-prefs";
import type { Membership, NewMembership, NewReserveTransaction } from "@/db/schema/memberships";
import { d1MemberStore } from "./store-d1";
import { pgMemberStore } from "./store-pg";

// The members domain's one door to the database (OPS-149): the admin client
// list and detail, the reserve ledger add, the client invite with its M code,
// the member by user id (called from every account page), the member tier sync,
// and the account Memberships, Members and Preferences pages and their
// actions. Every query on members, memberships, reserve_transactions,
// member_preferences, member_lanes, companions and member_documents outside
// the Stripe webhook and the invoice drawdown goes through a MemberStore.
// There is one adapter per database, chosen per request by dbTarget(): Postgres
// until the move, D1 where DB_TARGET is "d1" (staging first; the code refuses
// "d1" in production, see src/db/target.mjs).
//
// Lookups from here into users, staff, trips, trip_legs, invoices, quotes,
// quote_legs, airports and aircraft run in the same database as the store:
// the copy tool carries every table, so on staging D1 they read the twins.
// Not in this store, on purpose: the Stripe webhook's membership activation
// and reserve credits (they are in the payment store, src/domain/payments,
// OPS-162), attemptInvoiceDrawdown (used by the request store's convert), and
// auth-users (the users row is made on Postgres).

// ─── The desk's client list ──────────────────────────────────────────────

export type ClientListRow = {
  id: string;
  tier: Member["tier"];
  status: Member["status"];
  memberSince: string | null;
  tierSince: string | null;
  mobileE164: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  tripCount: number;
  lifetimeUsd: number;
  /** YYYY-MM-DD */
  lastFlownOn: string | null;
  nextTripId: string | null;
  openRequests: number;
  reserveUsd: number;
  program: Membership["program"] | null;
  programSince: string | null;
  programRenews: string | null;
  programEnds: string | null;
  prefs: MemberPreferences | null;
};

export type TripLegFacts = {
  tripId: string;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
};

export type NextTripRow = { id: string; paxCount: number | null; status: string };

// ─── One client ──────────────────────────────────────────────────────────

export type ClientHead = {
  id: string;
  memberCode: string;
  legalName: string | null;
  preferredName: string | null;
  tier: Member["tier"];
  tierSince: string | null;
  memberSince: string | null;
  status: Member["status"];
  mobileE164: string | null;
  companyName: string | null;
  roleTitle: string | null;
  twoFactorEnabled: boolean;
  marketingOptIn: boolean;
  lifetimeTripsCache: number;
  lifetimeHoursCache: number;
  primaryDispatcherId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  role: string;
};

export type ClientCompanionFacts = Pick<
  Companion,
  "id" | "relation" | "legalName" | "apisComplete" | "ccOnItinerary" | "speciesBreed" | "weightLb" | "notes" | "createdAt"
>;

export type ClientDocumentFacts = {
  id: string;
  docType: string;
  countryIso2: string | null;
  expiresOn: string | null;
  isPrimary: boolean;
};

export type ClientTripFacts = {
  id: string;
  tripCode: string;
  status: string;
  missionType: string | null;
  paxCount: number | null;
  revenueUsd: number | null;
  aircraftId: string | null;
  createdAt: Date;
};

export type ClientOpenTripFacts = {
  id: string;
  tripCode: string;
  status: string;
  paxCount: number | null;
  revenueUsd: number | null;
  aircraftId: string | null;
};

export type ClientInvoiceFacts = {
  id: string;
  invoiceCode: string;
  status: string;
  kind: string;
  issuedOn: string | null;
  dueOn: string | null;
  totalUsd: number | null;
  tripId: string | null;
  tripCode: string | null;
};

export type ClientQuoteFacts = {
  id: string;
  quoteCode: string;
  status: string;
  paxCount: number | null;
  receivedAt: Date;
  convertedTripId: string | null;
};

export type LedgerFacts = {
  id: string;
  kind: string;
  amountUsd: number;
  description: string | null;
  occurredAt: Date;
};

/** The ledger as the member's own Members page shows it, with the trip and invoice codes. */
export type LedgerWithRefs = LedgerFacts & {
  tripId: string | null;
  tripCode: string | null;
  invoiceId: string | null;
  invoiceCode: string | null;
};

export type ClientBody = {
  dispatcher: { displayName: string; status: string } | null;
  prefs: MemberPreferences | null;
  /** Newest frequency first. */
  lanes: MemberLane[];
  /** By legal name. Birth dates and encrypted KTNs never leave the database here. */
  companions: ClientCompanionFacts[];
  documents: ClientDocumentFacts[];
  /** Newest activation first. */
  programs: Membership[];
  balance: number;
  /** Ten newest. */
  trips: ClientTripFacts[];
  /** Everything not yet flown or cancelled. */
  openTrips: ClientOpenTripFacts[];
  /** Ten newest by issue date. */
  invoices: ClientInvoiceFacts[];
  /** Ten newest. */
  quotes: ClientQuoteFacts[];
  lifetimeInvoiced: number;
  /** Eight newest. */
  ledger: LedgerFacts[];
};

export type ClientLegFacts = {
  legs: TripLegFacts[];
  quoteLegs: Array<{
    quoteId: string;
    fromIata: string | null;
    fromCity: string | null;
    fromName: string | null;
    toIata: string | null;
    toCity: string | null;
    toName: string | null;
    departDate: string | null;
  }>;
  laneAirports: Array<{ icao: string; city: string | null; name: string }>;
};

/** What a ledger add needs to know about the client. */
export type LedgerTarget = {
  member: { id: string; memberCode: string; firstName: string | null; lastName: string | null; email: string };
  /** The ACTIVE membership, newest activation first, when there is one. */
  activeMembershipId: string | null;
};

export interface MemberStore {
  // ── Identity ──
  /** The member row tied to a user id. Null when the user never had a profile. */
  memberByUserId(userId: string): Promise<Member | null>;
  /** Just the id and code, for the duplicate check on invite. */
  memberRefByUserId(userId: string): Promise<{ id: string; memberCode: string } | null>;

  // ── The desk's client list and detail ──
  /**
   * Up to 200 clients with the per-client aggregates, by last then first name.
   * `like` is a LIKE pattern (already escaped, see likePattern) matched without
   * regard to case against the six name and email columns; null means no search.
   * `today` is YYYY-MM-DD.
   */
  listClientRows(like: string | null, today: string): Promise<ClientListRow[]>;
  /** Passengers, status and legs (by leg number) of the trips the list calls next. */
  nextTripFacts(tripIds: string[]): Promise<{ trips: NextTripRow[]; legs: TripLegFacts[] }>;
  clientHead(id: string): Promise<ClientHead | undefined>;
  clientBody(id: string, primaryDispatcherId: string | null): Promise<ClientBody>;
  clientLegFacts(tripIds: string[], quoteIds: string[], laneIcaos: string[]): Promise<ClientLegFacts>;
  aircraftModel(aircraftId: string): Promise<string | null>;

  // ── The reserve ledger ──
  /** The client and their active membership for a ledger add. Undefined when no such member. */
  ledgerTarget(memberId: string): Promise<LedgerTarget | undefined>;
  appendLedger(values: NewReserveTransaction): Promise<{ id: string }>;
  /** Signed sum of the ledger, in whole dollars. */
  balance(memberId: string): Promise<number>;
  /** Signed sum of the credit_accrual rows only. */
  creditAccrualTotal(memberId: string): Promise<number>;
  recentLedger(memberId: string, limit: number): Promise<LedgerFacts[]>;
  recentLedgerWithRefs(memberId: string, limit: number): Promise<LedgerWithRefs[]>;

  // ── Members: invite ──
  /**
   * A new member. The store makes the M-YYYY-NNNN code and the insert together
   * (one transaction on Postgres, one batch on D1), so a failed insert gives
   * the number back. `values.memberCode` is ignored.
   */
  insertMember(values: NewMember): Promise<{ id: string; memberCode: string }>;

  // ── Memberships ──
  /** Newest activation first. */
  membershipsOf(memberId: string): Promise<Membership[]>;
  activeMembership(memberId: string): Promise<Membership | undefined>;
  insertMembership(values: NewMembership): Promise<{ id: string }>;
  /** Changes a membership row (status, notes, the Checkout session id) and stamps updated_at. */
  patchMembership(
    id: string,
    patch: Partial<Pick<NewMembership, "status" | "notes" | "stripeCheckoutSessionId">>,
  ): Promise<void>;
  /**
   * The member tier follows the membership (OPS-102): the same rules as
   * syncMemberTier in src/domain/memberships/tier.ts, run on this store's
   * database. `previousStatus` is the status before the write, null for an insert.
   */
  syncTier(membershipId: string, previousStatus: string | null): Promise<void>;

  // ── Preferences, companions, lanes ──
  preferencesOf(memberId: string): Promise<MemberPreferences | undefined>;
  /** Insert or update by member id. `created` is true when no row existed. */
  upsertPreferences(values: NewMemberPreferences): Promise<{ created: boolean }>;
  /** Oldest first. */
  companionsOf(memberId: string): Promise<Companion[]>;
  addCompanion(values: NewCompanion): Promise<{ id: string }>;
  /** Only when the companion belongs to this member. */
  companionOf(
    id: string,
    memberId: string,
  ): Promise<{ id: string; legalName: string; relation: Companion["relation"] } | undefined>;
  deleteCompanion(id: string): Promise<void>;
  /** Oldest first. */
  lanesOf(memberId: string): Promise<MemberLane[]>;
  laneExists(memberId: string, fromIcao: string, toIcao: string): Promise<boolean>;
  addLane(values: NewMemberLane): Promise<{ id: string }>;
  laneOf(id: string, memberId: string): Promise<{ id: string; fromIcao: string; toIcao: string } | undefined>;
  deleteLane(id: string): Promise<void>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function memberStore(): MemberStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1MemberStore(client);
  }
  return pgMemberStore();
}
