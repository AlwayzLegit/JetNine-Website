import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SITE } from "@/lib/constants";

/**
 * Confirmed opt-in for empty-leg watchlists.
 *
 * The form takes a phone number and an optional email with no proof that
 * the person filling it in controls either. Without a confirmation step
 * anyone could subscribe a stranger to alerts, which is both an abuse
 * vector and, for SMS, the thing TCPA exists to prevent.
 *
 * A watchlist is therefore created unconfirmed and stays silent until the
 * recipient proves control of the address. Confirmation is per channel:
 * an SMS token cannot confirm the email address, because otherwise
 * someone could pair their own phone with a victim's inbox and confirm
 * both from the phone.
 *
 * Tokens are stored only as SHA-256 hashes. The database never holds a
 * value that would let anyone confirm on someone else's behalf, so a
 * leaked backup does not hand over the opt-in list.
 */

export const CONFIRM_WINDOW_HOURS = 48;

export type ConfirmChannel = "sms" | "email";

export type IssuedToken = {
  /** Goes in the link. Never persisted. */
  token: string;
  /** Persisted. */
  hash: string;
};

export function issueToken(): IssuedToken {
  // 32 bytes, URL-safe. Long enough that guessing is not a strategy.
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compare two hex hashes without leaking where they diverge. The lookup
 * is by indexed equality in Postgres, so this guards the second check
 * rather than the first, but a constant-time compare costs nothing and
 * keeps the pattern honest.
 */
export function hashesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export function confirmExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + CONFIRM_WINDOW_HOURS * 3_600_000);
}

export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function confirmUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/empty-legs/confirm/${token}`;
}

// ─── Unsubscribe ─────────────────────────────────────────────────────────

/**
 * The link a recipient uses to stop alert emails. The token is minted by
 * the database (migration 0042) and read back at send time, so every
 * alert can carry one.
 *
 * Two URLs, because they serve different callers. The API route is what
 * goes in the List-Unsubscribe header and answers POST only: mail
 * providers post to it when someone hits their "unsubscribe" button. The
 * page is for the link in the body, and asks for a click before acting,
 * so a scanner walking the message cannot unsubscribe on the reader's
 * behalf.
 */
export function unsubscribePostUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/api/email/unsubscribe/${token}`;
}

export function unsubscribePageUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/empty-legs/unsubscribe/${token}`;
}

/**
 * RFC 8058. Gmail and Yahoo require both headers on recurring mail, and
 * the pair is what turns the provider's own unsubscribe button into a
 * single POST rather than a trip through our UI.
 */
export function unsubscribeHeaders(postUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${postUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ─── Message copy ────────────────────────────────────────────────────────

function routeLabel(fromText: string, toText: string): string {
  return `${fromText.toUpperCase()} → ${toText.toUpperCase()}`;
}

/**
 * The confirmation SMS. Deliberately says what it is for and what to do
 * if it was not you, because the person receiving it may be exactly the
 * stranger this flow exists to protect.
 */
export function confirmSms(fromText: string, toText: string, url: string): string {
  return (
    `JetNine: confirm empty-leg alerts for ${routeLabel(fromText, toText)} — ${url}. ` +
    `Expires in ${CONFIRM_WINDOW_HOURS}h. Didn't request this? Ignore it and nothing is sent. ` +
    `Reply STOP to block all texts.`
  );
}

export function confirmEmailSubject(fromText: string, toText: string): string {
  return `Confirm your empty-leg alerts: ${routeLabel(fromText, toText)}`;
}

export function confirmEmailBody(
  fromText: string,
  toText: string,
  url: string,
): { html: string; text: string } {
  const route = routeLabel(fromText, toText);
  const text =
    `Confirm your empty-leg alerts\n\n` +
    `Someone asked us to email you when a repositioning leg matching ${route} ` +
    `hits the board. Confirm here and we will start:\n\n${url}\n\n` +
    `The link expires in ${CONFIRM_WINDOW_HOURS} hours. If this was not you, ignore this ` +
    `email — nothing is sent unless the link is used, and the request is deleted ` +
    `after it expires.\n\nJetNine dispatch · ${SITE.dispatchPhone}`;

  const html =
    `<p><strong>Confirm your empty-leg alerts</strong></p>` +
    `<p>Someone asked us to email you when a repositioning leg matching ` +
    `<strong>${route}</strong> hits the board. Confirm and we will start:</p>` +
    `<p><a href="${url}">Confirm these alerts</a></p>` +
    `<p style="color:#666;font-size:13px">The link expires in ${CONFIRM_WINDOW_HOURS} hours. ` +
    `If this was not you, ignore this email — nothing is sent unless the link is used, and ` +
    `the request is deleted after it expires.</p>` +
    `<p style="color:#666;font-size:13px">JetNine dispatch &middot; ${SITE.dispatchPhone}</p>`;

  return { html, text };
}
