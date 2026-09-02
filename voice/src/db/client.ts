import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

// Service-role client. Bypasses RLS — server-side only, never exposed.
export const db = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
