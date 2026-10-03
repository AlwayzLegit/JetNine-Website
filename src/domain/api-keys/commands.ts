import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiRequests } from "@/db/schema/api";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { KEY_TEMPLATES, isScope, mintToken, scopesForRole, type Scope } from "@/lib/api-keys";
import { logAudit } from "@/lib/audit";
import { personName } from "@/lib/desk-status";
import { auditFields, type Actor } from "@/domain/actor";
import { err, ok, type Result } from "@/domain/result";

/**
 * Settings › API keys. Session-only by design: no /api/v1 route ever calls
 * these, so a key can never mint or revoke keys. Owners only.
 */

export const EXPIRY_CHOICES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
  { days: null, label: "Never" },
] as const;

const MAX_ACTIVE_KEYS = 25;

function isOwner(actor: Actor): boolean {
  return actor.via === "session" && (actor.role === "admin" || actor.role === "superadmin");
}

export type KeyListRow = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: Scope[];
  requiresApproval: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  creatorName: string | null;
  creatorRole: string | null;
  calls24h: number;
  errors24h: number;
};

export async function listKeys(): Promise<KeyListRow[]> {
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

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    last4: r.last4,
    scopes: r.scopes.filter(isScope),
    requiresApproval: r.requiresApproval,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    lastUsedAt: r.lastUsedAt,
    lastUsedIp: r.lastUsedIp,
    revokedAt: r.revokedAt,
    revokeReason: r.revokeReason,
    creatorName: r.creatorEmail
      ? r.creatorDisplay?.trim() || personName(r.creatorFirst, r.creatorLast, r.creatorEmail.split("@")[0])
      : null,
    creatorRole: r.creatorRole,
    calls24h: Number(r.calls ?? 0),
    errors24h: Number(r.errors ?? 0),
  }));
}

export type CreateKeyInput = {
  name: unknown;
  template: unknown;
  scopes: unknown;
  supervised: unknown;
  expiresInDays: unknown;
};

export type CreatedKey = { id: string; name: string; token: string };

export async function createKey(actor: Actor, input: CreateKeyInput): Promise<Result<CreatedKey>> {
  if (!isOwner(actor) || !actor.userId) return err("forbidden", "Only an owner can create API keys.");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 60) return err("invalid", "Give the key a name of up to 60 characters.");

  const template = KEY_TEMPLATES.find((t) => t.id === input.template);
  let scopes: Scope[];
  let supervised: boolean;
  if (template) {
    scopes = [...template.scopes];
    supervised = template.supervised;
  } else {
    const raw = Array.isArray(input.scopes) ? input.scopes : [];
    scopes = [...new Set(raw.filter((s): s is Scope => typeof s === "string" && isScope(s)))];
    supervised = input.supervised === true || input.supervised === "on" || input.supervised === "true";
  }
  if (scopes.length === 0) return err("invalid", "Pick at least one permission.");
  // The assistant's key always asks first (also enforced by a CHECK constraint).
  if (scopes.includes("agent")) supervised = true;

  const allowed = scopesForRole(actor.role);
  const beyond = scopes.filter((s) => !allowed.has(s));
  if (beyond.length) return err("forbidden", `You can't give a key more than you can do (${beyond.join(", ")}).`);

  const days = input.expiresInDays === null || input.expiresInDays === "" || input.expiresInDays === "never"
    ? null
    : Number(input.expiresInDays);
  if (days !== null && !EXPIRY_CHOICES.some((c) => c.days === days)) return err("invalid", "Pick when the key expires.");
  const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000);

  const minted = mintToken();
  const creatorId = actor.userId;
  // Count and insert under one advisory lock so two creates can't both
  // slip past the cap.
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('api_keys.create'))`);
    const [{ active }] = await tx
      .select({ active: count() })
      .from(apiKeys)
      .where(and(isNull(apiKeys.revokedAt), sql`(${apiKeys.expiresAt} is null or ${apiKeys.expiresAt} > now())`));
    if (active >= MAX_ACTIVE_KEYS) return null;
    const [inserted] = await tx
      .insert(apiKeys)
      .values({
        name,
        prefix: minted.prefix,
        tokenHash: minted.hash,
        last4: minted.last4,
        scopes,
        requiresApproval: supervised,
        createdBy: creatorId,
        expiresAt,
      })
      .returning({ id: apiKeys.id });
    return inserted;
  });
  if (!row) return err("conflict", `There are already ${MAX_ACTIVE_KEYS} working keys. Revoke one first.`);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "api_key.create",
    subjectType: "api_key",
    subjectId: row.id,
    subjectCode: minted.prefix,
    metadata: { ...a.metadata, name, scopes, supervised, expiresAt: expiresAt?.toISOString() ?? null },
  });

  return ok({ id: row.id, name, token: minted.token });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function revokeKey(actor: Actor, id: unknown, reason: unknown): Promise<Result<{ name: string }>> {
  if (!isOwner(actor) || !actor.userId) return err("forbidden", "Only an owner can revoke API keys.");
  if (typeof id !== "string" || !UUID_RE.test(id)) return err("not_found", "That key no longer exists.");
  const note = typeof reason === "string" ? reason.trim().slice(0, 200) || null : null;

  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), revokedBy: actor.userId, revokeReason: note })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix });
  if (!row) return err("not_found", "That key is already revoked or no longer exists.");

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "api_key.revoke",
    subjectType: "api_key",
    subjectId: row.id,
    subjectCode: row.prefix,
    metadata: { ...a.metadata, name: row.name, reason: note },
  });
  return ok({ name: row.name });
}

// ─── The old blog key ───────────────────────────────────────────────────

export type LegacyKeyUsage = {
  /** BLOG_ADMIN_API_KEY is set in the environment. */
  configured: boolean;
  lastUsedAt: Date | null;
  calls7d: number;
  calls30d: number;
  /** True when the key may be removed: configured, and nothing has used it for 7 days. */
  retirable: boolean;
};

/**
 * How the old single env key is still being used, so the owner knows when it
 * is safe to remove it from Vercel. Reads the per-call log (30-day
 * retention); the key itself is never read here.
 */
export async function legacyKeyUsage(now = new Date()): Promise<LegacyKeyUsage> {
  const configured = Boolean(process.env.BLOG_ADMIN_API_KEY);
  const [row] = await db
    .select({
      lastUsedAt: sql<string | null>`max(${apiRequests.at})`,
      calls7d: sql<number>`count(*) filter (where ${apiRequests.at} > now() - interval '7 days')::int`,
      calls30d: sql<number>`count(*)::int`,
    })
    .from(apiRequests)
    .where(eq(apiRequests.legacy, true));
  const lastUsedAt = row?.lastUsedAt ? new Date(row.lastUsedAt) : null;
  const calls7d = Number(row?.calls7d ?? 0);
  return {
    configured,
    lastUsedAt,
    calls7d,
    calls30d: Number(row?.calls30d ?? 0),
    retirable: configured && calls7d === 0 && (!lastUsedAt || now.getTime() - lastUsedAt.getTime() > 7 * 86_400_000),
  };
}
