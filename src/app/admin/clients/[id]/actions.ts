"use server";

import { reserveTxKindEnum } from "@/db/schema/memberships";
import { sessionActor } from "@/domain/actor";
import { clientLedgerAddOp } from "@/domain/clients/ops";
import { MAX_LEDGER_USD, type ReserveTxKind } from "@/domain/clients/schemas";
import { runOp } from "@/domain/ops/registry";

export type LedgerEntryResult =
  | { ok: true; balanceUsd: number }
  | { ok: false; error: string };

/**
 * Append a row to the reserve_transactions ledger. Sign convention:
 *   - top_up / credit_accrual / refund: positive (inflow)
 *   - charter_draw: negative (outflow) — UI passes magnitude, the op flips
 *   - adjustment: literal (can be either sign) — UI passes signed value
 *
 * The work itself is the "client.ledger.add" op (src/domain/clients):
 * the active-membership attribution, the audit row and the new balance
 * live there; runOp revalidates the pages. Members never write to the
 * ledger directly.
 */
export async function appendReserveTransaction(
  memberId: string,
  formData: FormData,
): Promise<LedgerEntryResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const kindRaw = (formData.get("kind") as string | null) ?? "";
  if (!(reserveTxKindEnum.enumValues as readonly string[]).includes(kindRaw)) {
    return { ok: false, error: "Unknown kind" };
  }
  const kind = kindRaw as ReserveTxKind;

  const magnitude = Math.round(Number(formData.get("amount") ?? 0));
  if (!magnitude || Number.isNaN(magnitude)) {
    return { ok: false, error: "Amount required" };
  }
  if (Math.abs(magnitude) < 1 || Math.abs(magnitude) > MAX_LEDGER_USD) {
    return { ok: false, error: "Amount out of bounds" };
  }

  const description = (formData.get("description") as string | null)?.trim() || undefined;

  const r = await runOp(clientLedgerAddOp, session.value, { id: memberId, kind, amount: magnitude, description });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, balanceUsd: (r.value.value as { balanceUsd: number }).balanceUsd };
}
