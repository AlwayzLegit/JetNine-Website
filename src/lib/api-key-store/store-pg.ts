import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiRequests } from "@/db/schema/api";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import type { ApiKeyStore } from "./store";

// The Postgres side of the API key store (OPS-138): the queries that lived in the API keys
// commands, the /api/v1 sign-in, the key details route, the request log and the daily clean-up,
// moved as they were (the create is still one transaction under an advisory lock, and the
// time windows still use now()).

export function pgApiKeyStore(): ApiKeyStore {
  return {
    async listKeys() {
      const usage = db
        .select({
          keyId: apiRequests.keyId,
          calls: count().as("calls"),
          errors: sql<number>`count(*) filter (where ${apiRequests.status} >= 400)`.as("errors"),
        })
        .from(apiRequests)
        .where(gt(apiRequests.at, sql`now() - interval '24 hours'`))
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
      // Count and insert under one advisory lock so two creates can't both slip past the cap.
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('api_keys.create'))`);
        const [{ active }] = await tx
          .select({ active: count() })
          .from(apiKeys)
          .where(and(isNull(apiKeys.revokedAt), sql`(${apiKeys.expiresAt} is null or ${apiKeys.expiresAt} > now())`));
        if (active >= cap) return null;
        const [inserted] = await tx.insert(apiKeys).values(values).returning({ id: apiKeys.id });
        return inserted;
      });
    },

    async revoke(id, revokedBy, reason) {
      const [row] = await db
        .update(apiKeys)
        .set({ revokedAt: new Date(), revokedBy, revokeReason: reason })
        .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix });
      return row;
    },

    async legacyUsage() {
      const [row] = await db
        .select({
          lastUsedAt: sql<string | null>`max(${apiRequests.at})`,
          calls7d: sql<number>`count(*) filter (where ${apiRequests.at} > now() - interval '7 days')::int`,
          calls30d: sql<number>`count(*)::int`,
        })
        .from(apiRequests)
        .where(eq(apiRequests.legacy, true));
      return {
        lastUsedAt: row?.lastUsedAt ? new Date(row.lastUsedAt) : null,
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
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date(), lastUsedIp: ip, lastUsedUa: ua })
        .where(
          and(
            eq(apiKeys.id, id),
            or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, sql`now() - interval '60 seconds'`)),
          ),
        );
    },

    async logRequest(row) {
      await db.insert(apiRequests).values(row);
    },

    async deleteRequestsOlderThan30Days() {
      const pruned = await db
        .delete(apiRequests)
        .where(lt(apiRequests.at, sql`now() - interval '30 days'`))
        .returning({ id: apiRequests.id });
      return pruned.length;
    },
  };
}

/**
 * A person's role in Postgres, the source of truth until the users domain moves, or null when the
 * person no longer exists. The D1 key sign-in asks this instead of trusting its copy of `users`.
 */
export async function pgUserRole(userId: string): Promise<string | null> {
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.role ?? null;
}
