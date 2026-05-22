-- Tighten EXECUTE grants on SECURITY DEFINER functions so they're no longer
-- callable as PostgREST RPC endpoints by anon / authenticated. Two patterns:
--
-- (A) Functions that only need to fire from a specific path → REVOKE FROM
--     PUBLIC and (where the trigger caller's role still needs to reach them)
--     GRANT to the specific role.
--
-- (B) Codegen trigger functions (`*_set_default_code`) are converted from
--     SECURITY INVOKER → SECURITY DEFINER. That elevates the helper call
--     chain so the underlying `next_*_code()` functions don't need EXECUTE
--     from anon / authenticated anymore — only from the function owner,
--     which is implicit. Then `next_*_code()` is locked down too.

-- ── (A) Direct lockdown ────────────────────────────────────────────────────

revoke execute on function public.current_user_role()                from public;
grant  execute on function public.current_user_role()                to authenticated;

revoke execute on function public.handle_new_auth_user()             from public;
grant  execute on function public.handle_new_auth_user()             to supabase_auth_admin;

revoke execute on function public.sync_member_tier_from_membership() from public;
grant  execute on function public.sync_member_tier_from_membership() to authenticated, service_role;

revoke execute on function public.sync_trip_to_schedule_block()      from public;
grant  execute on function public.sync_trip_to_schedule_block()      to authenticated, service_role;

-- ── (B) Elevate codegen triggers → lock down next_*_code ──────────────────

alter function public.quotes_set_default_code()        security definer;
alter function public.trips_set_default_code()         security definer;
alter function public.invoices_set_default_code()      security definer;
alter function public.empty_legs_set_default_code()    security definer;

revoke execute on function public.next_quote_code()     from public;
revoke execute on function public.next_trip_code()      from public;
revoke execute on function public.next_invoice_code()   from public;
revoke execute on function public.next_empty_leg_code() from public;
