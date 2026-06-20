import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Everything outside these prefixes is public. /sign-in and /auth/* are
// intentionally NOT in here so the auth flow itself doesn't get gated.
const PROTECTED_PREFIXES = ["/account", "/admin"] as const;

function isProtected(pathname: string): { kind: "account" | "admin" } | null {
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { kind: prefix.slice(1) as "account" | "admin" };
    }
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  // Auth resilience: a magic link sometimes lands a PKCE `?code=` on a page
  // other than the callback — e.g. when Supabase falls back to the Site URL
  // because the intended redirect isn't in its allowlist. Forward any stray
  // code to /auth/callback so the session is still established instead of the
  // code being silently dropped on the homepage. (The invite flow uses a URL
  // hash, which the server can't see — that path relies on the Supabase
  // redirect-URL allowlist being configured.)
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode && request.nextUrl.pathname !== "/auth/callback") {
    const cb = new URL("/auth/callback", request.url);
    cb.searchParams.set("code", authCode);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) cb.searchParams.set("next", nextParam);
    return NextResponse.redirect(cb);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoute = isProtected(request.nextUrl.pathname);
  if (!protectedRoute) return response;

  if (!user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Admin-only routes need a role check. We fetch from public.users via the
  // service role since the user's session cookie can't reach RLS-protected
  // rows for the role column reliably from middleware.
  if (protectedRoute.kind === "admin") {
    const { data: profile, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile || !["dispatcher", "admin", "superadmin"].includes(profile.role)) {
      const denyUrl = new URL("/account", request.url);
      denyUrl.searchParams.set("denied", "admin");
      return NextResponse.redirect(denyUrl);
    }
  }

  return response;
}
