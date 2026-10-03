import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { findAuthUserIdByEmail, setUserRole } from "@/lib/auth-users";
import { deskRole, personName, type DeskRole } from "@/lib/desk-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import type { TeamInviteInput, TeamRefInput, TeamRoleInput } from "./schemas";

/**
 * Team commands (Settings › Team), shared by the admin's Server Actions,
 * the API and the approval queue through the ops in ./ops.ts. Two words
 * map onto the database roles: Owner = admin, Team = dispatcher.
 * `superadmin` rows show as Owner and are never changed from here.
 *
 * The guards the desk has always had stay here: never yourself, never a
 * superadmin, at least one owner remains. Nothing here checks the session
 * or revalidates: the op declares its paths and `runOp` handles both.
 *
 * Keep this file free of `server-only` imports: scripts/check-api.mts
 * loads the route registry under tsx.
 */

export const NOT_ON_DESK = "That person is not on the desk.";

const OWNER_ROLES = ["admin", "superadmin"] as const;
const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

export type DbDeskRole = "admin" | "dispatcher";

export function dbRoleFor(role: DeskRole): DbDeskRole {
  return role === "owner" ? "admin" : "dispatcher";
}

async function ownersOtherThan(userId: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, [...OWNER_ROLES]), ne(users.id, userId)));
  return rows.length;
}

export type Teammate = {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
};

export type TeammateState = {
  target: Teammate;
  /** Display name when set, else first + last, else the email. */
  name: string;
  /** Owners on the desk other than the target. */
  otherOwners: number;
};

/** The person an op acts on; not_found when they are not on the desk. */
export async function loadTeammate(input: TeamRefInput): Promise<Result<TeammateState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_ON_DESK);
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: staff.displayName,
    })
    .from(users)
    .leftJoin(staff, eq(staff.userId, users.id))
    .where(eq(users.id, input.id))
    .limit(1);
  if (!row || !deskRole(row.role)) return err("not_found", NOT_ON_DESK);
  return ok({
    target: row,
    name: row.displayName ?? personName(row.firstName, row.lastName, row.email),
    otherOwners: await ownersOtherThan(row.id),
  });
}

export async function loadForInvite(): Promise<Result<Record<string, never>>> {
  return ok({});
}

// ─── Invite ─────────────────────────────────────────────────────────────

export type InviteOutcome = {
  id: string;
  email: string;
  name: string;
  role: DeskRole;
  /** True when a sign-in invitation went out; false when an existing account was given the role. */
  invited: boolean;
};

export async function inviteTeammate(actor: Actor, input: TeamInviteInput): Promise<Result<InviteOutcome>> {
  const { email, firstName, lastName, role } = input;
  const supa = createAdminClient();

  // 1) Resolve the auth user — reuse if it exists, otherwise invite. Same
  //    pattern as the client invite.
  let authUserId: string;
  let isNewAuthUser = false;
  const hit = await findAuthUserIdByEmail(email);
  if (hit) {
    authUserId = hit;
  } else {
    const { data: invited, error: inviteErr } = await supa.auth.admin.inviteUserByEmail(email, {
      data: { first_name: firstName, last_name: lastName },
    });
    if (inviteErr || !invited?.user) {
      console.error("inviteUserByEmail failed", inviteErr);
      return err("unavailable", inviteErr?.message ?? "The invite did not go out. Try again.");
    }
    authUserId = invited.user.id;
    isNewAuthUser = true;
  }

  // 2) The handle_new_auth_user trigger inserts public.users; brief retry
  //    because the GoTrue call crosses an HTTP boundary.
  const userRow = await waitForUserRow(authUserId);
  if (!userRow) {
    return err("unavailable", "The account was created but did not show up yet. Try again in a moment.");
  }
  if ((STAFF_ROLES as readonly string[]).includes(userRow.role)) {
    return err("conflict", `${personName(userRow.firstName, userRow.lastName, email)} is already on the desk.`);
  }

  // 3) Role + names.
  const dbRole = dbRoleFor(role);
  try {
    await setUserRole(authUserId, dbRole, {
      firstName: firstName ?? userRow.firstName,
      lastName: lastName ?? userRow.lastName,
    });
  } catch (e) {
    console.error("[team] role update failed", e);
    return err(
      "internal",
      isNewAuthUser
        ? "The invite email went out, but the desk role could not be set. Open Team again and use Change on their row."
        : "The desk role could not be set. Try again.",
    );
  }

  // 4) Staff row (display name) when none exists; a removed teammate's
  //    row is switched back on.
  const displayName =
    personName(firstName ?? userRow.firstName, lastName ?? userRow.lastName, "") || email.split("@")[0];
  const [staffRow] = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, authUserId)).limit(1);
  if (!staffRow) {
    await db.insert(staff).values({ userId: authUserId, displayName, status: "on_call" });
  } else {
    await db.update(staff).set({ status: "on_call", updatedAt: new Date() }).where(eq(staff.id, staffRow.id));
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "user_role.invite",
    subjectType: "user_role",
    subjectId: authUserId,
    subjectCode: email,
    diff: { role: { before: userRow.role, after: dbRole } },
    metadata: { ...a.metadata, name: displayName, role, isNewAuthUser },
  });

  return ok({ id: authUserId, email, name: displayName, role, invited: isNewAuthUser });
}

