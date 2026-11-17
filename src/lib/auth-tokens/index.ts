// The database side of the site's emailed links (OPS-94). Pure rules are in
// ./core.mjs. Every caller that issues, checks or spends a link goes through
// this module.
//
// Design (OWASP Forgot Password and Authentication cheat sheets): a random
// 256-bit token, only its SHA-256 stored in auth_tokens, a short expiry, one
// use. GET never spends a token: the landing page only peeks, and the token
// is spent by one atomic UPDATE behind a POST, so two clicks cannot both win
// and a mail scanner that fetches the link cannot use it up.
//
// Never log a token, a hash or a link. On a database error only the error
// name and code are logged.

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema/sessions";
import { expiryFor, hashToken, isPurpose, looksLikeToken, newToken } from "./core.mjs";

export type TokenPurpose = "signin" | "reset" | "invite";

function logDbError(where: string, err: unknown) {
  const e = err as { name?: string; code?: string };
  console.error(`[auth-tokens] ${where} failed`, { name: e?.name, code: e?.code });
}

/**
 * The user a mail goes to, or null. Reads public.users by lower(email),
 * oldest row first (there is no unique index on lower(email), so the choice
 * is deterministic). A banned user (auth.users.banned_until in the future)
 * is refused, the same rule as verifyPassword. Throws on a database error:
 * the caller says "couldn't send" instead of pretending.
 */
export async function findUserForMail(email: string): Promise<{ id: string } | null> {
  const clean = email.trim().toLowerCase();
  try {
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
  } catch (err) {
    logDbError("findUserForMail", err);
    throw new Error("auth link unavailable");
  }
}

/**
 * Makes a new token for `userId` and returns the raw value to put in the
 * link. This user's unused tokens of the same purpose are deleted first, so
 * only the newest link works, and their expired rows are swept.
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  if (!isPurpose(purpose)) throw new Error("unknown purpose");
  const token = newToken();
  const now = new Date();
  try {
    await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
    await db.insert(authTokens).values({
      userId,
      purpose,
      tokenHash: hashToken(token),
      createdAt: now,
      expiresAt: expiryFor(purpose, now),
    });
  } catch (err) {
    logDbError("issueToken", err);
    throw new Error("auth link unavailable");
  }
  // Housekeeping: this user's rows that already ran out. Not worth failing for.
  try {
    await db.delete(authTokens).where(and(eq(authTokens.userId, userId), lt(authTokens.expiresAt, now)));
  } catch (err) {
    logDbError("sweep", err);
  }
  return token;
}

/**
 * Read only: is this token one that consumeToken would accept right now?
 * Used by the GET page. Writes nothing and sets no cookie.
 */
export async function peekToken(raw: string | null | undefined, purpose: string | null | undefined): Promise<boolean> {
  if (!looksLikeToken(raw) || !isPurpose(purpose)) return false;
  try {
    const rows = await db.execute<{ ok: number }>(sql`
      select 1 as ok
      from public.auth_tokens t
      where t.token_hash = ${hashToken(raw as string)}
        and t.purpose = ${purpose as string}
        and t.used_at is null
        and t.expires_at > now()
        and not exists (select 1 from auth.users a where a.id = t.user_id and a.banned_until > now())
      limit 1
    `);
    return rows.length > 0;
  } catch (err) {
    logDbError("peekToken", err);
    return false;
  }
}

/**
 * Spends the token and returns the user it belongs to, or null. ONE
 * statement: the row is marked used only if it is still unused, unexpired,
 * of this purpose and its user is not banned, so two clicks cannot both win.
 */
export async function consumeToken(raw: string | null | undefined, purpose: string | null | undefined): Promise<string | null> {
  if (!looksLikeToken(raw) || !isPurpose(purpose)) return null;
  try {
    const rows = await db.execute<{ user_id: string }>(sql`
      update public.auth_tokens t
      set used_at = now()
      where t.token_hash = ${hashToken(raw as string)}
        and t.purpose = ${purpose as string}
        and t.used_at is null
        and t.expires_at > now()
        and not exists (select 1 from auth.users a where a.id = t.user_id and a.banned_until > now())
      returning t.user_id
    `);
    return rows[0]?.user_id ?? null;
  } catch (err) {
    logDbError("consumeToken", err);
    return null;
  }
}
