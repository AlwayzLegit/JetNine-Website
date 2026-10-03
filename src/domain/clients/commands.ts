import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, type NewMember } from "@/db/schema/members";
import { memberships, reserveTransactions, type NewReserveTransaction } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { findAuthUserIdByEmail } from "@/lib/auth-users";
import { personName } from "@/lib/desk-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import type { ClientInviteInput, ClientLedgerAddInput, ReserveTxKind } from "./schemas";

/**
 * Client (member) commands behind the ops in ./ops.ts, shared by the
 * admin's Server Actions, the API and the approval queue. Each op has a
 * `load*` (the current rows, re-read at approval time) and a command that
 * runs against that state. Nothing here checks the session or
 * revalidates: the op declares its paths and `runOp` handles both.
 *
 * Keep this file free of `server-only` imports: scripts/check-api.mts
 * loads the route registry under tsx.
 */

export const MEMBER_NOT_FOUND = "Unknown member";

// ─── Reserve ledger ──────────────────────────────────────────────────────

const KIND_SIGN: Record<ReserveTxKind, 1 | -1> = {
  top_up: 1,
  credit_accrual: 1,
  refund: 1,
  charter_draw: -1,
  adjustment: 1, // signed amount, treat literal
};

/**
 * Sign convention of the ledger:
 *   - top_up / credit_accrual / refund: positive (inflow)
 *   - charter_draw: negative (outflow) — the caller passes a magnitude
 *   - adjustment: literal (can be either sign) — the caller passes a signed value
 */
export function signedLedgerAmount(kind: ReserveTxKind, amount: number): number {
  return kind === "adjustment" ? amount : Math.abs(amount) * KIND_SIGN[kind];
}

export type ClientLedgerAddState = {
  member: { id: string; memberCode: string };
  /** The client's name, for the approval card. */
  clientName: string;
  /** The ACTIVE membership the row attributes to, when they have one. */
  activeMembershipId: string | null;
};

export async function loadClientForLedgerAdd(input: ClientLedgerAddInput): Promise<Result<ClientLedgerAddState>> {
  if (!isUuid(input.id)) return err("not_found", MEMBER_NOT_FOUND);

  // Resolve the ACTIVE membership so the ledger row attributes to the
  // right bucket. Without the status filter + activatedOn ordering, a
  // member with a historical cancelled/paused row alongside their
  // current active row could see manual ledger entries attached to the
  // dead bucket — balance sums (which use memberId) stay correct, but
  // per-membership reports and the membership ledger view break.
  const [activeMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.memberId, input.id), eq(memberships.status, "active")))
    .orderBy(desc(memberships.activatedOn))
    .limit(1);

  // Verify member exists; surface a clean error otherwise.
  const [memberRow] = await db
    .select({ id: members.id, memberCode: members.memberCode, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, input.id));
  if (!memberRow) return err("not_found", MEMBER_NOT_FOUND);

  return ok({
    member: { id: memberRow.id, memberCode: memberRow.memberCode },
    clientName: personName(memberRow.firstName, memberRow.lastName, memberRow.email),
    activeMembershipId: activeMembership?.id ?? null,
  });
}

/**
 * Append a row to the reserve_transactions ledger and audit it. Members
 * never write to the ledger directly. Returns the new balance so the form
 * can update what it shows without a reload.
 */
