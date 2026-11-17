import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { apiKeys, apiRequests } from "@/db/d1/schema/api";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import { newId } from "@/db/d1/helpers";
import type { ApiKeyStore } from "./store";

// The D1 (SQLite) side of the API key store (OPS-138). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema/api.ts, OPS-100). The client is passed
// in so a test can hand it a real SQLite, and so is the clock.
//
// Differences from Postgres: ids are text made by newId() (api_requests keeps its counter),
// the timestamps are integer milliseconds that drizzle maps to Date, scopes are JSON text,
// requires_approval is an integer, and every now() and interval becomes a millisecond value
// computed here. count(*) filter (where ...) becomes sum(case when ... then 1 else 0 end).
//
// The cap on working keys is ONE statement, insert ... select ... where (count) < cap, so there
// is no gap between the count and the insert for a second create to slip through (D1 runs a
// database's statements one at a time). It replaces the Postgres advisory lock.

type D1Client = DrizzleD1Database;

const DAY = 86_400_000;

/**
 * @param canonicalRole where a person's role really lives. Until the users domain moves to D1 that
 *   is Postgres, and the D1 `users` table is only a periodic copy, so the sign-in must not take a
 *   key's authority from the copy: a person demoted or removed in Postgres would keep it (Codex
 *   review of OPS-138). Returns null for a user that no longer exists. When left out, the D1 role is used
 *   (tests, and the day users are in D1).
 */
export function d1ApiKeyStore(
  db: D1Client,
  now: () => Date = () => new Date(),
  canonicalRole?: (userId: string) => Promise<string | null>,
): ApiKeyStore {
  return {
    async listKeys() {
      const since = new Date(now().getTime() - DAY);
      const usage = db
        .select({
          keyId: apiRequests.keyId,
          calls: count().as("calls"),
          errors: sql<number>`sum(case when ${apiRequests.status} >= 400 then 1 else 0 end)`.as("errors"),
        })
        .from(apiRequests)
        .where(gt(apiRequests.at, since))
        .groupBy(apiRequests.keyId)
        .as("usage");

      const rows = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          last4: apiKeys.last4,
          scopes: apiKeys.scopes,
          requiresApproval: apiKeys.requiresApproval,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          lastUsedIp: apiKeys.lastUsedIp,
          revokedAt: apiKeys.revokedAt,
          revokeReason: apiKeys.revokeReason,
          creatorFirst: users.firstName,
          creatorLast: users.lastName,
          creatorEmail: users.email,
          creatorDisplay: staff.displayName,
          creatorRole: users.role,
          calls: usage.calls,
          errors: usage.errors,
        })
        .from(apiKeys)
        .leftJoin(users, eq(users.id, apiKeys.createdBy))
        .leftJoin(staff, eq(staff.userId, apiKeys.createdBy))
        .leftJoin(usage, eq(usage.keyId, apiKeys.id))
        .orderBy(sql`${apiKeys.revokedAt} is not null`, desc(apiKeys.createdAt));

      return rows.map((r) => ({ ...r, calls: Number(r.calls ?? 0), errors: Number(r.errors ?? 0) }));
    },

    async createIfUnderCap(values, cap) {
      const at = now();
      const id = newId();
      const found = await db.all<{ id: string }>(sql`
        insert into api_keys
          (id, name, prefix, token_hash, last4, scopes, requires_approval, created_by, created_at, expires_at)
        select ${id}, ${values.name}, ${values.prefix}, ${values.tokenHash}, ${values.last4},
               ${JSON.stringify(values.scopes)}, ${values.requiresApproval ? 1 : 0}, ${values.createdBy},
               ${at.getTime()}, ${values.expiresAt ? values.expiresAt.getTime() : null}
        where (
          select count(*) from api_keys
          where revoked_at is null and (expires_at is null or expires_at > ${at.getTime()})
        ) < ${cap}
        returning id
      `);
      return found.length > 0 ? { id } : null;
    },

    async revoke(id, revokedBy, reason) {
      const [row] = await db
        .update(apiKeys)
        .set({ revokedAt: now(), revokedBy, revokeReason: reason })
        .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix });
      return row;
    },

    async legacyUsage() {
      const since7 = now().getTime() - 7 * DAY;
      const [row] = await db
        .select({
          // A raw max() comes back as a number of milliseconds, not a Date.
          lastUsedAt: sql<number | null>`max(${apiRequests.at})`,
          calls7d: sql<number>`coalesce(sum(case when ${apiRequests.at} > ${since7} then 1 else 0 end), 0)`,
          calls30d: sql<number>`count(*)`,
        })
        .from(apiRequests)
        .where(eq(apiRequests.legacy, true));
      return {
        lastUsedAt: row?.lastUsedAt != null ? new Date(Number(row.lastUsedAt)) : null,
        calls7d: Number(row?.calls7d ?? 0),
        calls30d: Number(row?.calls30d ?? 0),
      };
    },

    async keyForAuth(prefix) {
      const [row] = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          tokenHash: apiKeys.tokenHash,
          scopes: apiKeys.scopes,
          requiresApproval: apiKeys.requiresApproval,
          rateLimitPerMin: apiKeys.rateLimitPerMin,
          expiresAt: apiKeys.expiresAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          creatorId: users.id,
          creatorRole: users.role,
        })
        .from(apiKeys)
        .leftJoin(users, eq(users.id, apiKeys.createdBy))
        .where(eq(apiKeys.prefix, prefix))
        .limit(1);
      if (row?.creatorId && canonicalRole) {
        // A failed read throws, and the sign-in fails closed ("temporarily unavailable").
        return { ...row, creatorRole: await canonicalRole(row.creatorId) };
      }
      return row;
    },

    async keyLimits(id) {
      const [row] = await db
        .select({ createdAt: apiKeys.createdAt, expiresAt: apiKeys.expiresAt, rateLimitPerMin: apiKeys.rateLimitPerMin })
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .limit(1);
      return row;
    },

    async touchLastUsed(id, ip, ua) {
      const at = now();
      await db
        .update(apiKeys)
        .set({ lastUsedAt: at, lastUsedIp: ip, lastUsedUa: ua })
        .where(
          and(
            eq(apiKeys.id, id),
            or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, new Date(at.getTime() - 60_000))),
          ),
        );
    },

    async logRequest(row) {
      await db.insert(apiRequests).values({ ...row, at: now() });
    },

    async deleteRequestsOlderThan30Days() {
      const gone = await db
        .delete(apiRequests)
        .where(lt(apiRequests.at, new Date(now().getTime() - 30 * DAY)))
        .returning({ id: apiRequests.id });
      return gone.length;
    },
  };
}
