import { and, eq, ne } from "drizzle-orm";
import type { db } from "@/db";
import { members, type NewMember } from "@/db/schema/members";
import { memberships } from "@/db/schema/memberships";

// The member tier follows the membership (OPS-102). Until now the Postgres
// trigger memberships_sync_member_tier did this (jn_internal.sync_member_tier_from_membership,
// migration 0025). D1 cannot run triggers, so the app does the same after each
// membership write. The function recomputes from the current rows, so running
// beside the trigger arrives at the same values and is safe to repeat.

type Tier = NonNullable<NewMember["tier"]>;
type Program = typeof memberships.$inferSelect.program;

// The eight programs and tiers share their names.
export const PROGRAM_TO_TIER: Record<Program, Tier> = {
  on_demand: "on_demand",
  card_100: "card_100",
  card_250: "card_250",
  card_500: "card_500",
  reserve_50: "reserve_50",
  reserve_100: "reserve_100",
  reserve_250: "reserve_250",
  reserve_500_apply: "reserve_500_apply",
};

export type TierPatch = { tier: Tier; tierSince?: string | null };

/**
 * What the member row should change to after a membership write, or null for
 * nothing. Same rules as the trigger:
 * - an active membership sets the tier from its program and tier_since from activated_on;
 * - a membership that stops being active, when the member has no other active
 *   one, resets the tier to on_demand (tier_since is left alone).
 */
export function tierPatch(input: {
  status: string;
  previousStatus: string | null;
  program: Program;
  activatedOn: string | null;
  hasOtherActive: boolean;
}): TierPatch | null {
  if (input.status === "active") {
    return { tier: PROGRAM_TO_TIER[input.program], tierSince: input.activatedOn };
  }
  if (input.previousStatus === "active" && !input.hasOtherActive) {
    return { tier: "on_demand" };
  }
  return null;
}

export type TierExecutor = Pick<typeof db, "select" | "update">;

/**
 * Call after every membership insert or update, in the same transaction where
 * one exists. `previousStatus` is the status before the write (null for an insert).
 */
export async function syncMemberTier(
  executor: TierExecutor,
  membershipId: string,
  previousStatus: string | null,
): Promise<void> {
  const [m] = await executor
    .select({
      id: memberships.id,
      memberId: memberships.memberId,
      program: memberships.program,
      status: memberships.status,
      activatedOn: memberships.activatedOn,
    })
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);
  if (!m) return;

  let hasOtherActive = false;
  if (m.status !== "active" && previousStatus === "active") {
    const others = await executor
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.memberId, m.memberId), eq(memberships.status, "active"), ne(memberships.id, m.id)))
      .limit(1);
    hasOtherActive = others.length > 0;
  }

  const patch = tierPatch({
    status: m.status,
    previousStatus,
    program: m.program,
    activatedOn: m.activatedOn,
    hasOtherActive,
  });
  if (!patch) return;
  await executor.update(members).set(patch).where(eq(members.id, m.memberId));
}
