-- Function-level security hardening.
--
-- (1) Pin search_path on the functions the Supabase advisor flagged as
--     "mutable". Without this, a SECURITY DEFINER function could be coerced
--     into resolving an unqualified table name via an attacker-controlled
--     search_path (privilege escalation). Setting `search_path = public,
--     pg_temp` keeps existing unqualified references working while removing
--     the mutability.
--
-- (2) Revoke EXECUTE on SECURITY DEFINER functions that don't need to be
--     callable via PostgREST RPC. They remain callable from triggers
--     (triggers don't check the caller's EXECUTE grants for DEFINER
--     functions). The `next_*_code` codegen helpers are intentionally
--     LEFT in place because they're called by SECURITY INVOKER triggers
--     on insert paths that anon / authenticated drive — revoking would
--     break the quote wizard and trip codegen.

-- ── (1) Pin search_path ────────────────────────────────────────────────────

alter function public.set_updated_at()                  set search_path = public, pg_temp;
alter function public.is_staff()                        set search_path = public, pg_temp;
alter function public.is_admin()                        set search_path = public, pg_temp;
alter function public.enforce_user_role_immutable()     set search_path = public, pg_temp;
alter function public.empty_legs_set_default_code()     set search_path = public, pg_temp;
alter function public.invoices_set_default_code()       set search_path = public, pg_temp;
alter function public.next_member_code()                set search_path = public, pg_temp;
alter function public.members_set_default_member_code() set search_path = public, pg_temp;
alter function public.quotes_set_default_code()         set search_path = public, pg_temp;
alter function public.trips_set_default_code()          set search_path = public, pg_temp;

-- ── (2) Revoke RPC exposure on functions only meant for triggers ──────────

-- current_user_role: anon never needs to call this. Anon-accessible RLS
-- policies on quotes/quote_legs/empty_leg_watchlists/empty_legs don't
-- invoke is_staff/is_admin (audited 2026-05-22). authenticated keeps
-- EXECUTE because is_staff/is_admin (called from RLS) chain into it.
revoke execute on function public.current_user_role() from anon;

-- handle_new_auth_user: only fires from the on_auth_user_created trigger
-- on auth.users. SECURITY DEFINER → trigger doesn't depend on caller
-- grants. Safe to lock out of PostgREST entirely.
revoke execute on function public.handle_new_auth_user() from anon, authenticated;

-- sync_member_tier_from_membership: only fires from the
-- memberships_sync_member_tier trigger. Same shape as above.
revoke execute on function public.sync_member_tier_from_membership() from anon, authenticated;
