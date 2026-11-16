"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { findUserForMail, issueToken } from "@/lib/auth-tokens";
import { sendAuthLinkEmail } from "@/lib/auth-mail";
import { createSession, endSession, getSessionUser, isCurrentPassword, setPassword, verifyPassword } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { newPasswordProblem } from "@/lib/password-rules";

export type SignInResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Same response whether the email exists or not — anything else lets a bot
// (or a person) enumerate which addresses hold accounts, and gives form
// bots a success signal to learn from.
const NEUTRAL_OK: SignInResult = {
  ok: true,
  message:
    "If that email has a JetNine account, a sign-in link is on its way — check your inbox.",
};

const NEUTRAL_RESET_OK: SignInResult = {
  ok: true,
  message:
    "If that email has a JetNine account, a reset link is on its way — check your inbox.",
};

// Bots were hammering this action (~150 junk auth users in two months, zero
// of which ever signed in), each hit minting a user AND burning an email
// send. Keep both windows tight: real members request one link, maybe two.
const IP_MAX = 5;
const IP_WINDOW_S = 600; // 5 per 10 minutes per IP
const GLOBAL_MAX = 60;
const GLOBAL_WINDOW_S = 3600; // 60/hour across all IPs — backstop for rotating-IP bots

// Password attempts get a little more room (typos) but the same shape:
// per-IP first, then a global backstop so a rotating-IP guesser still
// runs out of road.
const PW_IP_MAX = 10;
const PW_IP_WINDOW_S = 600; // 10 per 10 minutes per IP
const PW_GLOBAL_MAX = 300;
const PW_GLOBAL_WINDOW_S = 3600;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clientIp(): Promise<string> {
  try {
    const hdrs = await headers();
    return clientIpFrom(hdrs) ?? "unknown";
  } catch {
    // headers() can throw outside a request scope (unit tests); proceed
    // without per-IP limiting in that case — the global bucket still applies.
    return "unknown";
  }
}

/**
 * The one rate-limit shape every sign-in action shares: a per-IP window
 * (skipped when the IP is unknown) and a global window. Returns the error
 * sentence to show, or null when the request may proceed.
 */
async function authRateLimited(
  prefix: string,
  ip: string,
  limits: { ipMax: number; ipWindowS: number; globalMax: number; globalWindowS: number },
  tooMany: string,
): Promise<string | null> {
  if (ip !== "unknown") {
    const rl = await checkRateLimit(`${prefix}:${ip}`, {
      max: limits.ipMax,
      windowSeconds: limits.ipWindowS,
    });
    if (!rl.ok) return tooMany;
  }
  const globalRl = await checkRateLimit(`${prefix}:global`, {
    max: limits.globalMax,
    windowSeconds: limits.globalWindowS,
  });
  if (!globalRl.ok) return tooMany;
  return null;
}

const LINK_LIMITS = {
  ipMax: IP_MAX,
  ipWindowS: IP_WINDOW_S,
  globalMax: GLOBAL_MAX,
  globalWindowS: GLOBAL_WINDOW_S,
};
const TOO_MANY_LINKS = "Too many link requests — wait a few minutes, or call dispatch.";

/**
 * Emails a one-time sign-in link from the site's own mail (OPS-94). The link
 * opens /auth/link, which shows a button; the token is spent by the POST
 * behind it, then the site starts its own session and sends the person on
 * to <dest>.
 *
 * Accounts are provisioned by dispatch (member invite) — there is no
 * self-serve signup, so this action never creates users. Unknown or banned
 * emails get the neutral response and nothing is sent or stored.
 */
export async function sendMagicLink(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Sanitize `next` before it goes into the link. The link page and the
  // action behind it sanitize it again (defense in depth).
  const next = safeNext(formData.get("next") as string | null);

  // Honeypot: the visible form never exposes this field, so any value here
  // is an autofill bot. Pretend success so the bot moves on; send nothing.
  if (String(formData.get("company") ?? "").trim()) {
    console.warn("sendMagicLink honeypot tripped — dropping request");
    return NEUTRAL_OK;
  }

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const ip = await clientIp();
  const limited = await authRateLimited("signin", ip, LINK_LIMITS, TOO_MANY_LINKS);
  if (limited) return { ok: false, error: limited };

  return mailLink(email, "signin", next, ip, NEUTRAL_OK);
}

const COULD_NOT_SEND = "Couldn't send the link — try again or call dispatch.";

/**
 * Looks the account up, issues a token and sends the mail. A missing or
 * banned account returns the neutral answer and sends nothing. A failure to
 * look up, store or send says so: a member whose send genuinely failed must
 * not be told it was sent.
 */
