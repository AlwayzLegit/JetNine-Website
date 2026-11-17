// The mails behind an emailed link (OPS-94): sign-in link, password reset and
// invite. Plain HTML and text in the desk's voice, no em or en dashes.
//
// Every link comes from NEXT_PUBLIC_SITE_URL (with https://jetnine.com as the
// fallback), never from the Host header: a reset link built from the request
// is the Host header injection the OWASP Forgot Password cheat sheet warns of.
//
// A link is a secret. It is never logged: the mails are sent with
// `sensitive`, and in production a deployment with no mail provider returns a
// failure instead of pretending the mail went out.

import { sendEmail, brandedShell, button, escapeHtml, type SendResult } from "@/lib/email";
import { isProductionDeploy } from "@/lib/deploy-env";
import { linkFor, linkOrigin, TTL_MS } from "@/lib/auth-tokens/core.mjs";

export type AuthMailPurpose = "signin" | "reset" | "invite";

const COPY: Record<
  AuthMailPurpose,
  { subject: string; kicker: string; headline: string; lead: string; label: string }
> = {
  signin: {
    subject: "Your JetNine sign-in link",
    kicker: "Sign in",
    headline: "Your sign-in link.",
    lead: "Use the button below to sign in to JetNine.",
    label: "Sign in to JetNine",
  },
  reset: {
    subject: "Reset your JetNine password",
    kicker: "Password",
    headline: "Reset your password.",
    lead: "Use the button below to choose a new password.",
    label: "Set your password",
  },
  invite: {
    subject: "You're invited to JetNine",
    kicker: "Welcome",
    headline: "Set your password.",
    lead: "JetNine dispatch has set up an account for you. Use the button below to choose a password and get started.",
    label: "Set your password",
  },
};

/** "15 minutes", "30 minutes", "7 days". */
export function validForWords(purpose: AuthMailPurpose): string {
  const ms = TTL_MS[purpose];
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (ms >= 24 * 60 * 60 * 1000) return `${days} ${days === 1 ? "day" : "days"}`;
  const minutes = Math.round(ms / (60 * 1000));
  return `${minutes} minutes`;
}

/** The two bodies of one auth mail, for the sender and for tests. */
export function authMailContent(purpose: AuthMailPurpose, link: string) {
  const c = COPY[purpose];
  const valid = validForWords(purpose);
  const closing = "If you did not ask for this, ignore this email.";
  const text = [c.lead, "", `${c.label}: ${link}`, "", `The link works once and for ${valid}.`, closing].join("\n");
  const html = brandedShell(
    c.kicker,
    c.headline,
    `
      <p style="margin:0 0 20px;font-size:15px;">${escapeHtml(c.lead)}</p>
      <p style="margin:0 0 20px;">${button(link, `${c.label} →`)}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#56616A;">The link works once and for ${escapeHtml(valid)}.</p>
      <p style="margin:0;font-size:13px;color:#56616A;">${escapeHtml(closing)}</p>
    `,
  );
  return { subject: c.subject, html, text };
}

/**
 * Sends one auth mail. `token` is the raw one-time token from issueToken.
 * Returns ok false when the mail could not be sent, so the caller can say
 * so instead of claiming it went out.
 */
export async function sendAuthLinkEmail(ctx: {
  to: string;
  purpose: AuthMailPurpose;
  token: string;
  next?: string;
}): Promise<SendResult> {
  const origin = linkOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const link = linkFor(origin, ctx.token, ctx.purpose, ctx.next);
  const { subject, html, text } = authMailContent(ctx.purpose, link);
  const result = await sendEmail({ to: ctx.to, subject, html, text, sensitive: true });
  if (result.ok && result.provider === "logger" && isProductionDeploy()) {
    // Production with no mail provider: nothing left the process.
    return { ok: false, error: "no mail provider configured" };
  }
  return result;
}
