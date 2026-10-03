"use server";

import { memberTierEnum } from "@/db/schema/enums";
import { sessionActor } from "@/domain/actor";
import { clientInviteOp } from "@/domain/clients/ops";
import { E164_RE, EMAIL_RE, type MemberTier } from "@/domain/clients/schemas";
import { runOp } from "@/domain/ops/registry";

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
 * Admin-initiated member onboarding. The work itself is the "client.invite"
 * op (src/domain/clients): resolving or inviting the auth user, the
 * duplicate check, the profile patch, the member row and the audit all
 * live there; runOp revalidates the list. This wrapper turns the form into
 * the op's input with the desk's wording for a bad field.
 */
export async function inviteMember(
  formData: FormData,
): Promise<InviteMemberResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

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
  const tier = tierRaw as MemberTier;

  const companyName =
    ((formData.get("companyName") as string | null) ?? "").trim() || null;

  const r = await runOp(clientInviteOp, session.value, { email, firstName, lastName, phoneE164, tier, companyName });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  const { memberId, memberCode, userId, isNewAuthUser } = r.value.value as {
    memberId: string;
    memberCode: string;
    userId: string;
    isNewAuthUser: boolean;
  };
  return { ok: true, memberId, memberCode, userId, isNewAuthUser };
}
