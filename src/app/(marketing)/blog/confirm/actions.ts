"use server";

import { blogStore } from "@/domain/blog/store";
import { logAudit } from "@/lib/audit";
import { hashToken, isExpired } from "@/lib/watchlist-confirm";

export type BlogConfirmResult =
  | { ok: true }
  | { ok: false; error: "INVALID" | "EXPIRED" | "FAILED" };

/**
 * Complete the double opt-in. POST-only server action for the same reason
 * as the watchlist flow: mail scanners follow links, and a GET that
 * confirms would let a scanner subscribe someone who never saw the email.
 * The hash is cleared on use, making the link single-use.
 */
export async function confirmBlogSubscription(formData: FormData): Promise<BlogConfirmResult> {
  const token = ((formData.get("token") as string | null) ?? "").trim();
  if (!token) return { ok: false, error: "INVALID" };

  const hash = hashToken(token);
  let row;
  try {
    row = await blogStore().subscriberByConfirmHash(hash);
  } catch (err) {
    console.error("[blog-confirm] lookup failed", err);
    return { ok: false, error: "FAILED" };
  }

  if (!row) return { ok: false, error: "INVALID" };
  if (isExpired(row.expiresAt)) return { ok: false, error: "EXPIRED" };

  const now = new Date();
  try {
    await blogStore().confirmSubscriber(row.id, now);
  } catch (err) {
    console.error("[blog-confirm] write failed", err);
    return { ok: false, error: "FAILED" };
  }

  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: "blog_subscriber.confirm",
      subjectType: "blog_subscriber",
      subjectId: row.id,
    });
  } catch {
    // Never fail a consent action over an audit write.
  }

  return { ok: true };
}
