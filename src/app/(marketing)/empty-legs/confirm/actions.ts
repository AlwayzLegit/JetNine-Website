"use server";

import { revalidatePath } from "next/cache";
import { watchlistStore } from "@/domain/empty-legs/watchlist-store";
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
  // Chosen once, outside the try blocks, so a d1 target without its binding fails loudly.
  const store = watchlistStore();
  let row;
  try {
    row = await store.byConfirmHash(hash);
  } catch (err) {
    console.error("confirmWatchlist lookup failed", err);
    return { ok: false, error: "FAILED" };
  }

  if (!row) return { ok: false, error: "INVALID" };
  if (isExpired(row.expiresAt)) return { ok: false, error: "EXPIRED" };

  const channel: "sms" | "email" = row.smsHash === hash ? "sms" : "email";
  const now = new Date();

  try {
    await store.confirmChannel(row.id, channel, now);
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
