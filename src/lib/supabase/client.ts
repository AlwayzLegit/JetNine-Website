import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Use in Client Components and event
 * handlers — anywhere that runs in the user's browser. The session
 * cookie is shared with the server client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
