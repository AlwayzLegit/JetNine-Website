import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogSubscribers } from "@/db/schema/blog-subscribers";
import { SITE } from "@/lib/constants";
import { CONFIRM_WINDOW_HOURS } from "@/lib/watchlist-confirm";

/**
 * Blog subscriber URLs + message copy. Token mechanics (issue/hash/expiry)
 * are shared with empty-leg watchlists — src/lib/watchlist-confirm.ts —
 * because the consent problem is identical: an email field with no proof
 * the person filling it in controls the inbox.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

export function blogConfirmUrl(token: string): string {
  return `${SITE_URL}/blog/confirm/${token}`;
}

/** Human link in the email body — asks for a click before acting. */
export function blogUnsubscribePageUrl(token: string): string {
  return `${SITE_URL}/blog/unsubscribe/${token}`;
}

/** RFC 8058 one-click target for the List-Unsubscribe header. POST only. */
export function blogUnsubscribePostUrl(token: string): string {
  return `${SITE_URL}/api/email/blog-unsubscribe/${token}`;
}

export function blogConfirmEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Confirm your JetNine blog subscription";
  const text =
    `Confirm your subscription\n\n` +
    `Someone asked us to send you JetNine's charter notes — a short weekly ` +
    `digest of what the desk published. Confirm here and we will start:\n\n${url}\n\n` +
    `The link expires in ${CONFIRM_WINDOW_HOURS} hours. If this was not you, ignore this ` +
    `email — nothing is sent unless the link is used.\n\n` +
    `JetNine dispatch · ${SITE.dispatchPhone}`;
  const html =
    `<p><strong>Confirm your subscription</strong></p>` +
    `<p>Someone asked us to send you JetNine&rsquo;s charter notes — a short weekly ` +
    `digest of what the desk published. Confirm and we will start:</p>` +
    `<p><a href="${url}">Confirm my subscription</a></p>` +
    `<p style="color:#666;font-size:13px">The link expires in ${CONFIRM_WINDOW_HOURS} hours. ` +
    `If this was not you, ignore this email — nothing is sent unless the link is used.</p>` +
    `<p style="color:#666;font-size:13px">JetNine dispatch &middot; ${SITE.dispatchPhone}</p>`;
  return { subject, html, text };
}

export type DigestPost = {
  slug: string;
  title: string;
  description: string;
};

export function blogDigestEmail(
  posts: DigestPost[],
  unsubscribePageUrl: string,
): { subject: string; html: string; text: string } {
  const lead = posts[0];
  const subject =
    posts.length === 1
      ? `From the desk: ${lead.title}`
      : `From the desk: ${lead.title} (+${posts.length - 1} more)`;

  const text = [
    `This week from the JetNine desk:`,
    ``,
    ...posts.flatMap((p) => [`${p.title}`, `${p.description}`, `${SITE_URL}/blog/${p.slug}`, ``]),
    `—`,
    `You're getting this because you confirmed a subscription at ${SITE_URL}/blog.`,
    `Stop these emails: ${unsubscribePageUrl}`,
  ].join("\n");

  const items = posts
    .map(
      (p) =>
        `<tr><td style="padding:0 0 22px;">` +
        `<a href="${SITE_URL}/blog/${p.slug}" style="font-size:17px;color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(p.title)}</a>` +
        `<p style="margin:6px 0 0;font-size:14px;line-height:1.55;color:#374151;">${escapeHtml(p.description)}</p>` +
        `</td></tr>`,
    )
    .join("");

  const html =
    `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">` +
    `<p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;margin:0 0 18px;">JetNine · This week from the desk</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>` +
    `<p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">You're getting this because you confirmed a subscription at ` +
    `<a href="${SITE_URL}/blog" style="color:#9ca3af;">jetnine.com/blog</a>. ` +
    `<a href="${unsubscribePageUrl}" style="color:#9ca3af;">Unsubscribe</a>.</p>` +
    `</div>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BlogUnsubscribeResult = { ok: boolean };

/**
 * Stop digest mail for the row holding this token. Idempotent, and quiet
 * about whether the token was real — same posture as the watchlist
 * unsubscribe: this direction only ever stops mail.
 */
export async function unsubscribeBlogByToken(token: string): Promise<BlogUnsubscribeResult> {
  const t = token.trim();
  if (!t) return { ok: true };
  try {
    await db
      .update(blogSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(blogSubscribers.unsubscribeToken, t));
    return { ok: true };
  } catch (err) {
    console.error("[blog-unsubscribe] write failed", err);
    return { ok: false };
  }
}
