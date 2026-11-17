import { d1Db, dbTarget } from "@/db";
import { d1ApiKeyStore } from "./store-d1";
import { pgApiKeyStore } from "./store-pg";

// The one door to the api_keys and api_requests tables (OPS-138): the
// Settings > API keys list with its 24 hour counts, create with the cap of working keys,
// revoke, the old blog key's usage, the /api/v1 key sign-in and its last-used stamp, one key's
// limits, the per-call request log and its 30 day clean-up. Every query on those two tables
// goes through an ApiKeyStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging first; the code
// refuses "d1" in production, see src/db/target.mjs).
//
// Two views of the one store keep a key out of key management (scripts/check-api.mts): the
// runtime side (the /api/v1 sign-in, one key's limits, the last-used stamp, the request log and its
// clean-up) is what src/app/api may use; the management side (list, create, revoke, the old key's
// usage) is for src/domain/api-keys only, behind its owner-and-session checks. This file lives
// outside src/domain/api-keys on purpose, so the routes can reach the runtime side at all.
//
// Lookups of a key's name from approvals stay where they are (they move with approvals), and
// the audit log writes stay with logAudit(). The agent's run check (runIsOpenForKey) is the
// agent store's row.

/** One row of Settings > API keys, as read: the creator's name parts are joined by the caller. */
export type KeyListRaw = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  requiresApproval: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  creatorFirst: string | null;
  creatorLast: string | null;
  creatorEmail: string | null;
  creatorDisplay: string | null;
  creatorRole: string | null;
  /** Calls in the last 24 hours (0 when none). */
  calls: number;
  /** Calls in the last 24 hours that answered 400 or more (0 when none). */
  errors: number;
};

/** What a new key stores. The id and the timestamps are made by the adapter. */
export type NewKey = {
  name: string;
  prefix: string;
  tokenHash: string;
  last4: string;
  scopes: string[];
  requiresApproval: boolean;
  createdBy: string;
  expiresAt: Date | null;
};

/** What the /api/v1 sign-in reads for one key prefix, with its creator's role. */
export type AuthKeyRow = {
  id: string;
  name: string;
  tokenHash: string;
  scopes: string[];
  requiresApproval: boolean;
  rateLimitPerMin: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  creatorId: string | null;
  creatorRole: string | null;
};

export type KeyLimits = { createdAt: Date; expiresAt: Date | null; rateLimitPerMin: number };

/** One /api/v1 call (or legacy blog key call) for the request log. */
export type NewApiRequest = {
  keyId: string | null;
  legacy?: boolean;
  method: string;
  route: string;
  status: number;
  errorCode?: string | null;
  durationMs?: number | null;
  ip?: string | null;
  ua?: string | null;
  runId?: string | null;
  requestId?: string | null;
};

export type LegacyUsageRaw = {
  lastUsedAt: Date | null;
  /** Legacy calls in the last 7 days. */
  calls7d: number;
  /** Legacy calls in the log (30 day retention). */
  calls30d: number;
};

export interface ApiKeyStore {
  /** Keys, working ones first then revoked, newest first inside each, with the 24 hour counts. */
  listKeys(): Promise<KeyListRaw[]>;
  /**
   * Insert a key only when fewer than `cap` keys are working (not revoked, not expired).
   * Returns null when the cap refused it. Two creates at the cap together never both succeed.
   */
  createIfUnderCap(values: NewKey, cap: number): Promise<{ id: string } | null>;
  /** Revoke a working key; the key's id, name and prefix, or undefined when it is revoked already or unknown. */
  revoke(id: string, revokedBy: string, reason: string | null): Promise<{ id: string; name: string; prefix: string } | undefined>;
  /** How the old single env key has been used (calls with legacy set). */
  legacyUsage(): Promise<LegacyUsageRaw>;
  /** The sign-in read: the key with this prefix and its creator's role, or undefined. */
  keyForAuth(prefix: string): Promise<AuthKeyRow | undefined>;
  /** One key's created, expires and rate limit, or undefined. */
  keyLimits(id: string): Promise<KeyLimits | undefined>;
  /** Stamp last use, but only when the stored stamp is empty or more than 60 seconds old. */
  touchLastUsed(id: string, ip: string, ua: string | null): Promise<void>;
  /** Append one call to the request log. */
  logRequest(row: NewApiRequest): Promise<void>;
  /** Delete log rows older than 30 days; how many went. */
  deleteRequestsOlderThan30Days(): Promise<number>;
}

/** What the API's own code may use: sign-in, limits, last-used, the request log and its clean-up. */
export type ApiKeyRuntimeStore = Pick<
  ApiKeyStore,
  "keyForAuth" | "keyLimits" | "touchLastUsed" | "logRequest" | "deleteRequestsOlderThan30Days"
>;

/** What Settings > API keys uses (src/domain/api-keys/commands.ts only). */
export type ApiKeyAdminStore = Pick<ApiKeyStore, "listKeys" | "createIfUnderCap" | "revoke" | "legacyUsage">;

/** The store for this request. One call per request; nothing is cached across requests. */
function apiKeyStore(): ApiKeyStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1ApiKeyStore(client);
  }
  return pgApiKeyStore();
}

/** For the /api/v1 sign-in, the key details route, the request log and the daily clean-up. */
export function apiKeyRuntimeStore(): ApiKeyRuntimeStore {
  return apiKeyStore();
}

/** For Settings > API keys. No file under src/app/api may call this (scripts/check-api.mts). */
export function apiKeyAdminStore(): ApiKeyAdminStore {
  return apiKeyStore();
}
