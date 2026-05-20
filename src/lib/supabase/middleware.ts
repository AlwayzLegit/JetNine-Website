import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every request. Refreshes the Supabase session if needed and
 * forwards the updated auth cookies on the outgoing response. Without
 * this, RSCs see stale sessions.
 *
 * The matcher in middleware.ts at the project root decides which paths
 * pass through here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No env yet (e.g. preview deploy before secrets are wired) — keep
  // the request flowing rather than 500ing the whole site.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(
    url,
    anonKey,
    {
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
    },
  );

  // Touch getUser() so the session refresh runs.
  await supabase.auth.getUser();

  return response;
}
