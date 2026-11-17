import { and, count, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { auditLog } from "@/db/d1/schema/audit";
import { users } from "@/db/d1/schema/users";
import { likePattern } from "@/domain/common";
import type { HistoryDbRow, HistoryFilter, HistoryStore } from "./store";

// The D1 (SQLite) side of the history store (OPS-123). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so a
// test can hand it a real SQLite.
//
// Differences from Postgres: the subject name reads the quote's snapshot with json_extract
// (the column is JSON text, there is no ->> operator), the tables need no `public.` prefix,
// the search is lower(action) like lower(pattern) with a backslash escape (SQLite has no
// ilike), and count(*) needs no ::int cast. occurred_at is integer milliseconds, so the sort
// is chronological.

const subjectName = sql<string | null>`case ${auditLog.subjectType}
  when 'quote' then (
    select nullif(trim(coalesce(json_extract(q.contact_snapshot, '$.firstName'), '') || ' ' || coalesce(json_extract(q.contact_snapshot, '$.lastName'), '')), '')
    from quotes q where q.id = ${auditLog.subjectId})
  when 'trip' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from trips t join members m on m.id = t.member_id join users u on u.id = m.user_id
    where t.id = ${auditLog.subjectId})
  when 'invoice' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from invoices i join members m on m.id = i.member_id join users u on u.id = m.user_id
    where i.id = ${auditLog.subjectId})
  when 'member' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from members m join users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
  when 'membership' then (
    select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
    from members m join users u on u.id = m.user_id where m.id = ${auditLog.subjectId})
  else null end`;

function where(filter: HistoryFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (filter.excludeTypes) conditions.push(notInArray(auditLog.subjectType, [...filter.excludeTypes]));
  else if (filter.types) conditions.push(inArray(auditLog.subjectType, [...filter.types]));
  if (filter.q) conditions.push(sql`lower(${auditLog.action}) like lower(${likePattern(filter.q)}) escape '\\'`);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function d1HistoryStore(db: DrizzleD1Database): HistoryStore {
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
      const [row] = await db.select({ total: count() }).from(auditLog).where(where(filter));
      return row?.total ?? 0;
    },
  };
}
