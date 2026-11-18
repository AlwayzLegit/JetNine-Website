import { and, asc, eq, gt, isNull, lt, notExists, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import { authTokens, userCredentials, userSessions } from "@/db/d1/schema/sessions";
import { RoleChangeRefused, roleChangeAllowed } from "@/lib/role-lock";
import type { IdentityStore } from "./store";

// The D1 (SQLite) side of the identity store (OPS-174). Same methods and the same results as
// store-pg.ts, on the D1 twin tables. The client is passed in so a test can hand it a real SQLite,
// and so is the clock.
//
// Differences from Postgres:
// - There is no auth schema. The password hash is user_credentials only, and a ban is
//   users.banned_until (migration 0009, D1 only). A user with a ban in the future gets no hash and
//   cannot spend a link, as on Postgres.
// - Timestamps are integer milliseconds that drizzle maps to Date.
// - A role change has no trigger to get past and no transaction flag. The rule is checked here
//   (roleChangeAllowed) and the write is a compare-and-set on the role that was read, so a role
//   changed by someone else between the read and the write is noticed, not overwritten.
// - consumeToken is ONE update ... returning statement, the same as on Postgres; D1 runs a
//   database's statements one at a time, so two clicks cannot both win.

type D1Client = DrizzleD1Database;

type Role = typeof users.$inferSelect.role;

export function d1IdentityStore(
  db: D1Client,
  now: () => Date = () => new Date(),
  requirePassword: boolean = process.env.DEPLOY_ENV === "production",
): IdentityStore {
  const notBanned = (at: Date) => or(isNull(users.bannedUntil), sql`${users.bannedUntil} <= ${at.getTime()}`);

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

    async touchSession(sessionId, at) {
      await db.update(userSessions).set({ lastSeenAt: at }).where(eq(userSessions.id, sessionId));
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

    async sweepSessions(userId, at) {
      await db.delete(userSessions).where(and(eq(userSessions.userId, userId), lt(userSessions.expiresAt, at)));
    },

    async deleteSessionByTokenHash(tokenHash) {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
    },

    async deleteSessionsOfUser(userId) {
      await db.delete(userSessions).where(eq(userSessions.userId, userId));
    },

    async hashForEmail(clean) {
      const [row] = await db
        .select({ id: users.id, hash: userCredentials.passwordHash })
        .from(users)
        .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
        .where(and(sql`lower(${users.email}) = ${clean}`, notBanned(now())))
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);
      return row ? { id: row.id, hash: row.hash ?? null } : undefined;
    },

    async hashForUser(userId) {
      const [row] = await db
        .select({ hash: userCredentials.passwordHash })
        .from(users)
        .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
        .where(eq(users.id, userId))
        .limit(1);
      return row?.hash ?? null;
    },

    async upsertCredential(userId, passwordHash, at) {
      await db
        .insert(userCredentials)
        .values({ userId, passwordHash, updatedAt: at })
        .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash, updatedAt: at } });
    },

    async hasPassword(userId) {
      const [row] = await db
        .select({ has: userCredentials.userId })
        .from(users)
        .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
        .where(eq(users.id, userId))
        .limit(1);
      return row?.has != null;
    },

    async userForMail(clean) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(sql`lower(${users.email}) = ${clean}`, notBanned(now())))
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);
      return row ?? null;
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

    async sweepTokens(userId, at) {
      await db.delete(authTokens).where(and(eq(authTokens.userId, userId), lt(authTokens.expiresAt, at)));
    },

    async peekToken(tokenHash, purpose, at) {
      const rows = await db
        .select({ id: authTokens.id })
        .from(authTokens)
        .where(tokenIsLive(tokenHash, purpose, at))
        .limit(1);
      return rows.length > 0;
    },

    async consumeToken(tokenHash, purpose, at) {
      const rows = await db
        .update(authTokens)
        .set({ usedAt: at })
        .where(tokenIsLive(tokenHash, purpose, at))
        .returning({ userId: authTokens.userId });
      return rows[0]?.userId ?? null;
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
      const next = role as Role;
      // Read the role, check the rule, then write only if the role is still the one that was read.
      // If it moved in between, read once more and try once more, then refuse: a role change that
      // cannot be shown to be allowed against the current role does not happen.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const [current] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
        if (!current) return; // no such user: the update would change nothing, as on Postgres
        if (!roleChangeAllowed({ actorRole, currentRole: current.role, nextRole: next })) throw new RoleChangeRefused();
        const done = await db
          .update(users)
          .set({ role: next, ...extra, updatedAt: now() })
          .where(and(eq(users.id, userId), eq(users.role, current.role)))
          .returning({ id: users.id });
        if (done.length > 0) return;
      }
      throw new RoleChangeRefused();
    },

    async staffIdOfUser(userId) {
      const [row] = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, userId)).limit(1);
      return row;
    },

    async insertStaff(row) {
      await db.insert(staff).values({ userId: row.userId, displayName: row.displayName, status: row.status as "on_call" | "off" });
    },

    async setStaffStatusById(id, status) {
      await db.update(staff).set({ status: status as "on_call" | "off", updatedAt: now() }).where(eq(staff.id, id));
    },

    async setStaffStatusByUser(userId, status) {
      await db.update(staff).set({ status: status as "on_call" | "off", updatedAt: now() }).where(eq(staff.userId, userId));
    },

    async signinProbe() {
      try {
        await db.select({ id: userSessions.id }).from(userSessions).limit(1);
      } catch (err) {
        logProbe(err);
        return "sessions";
      }
      try {
        await db.select({ id: authTokens.id }).from(authTokens).limit(1);
      } catch (err) {
        logProbe(err);
        return "links";
      }
      try {
        // D1 has no auth.users: a password is a user_credentials row. Staging holds none (real
        // hashes are never copied), so there the table only has to be readable. In production
        // (after the cutover lifts the guard in src/db/target.mjs) somebody must be able to sign in.
        const rows = await db.select({ id: userCredentials.userId }).from(userCredentials).limit(1);
        if (rows.length === 0 && requirePassword) return "passwords";
      } catch (err) {
        logProbe(err);
        return "passwords";
      }
      return null;
    },
  };

  /** A token that is unused, unexpired, of this purpose, and whose user is not banned. */
  function tokenIsLive(tokenHash: string, purpose: string, at: Date) {
    return and(
      eq(authTokens.tokenHash, tokenHash),
      eq(authTokens.purpose, purpose as "signin" | "reset" | "invite"),
      isNull(authTokens.usedAt),
      gt(authTokens.expiresAt, at),
      notExists(
        db
          .select({ one: sql`1` })
          .from(users)
          .where(and(eq(users.id, authTokens.userId), gt(users.bannedUntil, at))),
      ),
    );
  }
}

function logProbe(err: unknown) {
  const e = err as { name?: string; code?: string };
  console.error("[health] signin probe failed", { name: e?.name, code: e?.code });
}
