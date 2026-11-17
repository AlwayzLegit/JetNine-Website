import { d1Db, dbTarget } from "@/db";
import type { NewMessage } from "@/db/schema/audit";
import type { quotes } from "@/db/schema/quotes";
import { d1MessageStore } from "./store-d1";
import { pgMessageStore } from "./store-pg";

// The messages domain's one door to the messages table (OPS-127): the admin
// inbox and its unread count, one thread, failed deliveries, mark read and
// retry, the desk counts, emails sent today, a member's trip timeline, the
// inbound email and SMS webhooks, the email bounce events and the message
// writes inside request and trip commands. Every query on that table goes
// through a MessageStore. There is one adapter per database, chosen per
// request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1"
// (staging first; the code refuses "d1" in production, see src/db/target.mjs).
//
// Lookups into quotes, trips, members and users that are not part of a messages
// query stay where they are (their own rows move them). The voice service's
// tables are OPS-129's.

export type ThreadSubjectKind = "quote" | "trip" | "member";

type SubjectType = NewMessage["subjectType"];
type Channel = NonNullable<NewMessage["channel"]>;

type ContactSnapshot = (typeof quotes.$inferSelect)["contactSnapshot"];

/** One row per (subject_type, subject_id), as the thread list reads it. */
export type ThreadSummary = {
  subjectType: SubjectType;
  subjectId: string;
  lastAt: Date;
  /** Inbound messages not yet read. */
  unread: number;
  /** Messages that are not call notes or voicemails. */
  spoken: number;
};

export type LatestMessage = {
  subjectType: SubjectType;
  subjectId: string;
  direction: "in" | "out";
  preview: string | null;
  body: string | null;
};

/** A message with its author, as one thread shows it. */
export type ThreadRow = {
  id: string;
  channel: Channel;
  direction: "in" | "out";
  fromAddress: string | null;
  toAddress: string | null;
  preview: string | null;
  body: string | null;
  occurredAt: Date;
  fromUserFirstName: string | null;
  fromUserEmail: string | null;
  deliveryStatus: "queued" | "sent" | "failed" | "skipped";
  deliveryProvider: string | null;
  deliveryError: string | null;
};

/** The message a retry loads (the subject's code is looked up by the caller). */
export type RetryMessage = {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  channel: Channel;
  direction: "in" | "out";
  toAddress: string | null;
  body: string | null;
  preview: string | null;
  deliveryStatus: "queued" | "sent" | "failed" | "skipped";
};

export type FailedDeliveryRaw = {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  channel: Channel;
  toAddress: string | null;
  preview: string | null;
  error: string | null;
  occurredAt: Date;
  quoteCode: string | null;
  quoteContact: ContactSnapshot | null;
  tripCode: string | null;
  tripFirstName: string | null;
  tripLastName: string | null;
};

/** What a delivery update writes. Fields left out are not touched. */
export type DeliveryPatch = {
  deliveryStatus?: "queued" | "sent" | "failed" | "skipped";
  deliveryProvider?: string | null;
  deliveryMessageId?: string | null;
  deliveryError?: string | null;
  deliveredAt?: Date | null;
};

export type BouncedMessage = {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  toAddress: string | null;
  preview: string | null;
};

export type MemberTimelineRow = {
  id: string;
  channel: Channel;
  body: string | null;
  preview: string | null;
  occurredAt: Date;
};

export interface MessageStore {
  /** A new message. Throws when the insert fails (a duplicate inbound delivery included, see isDuplicateMessage). */
  insertMessage(values: NewMessage): Promise<{ id: string }>;
  /** Update the delivery columns of one message. */
  setDelivery(id: string, patch: DeliveryPatch): Promise<void>;
  /** An email bounce or complaint: mark the message with this provider id failed. Empty when nothing matches. */
  markFailedByProviderId(providerMessageId: string, error: string): Promise<BouncedMessage[]>;
  /** Unread inbound messages on one thread. */
  unreadInThread(kind: ThreadSubjectKind, id: string): Promise<number>;
  /** Mark a thread's inbound messages read; the number of rows changed. */
  markThreadRead(kind: ThreadSubjectKind, id: string): Promise<number>;

  /** Threads of the given kinds, newest first. */
  threadSummaries(kinds: ThreadSubjectKind[], limit: number): Promise<ThreadSummary[]>;
  /** The newest message of each given thread (one per thread). */
  latestPerThread(kinds: ThreadSubjectKind[], subjectIds: string[]): Promise<LatestMessage[]>;
  /** Threads with at least one unread inbound message. */
  unreadThreadCount(kinds: ThreadSubjectKind[]): Promise<number>;
  /** The newest `limit` messages of one thread, newest first, with the author's first name and email. */
  thread(subjectType: SubjectType, subjectId: string, limit: number): Promise<ThreadRow[]>;
  /** One message by id, or undefined. */
  messageForRetry(id: string): Promise<RetryMessage | undefined>;
  /** Outbound messages that failed since `since`, newest first, with their request or trip details (50 at most). */
  failedSince(since: Date): Promise<FailedDeliveryRaw[]>;
  /** Unread inbound messages across the desk. */
  unreadInbound(): Promise<number>;
  /** Unread inbound messages and outbound failures since `since7`. */
  snapshotCounts(since7: Date): Promise<{ unread: number; failed: number }>;
  /** Outbound emails marked sent with occurred_at from `start` (included) to `end` (excluded). */
  emailsSentBetween(start: Date, end: Date): Promise<number>;
  /** What a member sees on a trip: outbound messages only, oldest first. */
  memberTripTimeline(tripId: string): Promise<MemberTimelineRow[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function messageStore(): MessageStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1MessageStore(client);
  }
  return pgMessageStore();
}

/**
 * True when an insert failed because the same inbound provider message id
 * already exists: a duplicate webhook delivery. Postgres reports SQLSTATE
 * 23505 (the partial unique index messages_inbound_provider_id_uq); D1 reports
 * "UNIQUE constraint failed". Errors may arrive wrapped, so the cause chain is read.
 */
export function isDuplicateMessage(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e && typeof e === "object"; depth++) {
    const { code, message, cause } = e as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "23505") return true;
    if (typeof message === "string" && /UNIQUE constraint failed/i.test(message)) return true;
    e = cause;
  }
  return false;
}
