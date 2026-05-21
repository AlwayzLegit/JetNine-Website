import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS. NEVER expose this client or its
 * key to the browser. Server Actions / Route Handlers only.
 *
 * Used for admin operations the anon client can't do — most notably
 * auth.admin.* (invite user, delete user, update user by id).
 *
 * Throws at runtime if SUPABASE_SERVICE_ROLE_KEY is missing rather than
 * silently falling back to anon, which would lead to confusing 401s.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
