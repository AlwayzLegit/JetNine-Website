"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { deskRole, DESK_ROLE_WORDS, personName, type DeskRole } from "@/lib/desk-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail, setUserRole } from "@/lib/auth-users";

// Settings › Team. Owner-only (admin / superadmin). Two words map onto the
// database roles: Owner = admin, Team = dispatcher. `superadmin` rows show
// as Owner and are never changed from here.

export type TeamActionResult = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/admin/settings/team";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const OWNER_ROLES = ["admin", "superadmin"] as const;
const STAFF_ROLES = ["dispatcher", "admin", "superadmin"] as const;

function dbRoleFor(role: DeskRole): "admin" | "dispatcher" {
  return role === "owner" ? "admin" : "dispatcher";
}

function parseDeskRole(v: unknown): DeskRole | null {
  return v === "owner" || v === "team" ? v : null;
}

async function ownersOtherThan(userId: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, [...OWNER_ROLES]), ne(users.id, userId)));
  return rows.length;
}

async function loadTarget(userId: string) {
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
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// ─── Invite ─────────────────────────────────────────────────────────────

export async function inviteTeammate(formData: FormData): Promise<TeamActionResult> {
  const actor = await requireAdmin();

  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "That email does not look right." };
  const firstName = ((formData.get("firstName") as string | null) ?? "").trim() || null;
  const lastName = ((formData.get("lastName") as string | null) ?? "").trim() || null;
  const role = parseDeskRole((formData.get("role") as string | null) ?? "team");
  if (!role) return { ok: false, error: "Pick Owner or Team." };

  const supa = createAdminClient();

  // 1) Resolve the auth user — reuse if it exists, otherwise invite. Same
  //    pattern as inviteMember (src/app/admin/clients/actions.ts).
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
      return { ok: false, error: inviteErr?.message ?? "The invite did not go out. Try again." };
    }
    authUserId = invited.user.id;
    isNewAuthUser = true;
  }

  // 2) The handle_new_auth_user trigger inserts public.users; brief retry
  //    because the GoTrue call crosses an HTTP boundary.
  const userRow = await waitForUserRow(authUserId);
  if (!userRow) {
    return { ok: false, error: "The account was created but did not show up yet. Try again in a moment." };
  }
  if ((STAFF_ROLES as readonly string[]).includes(userRow.role)) {
    return { ok: false, error: `${personName(userRow.firstName, userRow.lastName, email)} is already on the desk.` };
  }

  // 3) Role + names.
  const dbRole = dbRoleFor(role);
  try {
    await setUserRole(authUserId, dbRole, {
      firstName: firstName ?? userRow.firstName,
      lastName: lastName ?? userRow.lastName,
    });
  } catch (err) {
    console.error("[team] role update failed", err);
    return {
      ok: false,
      error: isNewAuthUser
        ? "The invite email went out, but the desk role could not be set. Open Team again and use Change on their row."
        : "The desk role could not be set. Try again.",
    };
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

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "user_role.invite",
    subjectType: "user_role",
    subjectId: authUserId,
    subjectCode: email,
    diff: { role: { before: userRow.role, after: dbRole } },
    metadata: { name: displayName, role, isNewAuthUser },
  });

  revalidatePath(PATH);
  return {
    ok: true,
    message: isNewAuthUser
      ? `Invite sent to ${email}. They join as ${DESK_ROLE_WORDS[role].label} once they sign in.`
      : `${displayName} is now on the desk as ${DESK_ROLE_WORDS[role].label}.`,
  };
}

// ─── Change role ────────────────────────────────────────────────────────

export async function setTeammateRole(userId: string, role: DeskRole): Promise<TeamActionResult> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(userId)) return { ok: false, error: "Bad request." };
  const next = parseDeskRole(role);
  if (!next) return { ok: false, error: "Pick Owner or Team." };
  if (userId === actor.id) return { ok: false, error: "You cannot change your own role. Ask another owner." };

  const target = await loadTarget(userId);
  if (!target || !deskRole(target.role)) return { ok: false, error: "That person is not on the desk." };
  if (target.role === "superadmin") return { ok: false, error: "This owner cannot be changed from here." };

  const name = target.displayName ?? personName(target.firstName, target.lastName, target.email);
  const dbRole = dbRoleFor(next);
  if (target.role === dbRole) return { ok: true, message: `${name} is already ${DESK_ROLE_WORDS[next].label}.` };

  if (next === "team" && (await ownersOtherThan(userId)) === 0) {
    return { ok: false, error: "At least one owner must remain." };
  }

  try {
    await setUserRole(userId, dbRole);
  } catch (err) {
    console.error("[team] role update failed", err);
    return { ok: false, error: "The role could not be changed. Try again." };
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "user_role.update",
    subjectType: "user_role",
    subjectId: userId,
    subjectCode: target.email,
    diff: { role: { before: target.role, after: dbRole } },
    metadata: { name },
  });

  revalidatePath(PATH);
  return { ok: true, message: `${name} is now ${DESK_ROLE_WORDS[next].label}.` };
}

// ─── Remove ─────────────────────────────────────────────────────────────

export async function removeTeammate(userId: string): Promise<TeamActionResult> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(userId)) return { ok: false, error: "Bad request." };
  if (userId === actor.id) return { ok: false, error: "You cannot remove yourself. Ask another owner." };

  const target = await loadTarget(userId);
  if (!target || !deskRole(target.role)) return { ok: false, error: "That person is not on the desk." };
  if (target.role === "superadmin") return { ok: false, error: "This owner cannot be removed from here." };

  if (deskRole(target.role) === "owner" && (await ownersOtherThan(userId)) === 0) {
    return { ok: false, error: "At least one owner must remain." };
  }

  const name = target.displayName ?? personName(target.firstName, target.lastName, target.email);

  try {
    await setUserRole(userId, "member");
    await db.update(staff).set({ status: "off", updatedAt: new Date() }).where(eq(staff.userId, userId));
  } catch (err) {
    console.error("[team] remove failed", err);
    return { ok: false, error: "Access could not be removed. Try again." };
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "user_role.remove",
    subjectType: "user_role",
    subjectId: userId,
    subjectCode: target.email,
    diff: { role: { before: target.role, after: "member" } },
    metadata: { name },
  });

  revalidatePath(PATH);
  return { ok: true, message: `${name} no longer has access to the desk.` };
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
