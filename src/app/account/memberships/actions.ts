"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { memberships, type NewMembership } from "@/db/schema/memberships";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import {
  getMembershipSpec,
  isMembershipProgram,
  type MembershipProgram,
} from "@/lib/memberships";
import {
  createMembershipCheckoutSession,
  createMembershipTopUpCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripe";

export type BuyResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Start the self-serve purchase flow for a Card-tier membership.
 *
 * Flow:
 *   1. Validate program + user + no existing active membership.
 *   2. Insert a `memberships` row with status='paused' so the program
 *      record exists with all the deal terms baked in from
 *      MEMBERSHIP_SPECS. Webhook flips it to 'active' on payment.
 *   3. Create Stripe Checkout session sized to the deposit; stash the
 *      session id on the row.
 *   4. Return the redirect URL.
 *
 * Reserve tiers are not self-serve. The action rejects them with
 * RESERVE_BY_APPLICATION; the UI shouldn't even render the button.
 */
export async function buyMembership(programInput: string): Promise<BuyResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
  }
  if (!isMembershipProgram(programInput)) {
    return { ok: false, error: "INVALID_PROGRAM" };
  }
  const program = programInput satisfies MembershipProgram;
  const spec = getMembershipSpec(program);
  if (!spec.selfServe) {
    return { ok: false, error: "RESERVE_BY_APPLICATION" };
  }

  const user = await requireUser("/account/memberships");

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, user.id));
  if (!member) return { ok: false, error: "MEMBER_NOT_FOUND" };

  // Block double-purchase when an active membership already exists.
  const [existing] = await db
    .select({ id: memberships.id, program: memberships.program })
    .from(memberships)
    .where(and(eq(memberships.memberId, member.id), eq(memberships.status, "active")))
    .limit(1);
  if (existing) {
    return { ok: false, error: "ALREADY_ACTIVE" };
  }

  // Create the membership row first so we have an id to thread through
  // Stripe metadata. status='paused' until webhook flips it.
  const newMembership: NewMembership = {
    memberId: member.id,
    program: spec.program,
    depositUsd: spec.depositUsd,
    calloutHours: spec.calloutHours,
    rateLockMonths: spec.rateLockMonths,
    cateringAllowanceUsd: spec.cateringAllowanceUsd,
    groundAllowanceUsd: spec.groundAllowanceUsd,
    namedCardholdersLimit: spec.namedCardholdersLimit,
    emptyLegAdvanceMinutes: spec.emptyLegAdvanceMinutes,
    status: "paused",
  };

  const [inserted] = await db
    .insert(memberships)
    .values(newMembership)
    .returning({ id: memberships.id });

  let session: { sessionId: string; url: string };
  try {
    session = await createMembershipCheckoutSession({
      membershipId: inserted.id,
      program: spec.program,
      programLabel: spec.name,
      depositUsd: spec.depositUsd,
      memberId: member.id,
      customerEmail: user.email,
    });
  } catch (err) {
    console.error("stripe membership checkout failed", err);
    // Don't leave a dangling paused membership — the user can try
    // again, and if they do we'd create another paused row. Cleaner to
    // mark this one cancelled so /admin/member queries don't think
    // it's an in-progress purchase.
    await db
      .update(memberships)
      .set({ status: "cancelled", notes: "checkout-session-create-failed" })
      .where(eq(memberships.id, inserted.id));
    return { ok: false, error: "STRIPE_ERROR" };
  }

  await db
    .update(memberships)
    .set({ stripeCheckoutSessionId: session.sessionId, updatedAt: new Date() })
    .where(eq(memberships.id, inserted.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "membership.checkout.start",
    subjectType: "membership",
    subjectId: inserted.id,
    metadata: {
      program: spec.program,
      depositUsd: spec.depositUsd,
      stripeSessionId: session.sessionId,
    },
  });

  return { ok: true, url: session.url };
}

// ─── Top-up flow ────────────────────────────────────────────────────────
// Active card holders can add funds to their existing balance without
// activating a new tier. Stripe Checkout for the amount; webhook
// inserts a `top_up` reserve transaction. Same redirect contract as
// the initial purchase.
//
// Bounds: $5,000 min (so we're not running Stripe for trivial amounts),
// $1,000,000 max (Stripe one-time limit is ~$999k; we leave headroom).

const TOP_UP_MIN_USD = 5_000;
const TOP_UP_MAX_USD = 1_000_000;

export async function topUpMembership(amountUsdRaw: number): Promise<BuyResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
  }
  if (
    !Number.isFinite(amountUsdRaw) ||
    !Number.isInteger(amountUsdRaw) ||
    amountUsdRaw < TOP_UP_MIN_USD ||
    amountUsdRaw > TOP_UP_MAX_USD
  ) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }
  const amountUsd = amountUsdRaw;

  const user = await requireUser("/account/memberships");

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, user.id));
  if (!member) return { ok: false, error: "MEMBER_NOT_FOUND" };

  // Only active members can top up — no active card means there's no
  // balance bucket to add to.
  const [activeMembership] = await db
    .select({ id: memberships.id, program: memberships.program })
    .from(memberships)
    .where(and(eq(memberships.memberId, member.id), eq(memberships.status, "active")))
    .limit(1);
  if (!activeMembership) {
    return { ok: false, error: "NO_ACTIVE_MEMBERSHIP" };
  }

  let session: { sessionId: string; url: string };
  try {
    session = await createMembershipTopUpCheckoutSession({
      memberId: member.id,
      membershipId: activeMembership.id,
      amountUsd,
      customerEmail: user.email,
    });
  } catch (err) {
    console.error("stripe topup checkout failed", err);
    return { ok: false, error: "STRIPE_ERROR" };
  }

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "membership.topup.start",
    subjectType: "membership",
    subjectId: activeMembership.id,
    metadata: {
      program: activeMembership.program,
      amountUsd,
      stripeSessionId: session.sessionId,
    },
  });

  return { ok: true, url: session.url };
}
