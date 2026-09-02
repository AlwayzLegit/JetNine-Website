import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

// Service-role client. Bypasses RLS — server-side only, never exposed.
let client: SupabaseClient | null = null;
export function getDb(): SupabaseClient {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
