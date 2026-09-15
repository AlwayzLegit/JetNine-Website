"use server";

import { headers } from "next/headers";
import { eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { blogSubscribers } from "@/db/schema/blog-subscribers";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { confirmExpiry, issueToken } from "@/lib/watchlist-confirm";
import { blogConfirmEmail, blogConfirmUrl } from "@/lib/blog-subscribe";

export type SubscribeResult = { ok: true; message: string } | { ok: false; error: string };

// One message for every outcome that isn't a validation error, so the
// form can't be used to probe which addresses are on the list — same
// enumeration posture as sign-in.
const NEUTRAL: SubscribeResult = {
  ok: true,
  message: "Check your inbox — if a confirmation is needed, the link is on its way.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Don't re-send a pending confirmation more often than this: the form
// would otherwise be a one-field mailbomb aimed at whoever's address is
// typed in.
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

export async function subscribeToBlog(formData: FormData): Promise<SubscribeResult> {
  // Honeypot — same field name the sign-in form uses. Bots fill it,
  // humans never see it.
  if (((formData.get("company") as string | null) ?? "").trim() !== "") {
    return NEUTRAL;
  }

  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // Outside a request scope (tests) — the global bucket still applies.
  }

  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`blogsub:${clientIp}`, { max: 3, windowSeconds: 600 });
    if (!rl.ok) return NEUTRAL;
  }
  const globalRl = await checkRateLimit("blogsub:global", { max: 30, windowSeconds: 3600 });
  if (!globalRl.ok) return NEUTRAL;

  try {
    const [existing] = await db
      .select({
        id: blogSubscribers.id,
        status: blogSubscribers.status,
        confirmSentAt: blogSubscribers.confirmSentAt,
      })
      .from(blogSubscribers)
      .where(eq(dsql`lower(${blogSubscribers.email})`, email))
      .limit(1);

    // Already confirmed → nothing to do, nothing to reveal.
    if (existing?.status === "confirmed") return NEUTRAL;

    // Pending with a recent confirmation email → don't send another yet.
    if (
      existing?.status === "pending" &&
      existing.confirmSentAt &&
      Date.now() - existing.confirmSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return NEUTRAL;
    }

    const { token, hash } = issueToken();
    const now = new Date();

    if (existing) {
      // Pending re-request or an unsubscribed reader opting back in —
      // either way it's a fresh consent cycle: back to pending, new token.
      await db
        .update(blogSubscribers)
        .set({
          status: "pending",
          confirmTokenHash: hash,
          confirmExpiresAt: confirmExpiry(now),
          confirmSentAt: now,
          unsubscribedAt: null,
          updatedAt: now,
        })
        .where(eq(blogSubscribers.id, existing.id));
    } else {
      await db.insert(blogSubscribers).values({
        email,
        status: "pending",
        confirmTokenHash: hash,
        confirmExpiresAt: confirmExpiry(now),
        confirmSentAt: now,
      });
    }

    const copy = blogConfirmEmail(blogConfirmUrl(token));
    const sent = await sendEmail({ to: email, ...copy });
    if (!sent.ok) console.error("[blog-subscribe] confirm email failed", sent.error);
  } catch (err) {
    // Neutral even on failure — a DB hiccup shouldn't leak list state,
    // and the reader can simply try again.
    console.error("[blog-subscribe] failed", err);
  }

  return NEUTRAL;
}
