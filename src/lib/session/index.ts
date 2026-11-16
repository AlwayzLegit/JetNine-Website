// The site's own sign-in (OPS-91). Every caller that asks "who is signed in"
// or "sign this person in" goes through this one module.
//
// Design (OWASP Session Management, Password Storage and Authentication
// cheat sheets): a random 256-bit token in a host-only cookie, only its
// SHA-256 kept in user_sessions; passwords checked with bcrypt in constant
// time; the same work whether or not the email has an account.
//
// Never log a password, a hash or a token. On a database error only the
// error name and code are logged.

import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, type User } from "@/db/schema/users";
import { userCredentials, userSessions } from "@/db/schema/sessions";
import {
  COOKIE_NAME,
  cookieOptions,
  expiryFrom,
  hashToken,
  isExpired,
  looksLikeToken,
  newToken,
  shouldTouch,
} from "./core.mjs";

export type SessionUser = {
  id: string;
  email: string;
  role: User["role"];
  firstName: string | null;
  lastName: string | null;
};

const BCRYPT_COST = 10;
const MAX_PASSWORD_CHARS = 200;

// A real bcrypt hash of a random string nobody knows. A sign-in for an
// email that has no account compares against it, so the answer takes as
// long as one for an account that exists.
const DUMMY_HASH = "$2b$10$DZ/Vvh2FZZ/TMzFjU8rrte89j05tQOa70YQWawEaVQoiqQWCR7ys2";

function logDbError(where: string, err: unknown) {
  const e = err as { name?: string; code?: string };
  console.error(`[session] ${where} failed`, { name: e?.name, code: e?.code });
}

/** Clears Supabase's old sb- cookies so a stale one cannot linger. */
async function clearLegacyCookies() {
  try {
    const jar = await cookies();
    for (const c of jar.getAll()) {
      if (c.name.startsWith("sb-")) jar.delete(c.name);
    }
  } catch {
    // Not in a context that may write cookies (a Server Component).
  }
}

/**
 * Who is signed in, or null. Never throws: a database error counts as
 * signed out, so the page redirects to /sign-in instead of failing open.
 * Cached per request, so a layout and its page cost one query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!looksLikeToken(token)) return null;

  try {
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
      .where(eq(userSessions.tokenHash, hashToken(token as string)))
      .limit(1);

    if (!row || isExpired(row)) return null;

    if (shouldTouch(row)) {
      try {
        await db.update(userSessions).set({ lastSeenAt: new Date() }).where(eq(userSessions.id, row.sessionId));
      } catch (err) {
        logDbError("touch", err); // not worth failing the request
      }
    }

    return { id: row.id, email: row.email, role: row.role, firstName: row.firstName, lastName: row.lastName };
  } catch (err) {
    logDbError("getSessionUser", err);
    return null;
  }
});

/**
 * Starts a session for `userId` and sets the cookie. Call it from a Server
 * Action or a Route Handler. A new id every time (no session fixation).
 */
export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const now = new Date();
  await db.insert(userSessions).values({
    userId,
    tokenHash: hashToken(token),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: expiryFrom(now),
  });
  // Housekeeping: this user's sessions that already ran out.
  try {
    await db.delete(userSessions).where(and(eq(userSessions.userId, userId), lt(userSessions.expiresAt, now)));
  } catch (err) {
    logDbError("sweep", err);
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, cookieOptions() as Parameters<typeof jar.set>[2]);
  await clearLegacyCookies();
}

/** Ends this browser's session and clears the cookies. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (looksLikeToken(token)) {
    try {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, hashToken(token as string)));
    } catch (err) {
      logDbError("endSession", err);
    }
  }
  jar.delete(COOKIE_NAME);
  await clearLegacyCookies();
}

/** Ends every session of one user (password change). */
export async function endAllSessions(userId: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
}

type HashRow = { id: string; hash: string | null };

/**
 * The user id for an email and password, or null. Reads the hash in place:
 * the new user_credentials row wins, otherwise the older bcrypt hash in
 * auth.users, which is never copied, logged or returned. A banned user is
 * refused. Nothing but the id leaves this function.
 */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const clean = email.trim().toLowerCase();
  let row: HashRow | undefined;
  try {
    const rows = await db.execute<HashRow>(sql`
      select u.id as id, coalesce(c.password_hash, a.encrypted_password) as hash
      from public.users u
      left join public.user_credentials c on c.user_id = u.id
      left join auth.users a on a.id = u.id
      where lower(u.email) = ${clean}
        and (a.banned_until is null or a.banned_until <= now())
      limit 1
    `);
    row = rows[0];
  } catch (err) {
    logDbError("verifyPassword", err);
    throw new Error("sign-in unavailable");
  }

  const ok = await compare(password, row?.hash ?? null);
  return ok && row ? row.id : null;
}

/** Whether `password` is already this user's current password. */
export async function isCurrentPassword(userId: string, password: string): Promise<boolean> {
  try {
    const rows = await db.execute<{ hash: string | null }>(sql`
      select coalesce(c.password_hash, a.encrypted_password) as hash
      from public.users u
      left join public.user_credentials c on c.user_id = u.id
      left join auth.users a on a.id = u.id
      where u.id = ${userId}
      limit 1
    `);
    return await compare(password, rows[0]?.hash ?? null);
  } catch (err) {
    logDbError("isCurrentPassword", err);
    return false;
  }
}

async function compare(password: string, hash: string | null): Promise<boolean> {
  const candidate = password.length > MAX_PASSWORD_CHARS ? password.slice(0, MAX_PASSWORD_CHARS) : password;
  try {
    const ok = await bcrypt.compare(candidate, hash || DUMMY_HASH);
    return hash ? ok : false;
  } catch {
    return false;
  }
}

/**
 * Stores a new password, ends every session of the user and starts a fresh
 * one for this browser. Call it from a Server Action.
 */
export async function setPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db
    .insert(userCredentials)
    .values({ userId, passwordHash, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash, updatedAt: new Date() } });
  await endAllSessions(userId);
  await createSession(userId);
}
