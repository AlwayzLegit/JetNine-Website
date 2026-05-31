import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Magic-link landing. Supabase appends `?code=...&next=/dest` to the link;
 * we exchange the code for a session and redirect to `next`.
 *
 * `next` is sanitized via safeNext() before the redirect — see that helper
 * for why this is a security boundary, not a UX one.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`/sign-in?error=missing_code`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback exchange failed", error);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
