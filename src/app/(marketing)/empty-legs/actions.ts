"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emptyLegWatchlists, type NewEmptyLegWatchlist } from "@/db/schema/empty-legs";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateWatchlistInput } from "@/lib/watchlist-validation";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";
import {
  confirmEmailBody,
  confirmEmailSubject,
  confirmExpiry,
  confirmSms,
  confirmUrl,
  issueToken,
} from "@/lib/watchlist-confirm";

export type WatchlistResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Per-IP ceiling. A person creates one or two watchlists; the August 2026
// bot created ~15 a day from rotating addresses, so the limit is a
// backstop — the validation in src/lib/watchlist-validation.ts is the
// primary defence.
const WATCHLIST_RATE_LIMIT_MAX = 3;
const WATCHLIST_RATE_LIMIT_WINDOW_SECONDS = 600;

export async function createWatchlist(formData: FormData): Promise<WatchlistResult> {
  const field = (k: string) => (formData.get(k) as string | null)?.trim() ?? "";

  // Honeypot: the visible form never exposes this field, so any value here
  // is an autofill bot. Pretend success so the bot moves on; insert nothing.
  if (field("company")) {
    console.warn("createWatchlist honeypot tripped — dropping submission");
    return { ok: true, message: "WATCHLIST CREATED" };
  }

  const parsed = validateWatchlistInput({
    from: field("from"),
    to: field("to"),
    earliest: field("earliest"),
    latest: field("latest"),
    mobile: field("mobile"),
    email: field("email"),
  });
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.join(", ").toUpperCase() };
  }
  const v = parsed.value;
  const from = v.fromText;
  const to = v.toText;
  const earliest = v.earliestOn;
  const latest = v.latestOn;

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // headers() can throw outside a request scope; proceed without limiting.
  }
  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`watchlist_submit:${clientIp}`, {
      max: WATCHLIST_RATE_LIMIT_MAX,
      windowSeconds: WATCHLIST_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  }

  // If the visitor is signed in and has a member profile, link the watchlist
  // so they can manage it from /account/preferences later.
  let memberId: string | null = null;
  let actorUserId: string | null = null;
  let actorRole: string | null = null;
  const user = await getCurrentUser();
  if (user) {
    actorUserId = user.id;
    actorRole = user.role;
    const m = await getMemberByUserId(user.id);
    memberId = m?.id ?? null;
  }

  // Confirmed opt-in. Nothing is sent to either address until whoever
  // holds it uses its own link, so filling this form in with a
  // stranger's details subscribes nobody. Tokens are kept as hashes.
  const now = new Date();
  const smsToken = issueToken();
  const emailToken = v.email ? issueToken() : null;

  const values: NewEmptyLegWatchlist = {
    memberId,
    email: v.email,
    phoneE164: v.mobile,
    fromIcao: v.fromIcao,
    fromText: from,
    toIcao: v.toIcao,
    toText: to,
    earliestOn: earliest,
    latestOn: latest,
    minDiscountPct: 30,
    notifyChannels: {
      email: !!v.email,
      sms: true,
    },
    active: true,
    confirmSmsTokenHash: smsToken.hash,
    confirmEmailTokenHash: emailToken?.hash ?? null,
    confirmSentAt: now,
    confirmExpiresAt: confirmExpiry(now),
  };

  let insertedId: string;
  try {
    const [row] = await db
      .insert(emptyLegWatchlists)
      .values(values)
      .returning({ id: emptyLegWatchlists.id });
    insertedId = row.id;
  } catch (err) {
    console.error("createWatchlist failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  // Audit — only when authenticated; anonymous board signups stay
  // out of the audit_log so the table isn't flooded with un-attributable noise.
  if (actorUserId) {
    await logAudit({
      actorUserId,
      actorRole: actorRole ?? undefined,
      action: "empty_leg_watchlist.create",
      subjectType: "empty_leg_watchlist",
      subjectId: insertedId,
      metadata: {
        memberId,
        fromText: from,
        toText: to,
        earliestOn: earliest,
        latestOn: latest,
      },
    });
  }

  // Send the confirmations. A failure here is not worth failing the
  // submission over — the row exists and the links stay valid for the
  // window — but it is worth logging, because the person is sitting in
  // front of a form that just told them to check their phone.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com";
  try {
    const res = await sendSms({
      to: v.mobile,
      body: confirmSms(from, to, confirmUrl(siteUrl, smsToken.token)),
    });
    if (!res.ok) console.error("createWatchlist confirmation sms failed", res.error);
  } catch (err) {
    console.error("createWatchlist confirmation sms threw", err);
  }
  if (v.email && emailToken) {
    try {
      const { html, text } = confirmEmailBody(from, to, confirmUrl(siteUrl, emailToken.token));
      const res = await sendEmail({
        to: v.email,
        subject: confirmEmailSubject(from, to),
        html,
        text,
      });
      if (!res.ok) console.error("createWatchlist confirmation email failed", res.error);
    } catch (err) {
      console.error("createWatchlist confirmation email threw", err);
    }
  }

  revalidatePath("/empty-legs");
  revalidatePath("/account/preferences");
  return {
    ok: true,
    message: v.email
      ? "CHECK YOUR PHONE AND EMAIL — CONFIRM TO START ALERTS"
      : "CHECK YOUR PHONE — CONFIRM TO START ALERTS",
  };
}