export async function appendLedgerEntry(
  actor: Actor,
  input: ClientLedgerAddInput,
  state: ClientLedgerAddState,
): Promise<Result<{ id: string; amountUsd: number; balanceUsd: number }>> {
  const memberId = state.member.id;
  const { kind } = input;
  const amountUsd = signedLedgerAmount(kind, input.amount);
  const description = input.description?.trim() || `${kind.replace(/_/g, " ")} via dispatch`;
  const a = auditFields(actor);

  const values: NewReserveTransaction = {
    memberId,
    membershipId: state.activeMembershipId,
    kind,
    amountUsd,
    description,
  };

  // Capture the inserted tx id so the audit row's subjectId points at
  // the ledger entry, not at the member, so "find who entered tx X"
  // works through the (subjectType, subjectId) index.
  const [inserted] = await db.insert(reserveTransactions).values(values).returning({ id: reserveTransactions.id });

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: `reserve_transaction.${kind}`,
    subjectType: "reserve_transaction",
    subjectId: inserted.id,
    subjectCode: state.member.memberCode,
    metadata: {
      ...a.metadata,
      amountUsd,
      kind,
      description,
      memberId,
      membershipId: state.activeMembershipId,
    },
  });

  // Quick sum so the form can update the displayed balance without a full
  // page reload. The page re-renders through revalidation anyway.
  const [balanceRow] = await db
    .select({ total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int` })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, memberId));

  return ok({ id: inserted.id, amountUsd, balanceUsd: balanceRow?.total ?? 0 });
}

// ─── Invite ──────────────────────────────────────────────────────────────

export type ClientInviteState = {
  /** The auth user already on file for the email, when there is one. */
  existingAuthUserId: string | null;
};

/**
 * The email's auth user and the duplicate check, so a stale proposal fails
 * before anything is sent. The command resolves the user again when it runs.
 */
export async function loadForClientInvite(input: ClientInviteInput): Promise<Result<ClientInviteState>> {
  const existingAuthUserId = await findAuthUserIdByEmail(input.email);
  if (existingAuthUserId) {
    const duplicate = await memberForUser(existingAuthUserId);
    if (duplicate) return err("conflict", `Member ${duplicate.memberCode} already on file for that email`);
  }
  return ok({ existingAuthUserId });
}

async function memberForUser(userId: string): Promise<{ id: string; memberCode: string } | null> {
  const [row] = await db.select({ id: members.id, memberCode: members.memberCode }).from(members).where(eq(members.userId, userId));
  return row ?? null;
}

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
 *   if a member already exists for the resolved user_id, the command
 *   returns a clean error and does not invite.
 * - Pre-trigger orphans (auth user exists, no member) are silently fixed.
 */
export async function inviteClient(
  actor: Actor,
  input: ClientInviteInput,
): Promise<Result<{ memberId: string; memberCode: string; userId: string; isNewAuthUser: boolean }>> {
  const { email, tier } = input;
  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const phoneE164 = input.phoneE164?.trim() || null;
  const companyName = input.companyName?.trim() || null;
  const legalName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const a = auditFields(actor);

  const supa = createAdminClient();

  // 1) Resolve the auth user — reuse if exists, otherwise invite.
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
      return err("unavailable", inviteErr?.message ?? "Invite failed");
    }
    authUserId = invited.user.id;
    isNewAuthUser = true;
  }

  // 2) Trigger should have fired — but the call to GoTrue is across an HTTP
  //    boundary; brief retry if the public.users row isn't visible yet.
  const userRow = await waitForUserRow(authUserId);
  if (!userRow) {
    return err("unavailable", "Auth user created but public.users row didn't materialize. Try again.");
  }

  // 3) Ensure a member doesn't already exist.
  const duplicate = await memberForUser(authUserId);
  if (duplicate) {
    return err("conflict", `Member ${duplicate.memberCode} already on file for that email`);
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

  const [memberRow] = await db.insert(members).values(values).returning({ id: members.id, memberCode: members.memberCode });

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "member.invite",
    subjectType: "member",
    subjectId: memberRow.id,
    subjectCode: memberRow.memberCode,
    metadata: {
      ...a.metadata,
      email,
      tier,
      isNewAuthUser,
      hasPhone: Boolean(phoneE164),
      hasCompany: Boolean(companyName),
    },
  });

  return ok({ memberId: memberRow.id, memberCode: memberRow.memberCode, userId: authUserId, isNewAuthUser });
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
