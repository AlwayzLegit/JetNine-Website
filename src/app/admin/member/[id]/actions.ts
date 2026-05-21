"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import {
  memberships,
  reserveTransactions,
  type NewReserveTransaction,
  reserveTxKindEnum,
} from "@/db/schema/memberships";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Kind = (typeof reserveTxKindEnum.enumValues)[number];

const KIND_SIGN: Record<Kind, 1 | -1> = {
  top_up: 1,
  credit_accrual: 1,
  refund: 1,
  charter_draw: -1,
  adjustment: 1, // signed amount, treat literal
};

export type LedgerEntryResult =
  | { ok: true; balanceUsd: number }
  | { ok: false; error: string };

/**
 * Append a row to the reserve_transactions ledger. Sign convention:
 *   - top_up / credit_accrual / refund: positive (inflow)
 *   - charter_draw: negative (outflow) — UI passes magnitude, action flips
 *   - adjustment: literal (can be either sign) — UI passes signed value
 *
 * The Server Action is staff-only via requireStaff(); members never write
 * to the ledger directly. Every entry is also audited.
 */
export async function appendReserveTransaction(
  memberId: string,
  formData: FormData,
): Promise<LedgerEntryResult> {
  const actor = await requireStaff();

  const kindRaw = (formData.get("kind") as string | null) ?? "";
  if (!(reserveTxKindEnum.enumValues as readonly string[]).includes(kindRaw)) {
    return { ok: false, error: "Unknown kind" };
  }
  const kind = kindRaw as Kind;

  const magnitude = Math.round(Number(formData.get("amount") ?? 0));
  if (!magnitude || Number.isNaN(magnitude)) {
    return { ok: false, error: "Amount required" };
  }
  if (Math.abs(magnitude) < 1 || Math.abs(magnitude) > 5_000_000) {
    return { ok: false, error: "Amount out of bounds" };
  }

  // Sign the amount based on kind.
  const amountUsd =
    kind === "adjustment" ? magnitude : Math.abs(magnitude) * KIND_SIGN[kind];

  // Resolve the active membership if any so the ledger row links to it.
  const [activeMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.memberId, memberId));

  const description =
    (formData.get("description") as string | null)?.trim() ||
    `${kind.replace(/_/g, " ")} via dispatch`;

  const values: NewReserveTransaction = {
    memberId,
    membershipId: activeMembership?.id ?? null,
    kind,
    amountUsd,
    description,
  };

  // Verify member exists; surface a clean error otherwise.
  const [memberRow] = await db
    .select({ id: members.id, memberCode: members.memberCode })
    .from(members)
    .where(eq(members.id, memberId));
  if (!memberRow) return { ok: false, error: "Unknown member" };

  await db.insert(reserveTransactions).values(values);

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: `reserve_transaction.${kind}`,
    subjectType: "reserve_transaction",
    subjectId: memberId,
    subjectCode: memberRow.memberCode,
    metadata: { amountUsd, kind, description, membershipId: activeMembership?.id ?? null },
  });

  // Quick sum so the form can update the displayed balance without a full
  // page reload. Real balance still re-renders via revalidate below.
  const [balanceRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int`,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, memberId));
  const balance = balanceRow?.total ?? 0;

  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath("/account/members");
  return { ok: true, balanceUsd: balance };
}
