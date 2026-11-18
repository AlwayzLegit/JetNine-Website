import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { authTokens, userCredentials, userSessions } from "@/db/schema/sessions";
import { RoleChangeRefused, roleChangeAllowed } from "@/lib/role-lock";
import type { IdentityStore } from "./store";

// The Postgres side of the identity store (OPS-174): the queries that lived in src/lib/session,
// src/lib/auth-tokens, src/lib/auth-users, the team commands and the health probe, moved as they
// were. The password hash and the ban are still read in place from auth.users (never copied,
// logged or returned), and a role change still sets jn.allow_role_change inside its transaction.

type HashRow = { id: string; hash: string | null };

export function pgIdentityStore(): IdentityStore {
  return {
    async sessionByTokenHash(tokenHash) {
      const [row] = await db
        .select({
          sessionId: userSessions.id,
          expiresAt: userSessions.expiresAt,
          lastSeenAt: userSessions.lastSeenAt,
          id: users.id,
          email: users.email,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(userSessions)
        .innerJoin(users, eq(users.id, userSessions.userId))
        .where(eq(userSessions.tokenHash, tokenHash))
        .limit(1);
      return row;
    },

    async touchSession(sessionId, now) {
      await db.update(userSessions).set({ lastSeenAt: now }).where(eq(userSessions.id, sessionId));
    },

    async insertSession(row) {
      await db.insert(userSessions).values({
        userId: row.userId,
        tokenHash: row.tokenHash,
        createdAt: row.now,
        lastSeenAt: row.now,
        expiresAt: row.expiresAt,
      });
    },

    async sweepSessions(userId, now) {
      await db.delete(userSessions).where(and(eq(userSessions.userId, userId), lt(userSessions.expiresAt, now)));
    },

    async deleteSessionByTokenHash(tokenHash) {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
    },

    async deleteSessionsOfUser(userId) {
      await db.delete(userSessions).where(eq(userSessions.userId, userId));
    },

    async hashForEmail(clean) {
      const rows = await db.execute<HashRow>(sql`
        select u.id as id, coalesce(c.password_hash, a.encrypted_password) as hash
        from public.users u
        left join public.user_credentials c on c.user_id = u.id
        left join auth.users a on a.id = u.id
        where lower(u.email) = ${clean}
          and (a.banned_until is null or a.banned_until <= now())
        limit 1
      `);
      return rows[0];
    },

    async hashForUser(userId) {
      const rows = await db.execute<{ hash: string | null }>(sql`
        select coalesce(c.password_hash, a.encrypted_password) as hash
        from public.users u
        left join public.user_credentials c on c.user_id = u.id
        left join auth.users a on a.id = u.id
        where u.id = ${userId}
        limit 1
      `);
      return rows[0]?.hash ?? null;
    },

    async upsertCredential(userId, passwordHash, now) {
      await db
        .insert(userCredentials)
        .values({ userId, passwordHash, updatedAt: now })
        .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash, updatedAt: now } });
    },

    async hasPassword(userId) {
      const rows = await db.execute<{ has: boolean }>(sql`
        select (c.user_id is not null or coalesce(a.encrypted_password, '') <> '') as has
        from public.users u
        left join public.user_credentials c on c.user_id = u.id
        left join auth.users a on a.id = u.id
        where u.id = ${userId}
        limit 1
      `);
      return rows[0]?.has === true;
    },

    async userForMail(clean) {
      const rows = await db.execute<{ id: string }>(sql`
        select u.id as id
        from public.users u
        left join auth.users a on a.id = u.id
        where lower(u.email) = ${clean}
          and (a.banned_until is null or a.banned_until <= now())
        order by u.created_at asc
        limit 1
      `);
      return rows[0] ?? null;
    },

    async replaceToken(row) {
      await db.delete(authTokens).where(and(eq(authTokens.userId, row.userId), eq(authTokens.purpose, row.purpose), isNull(authTokens.usedAt)));
      await db.insert(authTokens).values({
        userId: row.userId,
        purpose: row.purpose,
        tokenHash: row.tokenHash,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      });
    },

    async sweepTokens(userId, now) {
      await db.delete(authTokens).where(and(eq(authTokens.userId, userId), lt(authTokens.expiresAt, now)));
    },

    async peekToken(tokenHash, purpose) {
      const rows = await db.execute<{ ok: number }>(sql`
        select 1 as ok
        from public.auth_tokens t
        where t.token_hash = ${tokenHash}
          and t.purpose = ${purpose}
          and t.used_at is null
          and t.expires_at > now()
          and not exists (select 1 from auth.users a where a.id = t.user_id and a.banned_until > now())
        limit 1
      `);
      return rows.length > 0;
    },

    async consumeToken(tokenHash, purpose) {
      const rows = await db.execute<{ user_id: string }>(sql`
        update public.auth_tokens t
        set used_at = now()
        where t.token_hash = ${tokenHash}
          and t.purpose = ${purpose}
          and t.used_at is null
          and t.expires_at > now()
          and not exists (select 1 from auth.users a where a.id = t.user_id and a.banned_until > now())
        returning t.user_id
      `);
      return rows[0]?.user_id ?? null;
    },

    async oldestUserByEmail(clean) {
      const [row] = await db
        .select({
          id: users.id,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneE164: users.phoneE164,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${clean}`)
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);
      return row ?? null;
    },

    async insertUser(row) {
      const [made] = await db
        .insert(users)
        .values({ email: row.email, role: "member", firstName: row.firstName, lastName: row.lastName })
        .returning({ id: users.id });
      return made;
    },

    async deleteUser(id) {
      await db.delete(users).where(eq(users.id, id));
    },

    async patchUserProfile(id, patch) {
      await db.update(users).set(patch).where(eq(users.id, id));
    },

    async setRoleGuarded(actorRole, userId, role, extra) {
      const next = role as typeof users.$inferSelect.role;
      await db.transaction(async (tx) => {
        const [current] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
        if (current && !roleChangeAllowed({ actorRole, currentRole: current.role, nextRole: next })) {
          throw new RoleChangeRefused();
        }
        await tx.execute(sql`select set_config('jn.allow_role_change', '1', true)`);
        await tx.update(users).set({ role: next, ...extra, updatedAt: new Date() }).where(eq(users.id, userId));
      });
    },

    async staffIdOfUser(userId) {
      const [row] = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, userId)).limit(1);
      return row;
    },

    async insertStaff(row) {
      await db.insert(staff).values({ userId: row.userId, displayName: row.displayName, status: row.status as "on_call" | "off" });
    },

    async setStaffStatusById(id, status) {
      await db.update(staff).set({ status: status as "on_call" | "off", updatedAt: new Date() }).where(eq(staff.id, id));
    },

    async setStaffStatusByUser(userId, status) {
      await db.update(staff).set({ status: status as "on_call" | "off", updatedAt: new Date() }).where(eq(staff.userId, userId));
    },

    async signinProbe() {
      try {
        await db.execute(sql`select 1 as ok from public.user_sessions limit 1`);
      } catch (err) {
        logProbe(err);
        return "sessions";
      }
      try {
        await db.execute(sql`select 1 as ok from public.auth_tokens limit 1`);
      } catch (err) {
        logProbe(err);
        return "links";
      }
      try {
        const rows = await db.execute<{ present: boolean }>(
          sql`select exists(select 1 from auth.users where encrypted_password is not null) as present`,
        );
        if (rows[0]?.present !== true) return "passwords";
      } catch (err) {
        logProbe(err);
        return "passwords";
      }
      return null;
    },
  };
}

function logProbe(err: unknown) {
  const e = err as { name?: string; code?: string };
  console.error("[health] signin probe failed", { name: e?.name, code: e?.code });
}
