import { d1Db, dbTarget } from "@/db";
import type { User } from "@/db/schema/users";
import { d1IdentityStore } from "./store-d1";
import { pgIdentityStore } from "./store-pg";

// The one door to the identity tables (OPS-174): users (the sign-in side), user_sessions,
// user_credentials, auth_tokens and the staff rows the team commands write. The site's own sign-in
// (src/lib/session), its emailed links (src/lib/auth-tokens), the user helpers (src/lib/auth-users),
// the team's staff writes and the health probe go through an IdentityStore. There is one adapter per
// database, chosen per request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1"
// (staging first; the code refuses "d1" in production, see src/db/target.mjs).
//
// Ban rule. On Postgres a ban is auth.users.banned_until, read in place and never copied. D1 has no
// auth schema, so D1 keeps it in users.banned_until (migration 0009). Both adapters refuse a user
// whose ban is in the future when they hand out a password hash or spend a link.
//
// Password rule. On Postgres the hash is user_credentials.password_hash, else the older bcrypt hash
// in auth.users.encrypted_password. On D1 there is no auth.users: the hash is user_credentials only.
// Real hashes are never copied to staging D1 (src/scripts d1-copy holds user_credentials back).

export type UserRole = User["role"];

/** What the session lookup reads: the session row joined with its user. */
export type SessionRow = {
  sessionId: string;
  expiresAt: Date;
  lastSeenAt: Date;
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
};

export type NewSession = { userId: string; tokenHash: string; now: Date; expiresAt: Date };

export type NewLinkToken = {
  userId: string;
  purpose: "signin" | "reset" | "invite";
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

/** The oldest users row for an email, as the invite flow reads it. */
export type UserRow = {
  id: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
};

export type StaffStatus = "on_call" | "off" | (string & {});

export interface IdentityStore {
  // sessions
  /** The session with this token hash and its user, or undefined. Expiry is judged by the caller. */
  sessionByTokenHash(tokenHash: string): Promise<SessionRow | undefined>;
  touchSession(sessionId: string, now: Date): Promise<void>;
  insertSession(row: NewSession): Promise<void>;
  /** This user's sessions that ran out before `now`. */
  sweepSessions(userId: string, now: Date): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionsOfUser(userId: string): Promise<void>;

  // passwords
  /** The user id and password hash for a clean (trimmed, lower case) email; undefined when no user or the user is banned. */
  hashForEmail(cleanEmail: string): Promise<{ id: string; hash: string | null } | undefined>;
  /** The current password hash of a user, or null (no user, no password). Bans are not looked at. */
  hashForUser(userId: string): Promise<string | null>;
  upsertCredential(userId: string, passwordHash: string, now: Date): Promise<void>;
  /** Whether the user can sign in with a password. */
  hasPassword(userId: string): Promise<boolean>;

  // emailed links
  /** The oldest user for a clean email who is not banned. */
  userForMail(cleanEmail: string): Promise<{ id: string } | null>;
  /** Delete this user's unused tokens of the purpose, then insert the new one. */
  replaceToken(row: NewLinkToken): Promise<void>;
  /** This user's tokens that ran out before `now`. */
  sweepTokens(userId: string, now: Date): Promise<void>;
  /** Would consumeToken accept this token right now? Writes nothing. */
  peekToken(tokenHash: string, purpose: string, now: Date): Promise<boolean>;
  /** Spend the token in ONE statement and return its user id, or null. */
  consumeToken(tokenHash: string, purpose: string, now: Date): Promise<string | null>;

  // users
  oldestUserByEmail(cleanEmail: string): Promise<UserRow | null>;
  insertUser(row: { email: string; firstName: string | null; lastName: string | null }): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
  patchUserProfile(id: string, patch: { firstName: string | null; lastName: string | null; phoneE164: string | null }): Promise<void>;
  /** Change a user's role. Refuses (RoleChangeRefused) unless the actor is an admin. */
  setRoleGuarded(
    actorRole: string | null | undefined,
    userId: string,
    role: string,
    extra: { firstName?: string | null; lastName?: string | null },
  ): Promise<void>;

  // staff rows written by the team commands
  staffIdOfUser(userId: string): Promise<{ id: string } | undefined>;
  insertStaff(row: { userId: string; displayName: string; status: StaffStatus }): Promise<void>;
  setStaffStatusById(id: string, status: StaffStatus): Promise<void>;
  setStaffStatusByUser(userId: string, status: StaffStatus): Promise<void>;

  // health (src/lib/health.ts checkSignin)
  /** The first thing that is wrong with sign-in, or null: sessions table, links table, or no password anywhere. */
  signinProbe(): Promise<"sessions" | "links" | "passwords" | null>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function identityStore(): IdentityStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1IdentityStore(client);
  }
  return pgIdentityStore();
}
