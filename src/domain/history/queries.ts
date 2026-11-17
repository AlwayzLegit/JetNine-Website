import type { auditLog } from "@/db/schema/audit";
import { actorName, auditSentence, whenWords, type AuditSentence } from "@/lib/desk-history";
import { searchTerm } from "@/domain/common";
import { historyStore, type HistoryFilter } from "./store";

/**
 * Settings › History: the audit log as plain sentences. Shared by the admin
 * page and GET /api/v1/history. Rows carry the sentence pieces, never the
 * raw diff or metadata (those hold key ids and internal notes).
 */

export type SubjectType = (typeof auditLog.subjectType.enumValues)[number];

/** Plain-word tabs over the audit subject types. */
export const HISTORY_TABS: { key: string; label: string; types: SubjectType[] | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "requests", label: "Requests", types: ["quote"] },
  { key: "trips", label: "Trips", types: ["trip"] },
  { key: "clients", label: "Clients", types: ["member", "membership", "reserve_transaction", "preferences"] },
  { key: "money", label: "Money", types: ["invoice"] },
  { key: "team", label: "Team", types: ["user_role"] },
  { key: "other", label: "Other", types: null },
];

export const HISTORY_TAB_KEYS = HISTORY_TABS.map((t) => t.key);

const NAMED_TYPES = HISTORY_TABS.flatMap((t) => t.types ?? []);

export const HISTORY_MAX_LIMIT = 200;

export type HistoryRow = {
  id: string;
  action: string;
  subjectType: SubjectType;
  subjectId: string | null;
  subjectCode: string | null;
  occurredAt: Date;
  actor: { name: string; role: string | null };
  sentence: AuditSentence;
  /** "Today, 3:12 PM" in Los Angeles time, relative to `now`. */
  when: string;
};

export type HistoryList = { rows: HistoryRow[]; total: number; tab: string; q: string };

export type ListHistoryInput = {
  /** Tab key; unknown values fall back to "all". */
  type?: string;
  q?: string;
  limit?: number;
  now?: Date;
};

/** Resolve the tab for a `type` param, defaulting to "all". */
export function historyTab(type: string | undefined): (typeof HISTORY_TABS)[number] {
  return HISTORY_TABS.find((t) => t.key === type) ?? HISTORY_TABS[0];
}

export async function listHistory(input: ListHistoryInput = {}): Promise<HistoryList> {
  const tab = historyTab(input.type);
  const q = searchTerm(input.q);
  const limit = Math.min(HISTORY_MAX_LIMIT, Math.max(1, Math.floor(input.limit ?? HISTORY_MAX_LIMIT)));
  const now = input.now ?? new Date();

  const filter: HistoryFilter = {
    ...(tab.key === "other" ? { excludeTypes: NAMED_TYPES } : tab.types ? { types: tab.types } : {}),
    ...(q ? { q } : {}),
  };

  const store = historyStore();
  const [rows, total] = await Promise.all([store.historyRows(filter, limit), store.historyTotal(filter)]);

  return {
    tab: tab.key,
    q,
    total,
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      subjectCode: r.subjectCode,
      occurredAt: r.occurredAt,
      actor: { name: actorName(r), role: r.actorRole },
      sentence: auditSentence(r),
      when: whenWords(r.occurredAt, now),
    })),
  };
}
