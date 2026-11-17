import { d1Db, dbTarget } from "@/db";
import type { EmptyLegWatchlist, NewEmptyLegWatchlist } from "@/db/schema/empty-legs";
import type { MatchableWatchlist, MatchChannel } from "@/lib/watchlist-matching";
import { d1WatchlistStore } from "./watchlist-store-d1";
import { pgWatchlistStore } from "./watchlist-store-pg";

// The empty-leg watchlists' one door to the database (OPS-116): the
// empty_leg_watchlists table (the opt-in and consent records) and its delivery
// ledger, empty_leg_watchlist_matches. There is one adapter per database, chosen
// per request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1"
// (staging first; the code refuses "d1" in production, see src/db/target.mjs).
// Return types are plain rows of the existing Postgres types, so callers keep
// their shape. The legs a match points at are the empty-legs store's (OPS-113).
// logAudit stays on Postgres, and so does the member lookup (the members domain
// moves later).
//
// Only the storage moves. The confirmed opt-in, the single-use confirm links,
// STOP and START and the claim-then-send ledger behave as they did.

/** What the confirm page and action need from a confirm-link hash. */
export type ConfirmLookupRow = {
  id: string;
  smsHash: string | null;
  emailHash: string | null;
  expiresAt: Date | null;
  fromText: string | null;
  toText: string | null;
  earliestOn: string | null;
  latestOn: string | null;
};

/** What the unsubscribe page and the one-click POST need from an unsubscribe token. */
export type UnsubscribeLookupRow = {
  id: string;
  email: string | null;
  fromText: string | null;
  toText: string | null;
  smsConfirmedAt: Date | null;
};

/** A member's own watchlist, for the delete and pause actions. */
export type OwnedWatchlistRow = {
  id: string;
  fromText: string | null;
  toText: string | null;
  active: boolean;
  smsConfirmedAt: Date | null;
  emailConfirmedAt: Date | null;
};

/** One row of the delivery ledger, enough to tell a pair was already handled. */
export type LedgerRow = { watchlistId: string; legId: string; channel: string };

/** How a send ended, written on the ledger row that claimed it. */
export type MatchOutcome = {
  status: "sent" | "failed";
  provider: string | null;
  providerMessageId: string | null;
  error: string | null;
  sentAt: Date;
};

export type UnsubscribeScope = "email" | "all";

export interface WatchlistStore {
  /** Inserts a watchlist and returns its id. */
  createWatchlist(values: NewEmptyLegWatchlist): Promise<string>;
  /** The watchlist whose SMS or email confirm hash is `hash`. */
  byConfirmHash(hash: string): Promise<ConfirmLookupRow | undefined>;
  /** Stamps the channel's confirmation and clears its hash, so the link works once. */
  confirmChannel(id: string, channel: "sms" | "email", at: Date): Promise<void>;
  byUnsubscribeToken(token: string): Promise<UnsubscribeLookupRow | undefined>;
  /** "all" ends the watchlist; "email" stops only the email channel. */
  unsubscribe(id: string, scope: UnsubscribeScope, at: Date): Promise<void>;
  /** Every watchlist of a member, newest first. */
  memberWatchlists(memberId: string): Promise<EmptyLegWatchlist[]>;
  /** One watchlist, only when it belongs to the member. */
  memberWatchlist(id: string, memberId: string): Promise<OwnedWatchlistRow | undefined>;
  deleteWatchlist(id: string): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
  /**
   * An inbound STOP pauses every active watchlist on the number (reason
   * sms_stop); START resumes only those a STOP paused. Returns how many moved.
   */
  smsKeyword(kind: "stop" | "start", phoneE164: string, at: Date): Promise<number>;
  /** Every watchlist that is not paused, for the matcher. */
  activeWatchlists(): Promise<MatchableWatchlist[]>;
  /** Deletes opt-ins nobody completed before their expiry; returns how many. */
  sweepUnconfirmed(now: Date): Promise<number>;
  /** The ledger rows for these legs. D1 takes at most 100 bound values a query, so it reads them in chunks. */
  notifiedFor(legIds: string[]): Promise<LedgerRow[]>;
  /** Claims a send by inserting a pending ledger row; undefined when another run already has it. */
  claimMatch(watchlistId: string, legId: string, channel: MatchChannel): Promise<string | undefined>;
  recordMatch(id: string, outcome: MatchOutcome): Promise<void>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function watchlistStore(): WatchlistStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1WatchlistStore(client);
  }
  return pgWatchlistStore();
}
