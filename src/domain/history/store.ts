import { d1Db, dbTarget } from "@/db";
import type { auditLog } from "@/db/schema/audit";
import { d1HistoryStore } from "./store-d1";
import { pgHistoryStore } from "./store-pg";

// The audit log's read side, Settings > History and GET /api/v1/history (OPS-123). One
// adapter per database, chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). The write side is src/lib/audit-store.ts.

type AuditSubjectType = (typeof auditLog.subjectType.enumValues)[number];

/** What a tab and a search ask for: only these types, or all but these, and a text in the action. */
export type HistoryFilter = {
  types?: readonly AuditSubjectType[];
  excludeTypes?: readonly AuditSubjectType[];
  /** Already trimmed; matched anywhere in the action without regard to case, % and _ literal. */
  q?: string;
};

/** A row as the stores return it: the diff and metadata are for the sentence only, never sent on. */
export type HistoryDbRow = {
  id: string;
  action: string;
  subjectType: AuditSubjectType;
  subjectId: string | null;
  subjectCode: string | null;
  diff: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
  actorEmail: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  actorRole: string | null;
  /** The client's name for the sentence, from the quote, trip, invoice or member the row is about. */
  subjectName: string | null;
};

export interface HistoryStore {
  /** Newest first. */
  historyRows(filter: HistoryFilter, limit: number): Promise<HistoryDbRow[]>;
  historyTotal(filter: HistoryFilter): Promise<number>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function historyStore(): HistoryStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1HistoryStore(client);
  }
  return pgHistoryStore();
}