// ─── Change role ────────────────────────────────────────────────────────

export type RoleOutcome = {
  id: string;
  name: string;
  role: DeskRole;
  /** False when they already had that role; nothing was written. */
  changed: boolean;
};

export async function setTeammateRole(actor: Actor, input: TeamRoleInput, state: TeammateState): Promise<Result<RoleOutcome>> {
  const { target, name } = state;
  if (input.id === actor.userId) return err("forbidden", "You cannot change your own role. Ask another owner.");
  if (target.role === "superadmin") return err("forbidden", "This owner cannot be changed from here.");

  const dbRole = dbRoleFor(input.role);
  if (target.role === dbRole) return ok({ id: target.id, name, role: input.role, changed: false });

  if (input.role === "team" && state.otherOwners === 0) {
    return err("conflict", "At least one owner must remain.");
  }

  try {
    await setUserRole(target.id, dbRole);
  } catch (e) {
    console.error("[team] role update failed", e);
    return err("internal", "The role could not be changed. Try again.");
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "user_role.update",
    subjectType: "user_role",
    subjectId: target.id,
    subjectCode: target.email,
    diff: { role: { before: target.role, after: dbRole } },
    metadata: { ...a.metadata, name },
  });

  return ok({ id: target.id, name, role: input.role, changed: true });
}

// ─── Remove ─────────────────────────────────────────────────────────────

export async function removeTeammate(
  actor: Actor,
  input: TeamRefInput,
  state: TeammateState,
): Promise<Result<{ id: string; name: string }>> {
  const { target, name } = state;
  if (input.id === actor.userId) return err("forbidden", "You cannot remove yourself. Ask another owner.");
  if (target.role === "superadmin") return err("forbidden", "This owner cannot be removed from here.");

  if (deskRole(target.role) === "owner" && state.otherOwners === 0) {
    return err("conflict", "At least one owner must remain.");
  }

  try {
    await setUserRole(target.id, "member");
    await db.update(staff).set({ status: "off", updatedAt: new Date() }).where(eq(staff.userId, target.id));
  } catch (e) {
    console.error("[team] remove failed", e);
    return err("internal", "Access could not be removed. Try again.");
  }

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "user_role.remove",
    subjectType: "user_role",
    subjectId: target.id,
    subjectCode: target.email,
    diff: { role: { before: target.role, after: "member" } },
    metadata: { ...a.metadata, name },
  });

  return ok({ id: target.id, name });
}

async function waitForUserRow(authUserId: string, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const [row] = await db
      .select({ id: users.id, role: users.role, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, authUserId));
    if (row) return row;
    // 100ms · 200ms · 400ms · 800ms · 1.6s — total max ~3s.
    await new Promise((r) => setTimeout(r, 100 * 2 ** i));
  }
  return null;
}
