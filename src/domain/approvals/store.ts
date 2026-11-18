import { d1Db, dbTarget } from "@/db";
import type { Approval, ApprovalStatus } from "@/db/schema/approvals";
import { d1ApprovalStore } from "./store-d1";
import { pgApprovalStore } from "./store-pg";

// The approvals domain's one door to the approvals table (OPS-150): the assistant's proposals
// (queue.ts), deciding one (commands.ts: the conditional claim, the final write, the expiry
// sweep) and the lists and counts behind the "Needs your OK" tab, the detail pages and the
// assistant's feedback (queries.ts). Every query on that table goes through an ApprovalStore.
// There is one adapter per database, chosen per request by dbTarget(): Postgres until the move,
// D1 where DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). The operation an approval carries out keeps running through its own
// domain and is not part of this store.

/** The columns a new proposal writes (the rest take their defaults). */
export type NewApprovalValues = {
  op: string;
  payload: Record<string, unknown>;
  summary: string;
  preview: string | null;
  reason: string | null;
  risk: Approval["risk"];
  subjectType: string | null;
  subjectId: string | null;
  subjectCode: string | null;
  dedupeKey: string;
  requestedByKey: string | null;
  requestedByUser: string | null;
  runId: string | null;
};

/** One approval with the names the lists show: the proposing key and the person who decided. */
export type ApprovalJoinedRow = {
  approval: Approval;
  keyName: string | null;
  decFirst: string | null;
  decLast: string | null;
  decEmail: string | null;
  decDisplay: string | null;
};

/** What the final write after the operation ran sets. */
export type ApprovalFinish =
  | { status: "executed"; result: unknown; editedPayload: Record<string, unknown> | null }
  | { status: "failed"; error: string; editedPayload: Record<string, unknown> | null };

export interface ApprovalStore {
  /** Expire a pending proposal with this dedupe key whose expiry has passed, so a fresh one can be queued. */
  expireStaleTwin(dedupeKey: string, now: Date): Promise<void>;
  /** The pending proposal with this dedupe key, if any. */
  pendingByDedupe(dedupeKey: string): Promise<Approval | undefined>;
  /** How many proposals one assistant run has made. */
  countForRun(runId: string): Promise<number>;
  /** How many proposals one key has made since `since`. */
  countForKeySince(keyId: string, since: Date): Promise<number>;
  /** A new proposal. Throws when the insert fails; a duplicate dedupe key is recognised by isUniqueViolation. */
  insert(values: NewApprovalValues): Promise<Approval>;
  /** One approval, plain. */
  getById(id: string): Promise<Approval | undefined>;
  /**
   * The conditional claim: set the status and who decided, only while the row is still pending.
   * Returns the row once, and nothing to a second caller.
   */
  claim(id: string, decidedBy: string | null, next: "executing" | "rejected" | "expired", note: string | null, now: Date): Promise<Approval | undefined>;
  /** The final write after the operation ran. */
  finish(id: string, patch: ApprovalFinish): Promise<Approval | undefined>;
  /** The name of the key that proposed an approval. */
  keyName(keyId: string): Promise<{ id: string; name: string } | undefined>;

  listJoined(statuses: ApprovalStatus[], keyId: string | undefined, limit: number): Promise<ApprovalJoinedRow[]>;
  getJoined(id: string): Promise<ApprovalJoinedRow | undefined>;
  pendingForSubject(subjectType: string, subjectId: string): Promise<ApprovalJoinedRow[]>;
  countPending(): Promise<number>;
  /** Decided proposals (executed, failed, rejected, expired) since `since`, newest first. */
  decidedSince(since: Date, limit: number): Promise<Approval[]>;
  /** Pending proposals past their expiry become expired; an executing one older than an hour becomes failed. The number changed. */
  expirePending(now: Date): Promise<number>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function approvalStore(): ApprovalStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1ApprovalStore(client);
  }
  return pgApprovalStore();
}
