import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, type NewMember } from "@/db/schema/members";
import { memberships, reserveTransactions, type NewReserveTransaction } from "@/db/schema/memberships";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { findOrCreateUser, findUserIdByEmail, userHasPassword } from "@/lib/auth-users";
import { issueToken } from "@/lib/auth-tokens";
import { sendAuthLinkEmail } from "@/lib/auth-mail";
import { personName } from "@/lib/desk-status";
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
  /** The user row already on file for the email, when there is one. */
  existingAuthUserId: string | null;
};

/**
 * The email's auth user and the duplicate check, so a stale proposal fails
 * before anything is sent. The command resolves the user again when it runs.
 */
export async function loadForClientInvite(input: ClientInviteInput): Promise<Result<ClientInviteState>> {
  const existingAuthUserId = await findUserIdByEmail(input.email);
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
 * Flow (OPS-94, no Supabase call):
 * 1. Find the oldest public.users row for the email, or make one here.
 * 2. Update it with the firstName / lastName / phone the admin typed in.
 * 3. Insert public.members. The members_default_member_code trigger fills
 *    the M-YYYY-NNNN code.
 * 4. Audit-log under subject_type='member', action='member.invite'.
 * 5. Send the invite mail (a one-time link to set a password, 7 days) when
 *    the person is new or has no password yet.
 *
 * Notes:
 * - Idempotent against the user but NOT against the member row —
 *   if a member already exists for the resolved user_id, the command
 *   returns a clean error and does not invite.
 * - `isNewAuthUser` in the result now means "an invite mail went out".
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

  // 1) Resolve the user row: reuse the oldest for the email, otherwise make it.
  let userRow;
  try {
    userRow = await findOrCreateUser(email, { firstName, lastName });
  } catch (e) {
    const x = e as { name?: string; code?: string };
    console.error("[clients] account lookup failed", { name: x?.name, code: x?.code });
    return err("unavailable", "The account could not be set up. Try again in a moment.");
  }
  const authUserId = userRow.id;
  const isNewUser = userRow.created;

  // 3) Ensure a member doesn't already exist.
  const duplicate = await memberForUser(authUserId);
  if (duplicate) {
    return err("conflict", `Member ${duplicate.memberCode} already on file for that email`);
  }
  let hasPassword = false;
  if (!isNewUser) {
    try {
      hasPassword = await userHasPassword(authUserId);
    } catch {
      hasPassword = true; // unknown: do not mail
    }
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
      isNewUser,
      hasPhone: Boolean(phoneE164),
      hasCompany: Boolean(companyName),
    },
  });

  // 5) The invite mail, last: the member row is already saved, so a failed
  //    send leaves a client the desk can see, and says so.
  let inviteMailSent = false;
  if (!hasPassword) {
    try {
      const token = await issueToken(authUserId, "invite");
      const sent = await sendAuthLinkEmail({ to: email, purpose: "invite", token });
      inviteMailSent = sent.ok;
      if (!sent.ok) console.error("[clients] invite mail not sent", { reason: sent.error.split(":")[0].slice(0, 40) });
    } catch (e) {
      const x = e as { name?: string; code?: string };
      console.error("[clients] invite mail not sent", { name: x?.name, code: x?.code });
    }
    if (!inviteMailSent) {
      return err(
        "unavailable",
        `${memberRow.memberCode} was added, but the invite email did not go out. They can use "Email me a link" on the sign-in page.`,
      );
    }
  }

  return ok({ memberId: memberRow.id, memberCode: memberRow.memberCode, userId: authUserId, isNewAuthUser: inviteMailSent });
}
