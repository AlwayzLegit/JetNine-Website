import { and, desc, eq, ilike, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { users } from "@/db/schema/users";
import { actorName, auditSentence, whenWords, type AuditSentence } from "@/lib/desk-history";
import { likePattern, searchTerm } from "@/domain/common";

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

// The client's name for the sentence, resolved from the subject row so
// "Alex sent 3 options to Tom Okafor" reads like the prototype.
const subjectName = sql<string | null>`case ${auditLog.subjectType}
  when 'quote' then (
    select nullif(trim(coalesce(q.contact_snapshot->>'firstName', '') || ' ' || coalesce(q.contact_snapshot->>'lastName', '')), '')
    from public.quotes q where q.id = ${auditLog.subjectId})
  when 'trip' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from public.trips t join public.members m on m.id = t.member_id join public.users u on u.id = m.user_id
    where t.id = ${auditLog.subjectId})
  when 'invoice' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from public.invoices i join public.members m on m.id = i.member_id join public.users u on u.id = m.user_id
    where i.id = ${auditLog.subjectId})
  when 'member' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from public.members m join public.users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
  when 'membership' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from public.members m join public.users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
  else null end`;

export async function listHistory(input: ListHistoryInput = {}): Promise<HistoryList> {
  const tab = historyTab(input.type);
  const q = searchTerm(input.q);
  const limit = Math.min(HISTORY_MAX_LIMIT, Math.max(1, Math.floor(input.limit ?? HISTORY_MAX_LIMIT)));
  const now = input.now ?? new Date();

  const conditions: SQL[] = [];
  if (tab.key === "other") conditions.push(notInArray(auditLog.subjectType, NAMED_TYPES));
  else if (tab.types) conditions.push(inArray(auditLog.subjectType, tab.types));
  if (q) conditions.push(ilike(auditLog.action, likePattern(q)));
  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        subjectType: auditLog.subjectType,
        subjectId: auditLog.subjectId,
        subjectCode: auditLog.subjectCode,
        diff: auditLog.diff,
        metadata: auditLog.metadata,
        occurredAt: auditLog.occurredAt,
        actorEmail: users.email,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        actorRole: auditLog.actorRole,
        subjectName,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(whereExpr)
      .orderBy(desc(auditLog.occurredAt))
      .limit(limit),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(whereExpr),
  ]);

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
