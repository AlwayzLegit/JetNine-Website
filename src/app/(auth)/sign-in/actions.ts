"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

async function requestOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const LINK_LIMITS = {
  ipMax: IP_MAX,
  ipWindowS: IP_WINDOW_S,
  globalMax: GLOBAL_MAX,
  globalWindowS: GLOBAL_WINDOW_S,
};
const TOO_MANY_LINKS = "Too many link requests — wait a few minutes, or call dispatch.";

/**
 * Sends a magic-link email via Supabase Auth. The link points back at
 * /auth/callback?next=<dest> which exchanges the code for a session.
 *
 * Accounts are provisioned by dispatch (member invite) — there is no
 * self-serve signup, so this action never creates users
 * (shouldCreateUser: false). Unknown emails get the neutral response and
 * nothing is sent or stored.
 */
export async function sendMagicLink(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Sanitize `next` here too — Supabase encodes whatever we pass into the
  // magic link, so an unfiltered absolute URL ends up baked into a link
  // the attacker can trick the user into clicking. The callback also
  // re-sanitizes (defense in depth) but blocking at this layer keeps the
  // link itself benign in case a future caller forwards it elsewhere.
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

  const supabase = await createClient();
  const origin = await requestOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Unknown email + shouldCreateUser:false comes back as a "signups not
    // allowed" error — that's the expected non-member path, not a failure.
    // Swallow it into the neutral response; surface only real transport
    // errors (so a member whose send genuinely failed isn't told "sent").
    const msg = error.message ?? "";
    if (error.code === "otp_disabled" || /signups? not allowed/i.test(msg)) {
      console.warn(`magic link request for unknown email (no send) — ip=${ip}`);
      return NEUTRAL_OK;
    }
    console.error("magic link error", error);
    return { ok: false, error: "Couldn't send the link — try again or call dispatch." };
  }

  return NEUTRAL_OK;
}

export type PasswordSignInResult =
  | { ok: true; next: string }
  | { ok: false; error: string };

/**
 * Email + password sign-in. On success the Supabase session cookie is set
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // invalid_credentials covers "no such user" and "wrong password" alike
    // — keep it that way. Only a transport failure gets a different line.
    if (error.code === "invalid_credentials" || error.status === 400) {
      console.warn(`password sign-in refused — ip=${ip}`);
      return { ok: false, error: WRONG_CREDENTIALS };
    }
    console.error("password sign-in error", error);
    return { ok: false, error: "Couldn't sign in just now — try again in a moment, or email yourself a link." };
  }

  return { ok: true, next };
}

const WRONG_CREDENTIALS =
  "That email and password don't match. Try again, or email yourself a sign-in link below.";

/**
 * Emails a password-reset link. Supabase sends the member to
 * `${origin}/auth/reset`; the middleware hands the auth code to
 * /auth/callback, which establishes the session and returns to
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

  const supabase = await createClient();
  const origin = await requestOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset`,
  });

  if (error) {
    // Supabase answers unknown emails with success already; anything that
    // does come back is a transport or config problem worth saying so.
    console.error("password reset request error", error);
    return { ok: false, error: "Couldn't send the link — try again or call dispatch." };
  }

  return NEUTRAL_RESET_OK;
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "That link has expired or was already used. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("update password error", error);
    if (error.code === "same_password") {
      return { ok: false, error: "That's already your password — choose a new one." };
    }
    if (error.code === "weak_password") {
      return { ok: false, error: "That password is too easy to guess — try a longer one." };
    }
    return { ok: false, error: "Couldn't save that password — try again or call dispatch." };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
