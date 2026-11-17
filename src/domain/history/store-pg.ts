import { and, desc, eq, ilike, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/audit";
import { users } from "@/db/schema/users";
import { likePattern } from "@/domain/common";
import type { HistoryDbRow, HistoryFilter, HistoryStore } from "./store";

// The Postgres side of the history store (OPS-123): the queries that lived in
// src/domain/history/queries.ts, moved as they were.

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

function where(filter: HistoryFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (filter.excludeTypes) conditions.push(notInArray(auditLog.subjectType, [...filter.excludeTypes]));
  else if (filter.types) conditions.push(inArray(auditLog.subjectType, [...filter.types]));
  if (filter.q) conditions.push(ilike(auditLog.action, likePattern(filter.q)));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function pgHistoryStore(): HistoryStore {
  return {
    async historyRows(filter, limit): Promise<HistoryDbRow[]> {
      return db
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
        .where(where(filter))
        .orderBy(desc(auditLog.occurredAt))
        .limit(limit);
    },

    async historyTotal(filter) {
      const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(where(filter));
      return row?.total ?? 0;
    },
  };
}
