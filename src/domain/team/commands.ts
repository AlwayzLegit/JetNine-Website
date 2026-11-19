import { settingsStore } from "@/domain/settings/store";
import { logAudit } from "@/lib/audit";
import { findOrCreateUser, setUserRole, userHasPassword } from "@/lib/auth-users";
import { issueToken } from "@/lib/auth-tokens";
import { identityStore } from "@/lib/identity-store/store";
import { sendAuthLinkEmail } from "@/lib/auth-mail";
import { deskRole, personName, type DeskRole } from "@/lib/desk-status";
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

const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

export type DbDeskRole = "admin" | "dispatcher";

export function dbRoleFor(role: DeskRole): DbDeskRole {
  return role === "owner" ? "admin" : "dispatcher";
}

async function ownersOtherThan(userId: string): Promise<number> {
  return settingsStore().ownersOtherThan(userId);
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
  const row = await settingsStore().teammate(input.id);
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

  // 1) The person's row: the oldest public.users row for the email, or a new
  //    one made here (OPS-94: no Supabase call, no trigger to wait for).
  let userRow;
  try {
    userRow = await findOrCreateUser(email, { firstName, lastName });
  } catch (e) {
    const x = e as { name?: string; code?: string };
    console.error("[team] account lookup failed", { name: x?.name, code: x?.code });
    return err("unavailable", "The account could not be set up. Try again in a moment.");
  }
  const authUserId = userRow.id;
  const isNewUser = userRow.created;

  // 2) Someone already on the desk with a password is a conflict. Someone on
  //    the desk with no password yet gets the invite mail again (their role is
  //    left as it is), so a send that failed can be retried by inviting again.
  const alreadyStaff = (STAFF_ROLES as readonly string[]).includes(userRow.role);
  let hasPassword = false;
  if (!isNewUser) {
    try {
      hasPassword = await userHasPassword(authUserId);
    } catch {
      hasPassword = true; // unknown: do not mail
    }
  }
  if (alreadyStaff && hasPassword) {
    return err("conflict", `${personName(userRow.firstName, userRow.lastName, email)} is already on the desk.`);
  }
  const needsMail = !hasPassword;

  // 3) Role + names, and 4) the staff row (display name) when none exists; a
  //    removed teammate's row is switched back on. Skipped for someone already
  //    on the desk: a re-invite never changes a role.
  const dbRole = alreadyStaff ? userRow.role : dbRoleFor(role);
  const displayName =
    personName(firstName ?? userRow.firstName, lastName ?? userRow.lastName, "") || email.split("@")[0];
  if (!alreadyStaff) {
    try {
      await setUserRole(actor.role, authUserId, dbRoleFor(role), {
        firstName: firstName ?? userRow.firstName,
        lastName: lastName ?? userRow.lastName,
      });
    } catch (e) {
      console.error("[team] role update failed", e);
      return err("internal", "The desk role could not be set. Try again.");
    }
    const identity = identityStore();
    const staffRow = await identity.staffIdOfUser(authUserId);
    if (!staffRow) {
      await identity.insertStaff({ userId: authUserId, displayName, status: "on_call" });
    } else {
      await identity.setStaffStatusById(staffRow.id, "on_call");
    }
  }

  // 5) The invite mail: a one-time link to set a password (7 days).
  let inviteMailSent = false;
  let mailError: string | null = null;
  if (needsMail) {
    try {
      const token = await issueToken(authUserId, "invite");
      const sent = await sendAuthLinkEmail({ to: email, purpose: "invite", token });
      inviteMailSent = sent.ok;
      if (!sent.ok) mailError = sent.error.split(":")[0].slice(0, 40);
    } catch (e) {
      const x = e as { name?: string; code?: string };
      mailError = `${x?.name ?? "error"} ${x?.code ?? ""}`.trim();
    }
    if (!inviteMailSent) console.error("[team] invite mail not sent", { reason: mailError });
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
    metadata: { ...a.metadata, name: displayName, role, isNewUser, inviteMailSent },
  });

  if (needsMail && !inviteMailSent) {
    return err(
      "unavailable",
      "They are on the desk, but the invite email did not go out. Invite them again to send it.",
    );
  }

  return ok({ id: authUserId, email, name: displayName, role, invited: inviteMailSent });
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
    await setUserRole(actor.role, target.id, dbRole);
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
    await setUserRole(actor.role, target.id, "member");
    await identityStore().setStaffStatusByUser(target.id, "off");
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
