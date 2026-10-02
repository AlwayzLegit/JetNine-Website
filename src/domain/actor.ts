import { getCurrentUser } from "@/lib/auth";
import { scopesForRole, type Scope } from "@/lib/api-keys";
import { err, ok, type Result } from "./result";

/**
 * Who is doing something. Shared by Server Actions (a signed-in staff
 * user), the API (a key, acting as the user who created it, capped by the
 * key's scopes) and approvals (the human who approved a proposal).
 */
export type Actor = {
  userId: string | null; // null only for the legacy BLOG_ADMIN_API_KEY
  role: string; // users.role, or "legacy"
  via: "session" | "api" | "approval";
  scopes: ReadonlySet<Scope>;
  key?: { id: string; name: string; supervised: boolean; legacy?: boolean };
  runId?: string;
  approvalId?: string;
  requestId?: string;
};

export function hasScope(actor: Actor, scope: Scope): boolean {
  return actor.scopes.has(scope);
}

export function requireScope(actor: Actor, scope: Scope): Result<true> {
  return hasScope(actor, scope)
    ? ok(true)
    : err("forbidden", `This needs the "${scope}" permission.`);
}

/**
 * Non-redirecting session gate for Server Actions and route handlers.
 * Team (dispatcher) sessions get the scopes their role allows; owners get
 * everything.
 */
export async function sessionActor(): Promise<Result<Actor>> {
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Sign in to continue.");
  const scopes = scopesForRole(user.role);
  if (scopes.size === 0) return err("forbidden", "This needs a desk account.");
  return ok({ userId: user.id, role: user.role, via: "session", scopes });
}

/** Audit fields for an actor; merge `metadata` with your own. */
export function auditFields(actor: Actor): {
  actorUserId: string | null;
  actorRole: string;
  metadata: Record<string, unknown>;
} {
  const metadata: Record<string, unknown> = { via: actor.via };
  if (actor.key) {
    metadata.keyId = actor.key.id;
    metadata.keyName = actor.key.name;
    if (actor.key.legacy) metadata.legacyKey = true;
  }
  if (actor.runId) metadata.runId = actor.runId;
  if (actor.approvalId) metadata.approvalId = actor.approvalId;
  if (actor.requestId) metadata.requestId = actor.requestId;
  return { actorUserId: actor.userId, actorRole: actor.role, metadata };
}
