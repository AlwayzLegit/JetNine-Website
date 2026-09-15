"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { checkRateLimit } from "@/lib/rate-limit";

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

// Bots were hammering this action (~150 junk auth users in two months, zero
// of which ever signed in), each hit minting a user AND burning an email
// send. Keep both windows tight: real members request one link, maybe two.
const IP_MAX = 5;
const IP_WINDOW_S = 600; // 5 per 10 minutes per IP
const GLOBAL_MAX = 60;
const GLOBAL_WINDOW_S = 3600; // 60/hour across all IPs — backstop for rotating-IP bots

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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // headers() can throw outside a request scope (unit tests); proceed
    // without per-IP limiting in that case — the global bucket still applies.
  }

  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`signin:${clientIp}`, {
      max: IP_MAX,
      windowSeconds: IP_WINDOW_S,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many link requests — wait a few minutes, or call dispatch.",
      };
    }
  }
  const globalRl = await checkRateLimit("signin:global", {
    max: GLOBAL_MAX,
    windowSeconds: GLOBAL_WINDOW_S,
  });
  if (!globalRl.ok) {
    return {
      ok: false,
      error: "Too many link requests — wait a few minutes, or call dispatch.",
    };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

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
      console.warn(`magic link request for unknown email (no send) — ip=${clientIp}`);
      return NEUTRAL_OK;
    }
    console.error("magic link error", error);
    return { ok: false, error: "Couldn't send the link — try again or call dispatch." };
  }

  return NEUTRAL_OK;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
