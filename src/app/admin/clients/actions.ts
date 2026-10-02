"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, type NewMember } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { memberTierEnum } from "@/db/schema/enums";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const TIERS = memberTierEnum.enumValues as readonly string[];

export type InviteMemberResult =
  | {
      ok: true;
      memberId: string;
      memberCode: string;
      userId: string;
      isNewAuthUser: boolean;
    }
  | { ok: false; error: string };

/**
 * Admin-initiated member onboarding.
 *
 * Flow:
 * 1. Look up an existing auth.users row by email. If present, reuse it
 *    (covers the case where someone signed in once but doesn't have a
 *    member profile yet).
 * 2. If absent, call auth.admin.inviteUserByEmail — Supabase creates an
 *    auth.users row + sends a magic-link email. Our handle_new_auth_user
 *    trigger fires and inserts public.users automatically.
 * 3. Update public.users with the firstName / lastName / phone the admin
 *    typed in (the trigger only sets id + email).
 * 4. Insert public.members. The members_default_member_code trigger fills
 *    the M-YYYY-NNNN code.
 * 5. Audit-log under subject_type='member', action='member.invite'.
 *
 * Notes:
 * - Idempotent against the auth user but NOT against the member row —
 *   if a member already exists for the resolved user_id, the action
 *   returns a clean error and does not invite.
 * - Pre-trigger orphans (auth user exists, no member) are silently fixed.
 */
export async function inviteMember(
  formData: FormData,
): Promise<InviteMemberResult> {
  const actor = await requireStaff();

  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Email looks invalid" };

  const firstName =
    ((formData.get("firstName") as string | null) ?? "").trim() || null;
  const lastName =
    ((formData.get("lastName") as string | null) ?? "").trim() || null;
  const phoneE164 =
    ((formData.get("phoneE164") as string | null) ?? "").trim() || null;
  if (phoneE164 && !E164_RE.test(phoneE164)) {
    return { ok: false, error: "Phone must be E.164 (+15551234567)" };
  }

  const tierRaw = ((formData.get("tier") as string | null) ?? "on_demand").trim();
  if (!TIERS.includes(tierRaw)) {
    return { ok: false, error: "Invalid tier" };
  }
  const tier = tierRaw as NewMember["tier"];

  const companyName =
    ((formData.get("companyName") as string | null) ?? "").trim() || null;
  const legalName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const supa = createAdminClient();

  // 1) Resolve the auth user — reuse if exists, otherwise invite.
  let authUserId: string;
  let isNewAuthUser = false;

  const { data: existing } = await supa.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const hit = existing?.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (hit) {
    authUserId = hit.id;
  } else {
    const { data: invited, error: inviteErr } =
      await supa.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName, last_name: lastName },
      });
    if (inviteErr || !invited?.user) {
      console.error("inviteUserByEmail failed", inviteErr);
      return { ok: false, error: inviteErr?.message ?? "Invite failed" };
    }
    authUserId = invited.user.id;
    isNewAuthUser = true;
  }

  // 2) Trigger should have fired — but the call to GoTrue is across an HTTP
  //    boundary; brief retry if the public.users row isn't visible yet.
  const userRow = await waitForUserRow(authUserId);
  if (!userRow) {
    return {
      ok: false,
      error: "Auth user created but public.users row didn't materialize. Try again.",
    };
  }

  // 3) Ensure a member doesn't already exist.
  const [duplicate] = await db
    .select({ id: members.id, memberCode: members.memberCode })
    .from(members)
    .where(eq(members.userId, authUserId));
  if (duplicate) {
    return {
      ok: false,
      error: `Member ${duplicate.memberCode} already on file for that email`,
    };
  }

  // 4) Patch public.users with the typed-in profile fields.
  await db
    .update(users)
    .set({
      firstName: firstName ?? userRow.firstName,
      lastName: lastName ?? userRow.lastName,
      phoneE164: phoneE164 ?? userRow.phoneE164,
    })
    .where(eq(users.id, authUserId));

  // 5) Insert public.members. memberCode auto-fills via trigger.
  const today = new Date().toISOString().slice(0, 10);
  const values: NewMember = {
    userId: authUserId,
    memberCode: "", // trigger fills
    legalName,
    preferredName: firstName,
    mobileE164: phoneE164,
    companyName,
    tier,
    tierSince: tier === "on_demand" ? null : today,
    memberSince: today,
    status: "active",
  };

  const [memberRow] = await db
    .insert(members)
    .values(values)
    .returning({ id: members.id, memberCode: members.memberCode });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "member.invite",
    subjectType: "member",
    subjectId: memberRow.id,
    subjectCode: memberRow.memberCode,
    metadata: {
      email,
      tier,
      isNewAuthUser,
      hasPhone: Boolean(phoneE164),
      hasCompany: Boolean(companyName),
    },
  });

  revalidatePath("/admin/member");
  revalidatePath(`/admin/member/${memberRow.id}`);

  return {
    ok: true,
    memberId: memberRow.id,
    memberCode: memberRow.memberCode,
    userId: authUserId,
    isNewAuthUser,
  };
}

async function waitForUserRow(authUserId: string, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const [row] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        phoneE164: users.phoneE164,
      })
      .from(users)
      .where(eq(users.id, authUserId));
    if (row) return row;
    // 100ms · 200ms · 400ms · 800ms · 1.6s — total max ~3s.
    await new Promise((r) => setTimeout(r, 100 * 2 ** i));
  }
  return null;
}