async function mailLink(
  email: string,
  purpose: "signin" | "reset",
  next: string | undefined,
  ip: string,
  neutral: SignInResult,
): Promise<SignInResult> {
  try {
    const user = await findUserForMail(email);
    if (!user) {
      console.warn(`${purpose} link requested for an email with no account (no send) — ip=${ip}`);
      return neutral;
    }
    const token = await issueToken(user.id, purpose);
    const sent = await sendAuthLinkEmail({ to: email, purpose, token, next });
    if (!sent.ok) {
      console.error(`${purpose} link mail not sent`, { reason: sent.error.split(":")[0].slice(0, 40) });
      return { ok: false, error: COULD_NOT_SEND };
    }
  } catch (err) {
    const e = err as { name?: string; code?: string };
    console.error(`${purpose} link request failed`, { name: e?.name, code: e?.code });
    return { ok: false, error: COULD_NOT_SEND };
  }
  return neutral;
}

export type PasswordSignInResult =
  | { ok: true; next: string }
  | { ok: false; error: string };

/**
 * Email + password sign-in. On success the site's own session cookie is set
 * on this response (server actions may write cookies) and the client
 * navigates to `next`. A wrong email and a wrong password get the same
 * sentence — the form must not say which addresses hold accounts.
 */
export async function signInWithPassword(formData: FormData): Promise<PasswordSignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next") as string | null);

  if (String(formData.get("company") ?? "").trim()) {
    console.warn("signInWithPassword honeypot tripped — dropping request");
    // Looks like a failed guess to the bot; nothing was checked.
    return { ok: false, error: WRONG_CREDENTIALS };
  }

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!password) {
    return { ok: false, error: "Enter your password." };
  }

  const ip = await clientIp();
  const limited = await authRateLimited(
    "pw",
    ip,
    {
      ipMax: PW_IP_MAX,
      ipWindowS: PW_IP_WINDOW_S,
      globalMax: PW_GLOBAL_MAX,
      globalWindowS: PW_GLOBAL_WINDOW_S,
    },
    "Too many attempts — wait a few minutes, email yourself a link, or call dispatch.",
  );
  if (limited) return { ok: false, error: limited };

  // The site's own check (src/lib/session): the password is compared in
  // place, a wrong email and a wrong password take the same time and get
  // the same answer. Only a database failure gets a different line.
  let userId: string | null;
  try {
    userId = await verifyPassword(email, password);
  } catch {
    return { ok: false, error: "Couldn't sign in just now — try again in a moment, or email yourself a link." };
  }
  if (!userId) {
    console.warn(`password sign-in refused — ip=${ip}`);
    return { ok: false, error: WRONG_CREDENTIALS };
  }

  try {
    await createSession(userId);
  } catch {
    return { ok: false, error: "Couldn't sign in just now — try again in a moment, or email yourself a link." };
  }

  return { ok: true, next };
}

const WRONG_CREDENTIALS =
  "That email and password don't match. Try again, or email yourself a sign-in link below.";

/**
 * Emails a password-reset link from the site's own mail (OPS-94). The link
 * opens /auth/link, whose button starts a session and sends the member to
 * /auth/reset, where the new password is set. The same neutral sentence
 * comes back whether or not the email has an account.
 */
export async function requestPasswordReset(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (String(formData.get("company") ?? "").trim()) {
    console.warn("requestPasswordReset honeypot tripped — dropping request");
    return NEUTRAL_RESET_OK;
  }

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const ip = await clientIp();
  // Shares the magic-link buckets: both mint an email, both are what the
  // bots were after.
  const limited = await authRateLimited("signin", ip, LINK_LIMITS, TOO_MANY_LINKS);
  if (limited) return { ok: false, error: limited };

  return mailLink(email, "reset", undefined, ip, NEUTRAL_RESET_OK);
}

export type UpdatePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Sets a new password on the signed-in account. Reached from the reset
 * email (recovery session), from an invite ("set your password") and from
 * the account's Change password panel. Needs a live session — there is no
 * token in the form, the cookie is the proof.
 */
export async function updatePassword(formData: FormData): Promise<UpdatePasswordResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const problem = newPasswordProblem(password, confirm);
  if (problem) return { ok: false, error: problem };

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "That link has expired or was already used. Request a new one." };
  }

  if (await isCurrentPassword(user.id, password)) {
    return { ok: false, error: "That's already your password — choose a new one." };
  }

  try {
    await setPassword(user.id, password);
  } catch (err) {
    const e = err as { name?: string; code?: string };
    console.error("update password error", { name: e?.name, code: e?.code });
    return { ok: false, error: "Couldn't save that password — try again or call dispatch." };
  }

  return { ok: true };
}

export async function signOut() {
  await endSession();
  redirect("/");
}
