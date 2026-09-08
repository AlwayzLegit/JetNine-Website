"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
import { logAudit } from "@/lib/audit";
import { hashToken, isExpired } from "@/lib/watchlist-confirm";

export type ConfirmResult =
  | { ok: true; channel: "sms" | "email" }
  | { ok: false; error: "INVALID" | "EXPIRED" | "FAILED" };

/**
 * Complete a confirmed opt-in.
 *
 * Deliberately a POST-only server action rather than something the page
 * does on load: corporate mail scanners follow links in email, and a
 * GET that confirms would let a scanner opt someone in without a human
 * ever seeing the message.
 *
 * The token identifies the channel as well as the row, so an SMS token
 * confirms only the number and an email token only the address. The hash
 * is cleared on use, which makes the link single-use.
 */
export async function confirmWatchlist(formData: FormData): Promise<ConfirmResult> {
  const token = (formData.get("token") as string | null)?.trim() ?? "";
  if (!token) return { ok: false, error: "INVALID" };

  const hash = hashToken(token);
  let row;
  try {
    [row] = await db
      .select({
        id: emptyLegWatchlists.id,
        smsHash: emptyLegWatchlists.confirmSmsTokenHash,
        emailHash: emptyLegWatchlists.confirmEmailTokenHash,
        expiresAt: emptyLegWatchlists.confirmExpiresAt,
      })
      .from(emptyLegWatchlists)
      .where(
        or(
          eq(emptyLegWatchlists.confirmSmsTokenHash, hash),
          eq(emptyLegWatchlists.confirmEmailTokenHash, hash),
        ),
      )
      .limit(1);
  } catch (err) {
    console.error("confirmWatchlist lookup failed", err);
    return { ok: false, error: "FAILED" };
  }

  if (!row) return { ok: false, error: "INVALID" };
  if (isExpired(row.expiresAt)) return { ok: false, error: "EXPIRED" };

  const channel: "sms" | "email" = row.smsHash === hash ? "sms" : "email";
  const now = new Date();

  try {
    await db
      .update(emptyLegWatchlists)
      .set(
        channel === "sms"
          ? { smsConfirmedAt: now, confirmSmsTokenHash: null }
          : { emailConfirmedAt: now, confirmEmailTokenHash: null },
      )
      .where(eq(emptyLegWatchlists.id, row.id));
  } catch (err) {
    console.error("confirmWatchlist write failed", err);
    return { ok: false, error: "FAILED" };
  }

  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: `empty_leg_watchlist.confirm.${channel}`,
      subjectType: "empty_leg_watchlist",
      subjectId: row.id,
      metadata: { channel },
    });
  } catch {
    // Never fail a consent action over an audit write.
  }

  revalidatePath("/account/preferences");
  return { ok: true, channel };
}
