import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Magic-link / invite landing. Two link shapes reach here:
 *
 *  - `?token_hash=...&type=...` — the recommended shape. We call
 *    `verifyOtp({ type, token_hash })`, which needs NO PKCE code_verifier,
 *    so the link works in any tab / browser / device (and survives email
 *    link-scanners). This is what the Supabase email templates should use:
 *    `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/account`
 *
 *  - `?code=...` — the PKCE shape. `exchangeCodeForSession` reads the
 *    verifier from THIS browser's cookie jar, so it only works when the link
 *    is opened in the same browser that requested it. Kept as a fallback.
 *
 * `next` is sanitized via safeNext() before the redirect — see that helper
 * for why this is a security boundary, not a UX one.
 */

const VALID_OTP_TYPES: EmailOtpType[] = [
  "email",
  "magiclink",
  "recovery",
  "invite",
  "signup",
  "email_change",
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  const supabase = await createClient();

  // Preferred: token_hash verification (tab/device-independent).
  if (tokenHash) {
    const type = (VALID_OTP_TYPES as string[]).includes(typeParam ?? "")
      ? (typeParam as EmailOtpType)
      : "email";
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("auth callback verifyOtp failed", error);
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Fallback: PKCE code exchange (same-browser only).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth callback exchange failed", error);
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL(`/sign-in?error=missing_code`, request.url));
}
