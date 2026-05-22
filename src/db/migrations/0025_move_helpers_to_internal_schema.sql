-- Move trigger-helper and codegen functions out of the API-exposed `public`
-- schema and into a private `jn_internal` schema. PostgREST doesn't expose
-- arbitrary schemas (only public/storage/graphql_public by default), so the
-- residual `anon_security_definer_function_executable` and
-- `authenticated_security_definer_function_executable` advisor warnings
-- from migration 0024 disappear once the functions move.
--
-- The call chain still works because:
--   (1) We GRANT USAGE on jn_internal to anon/authenticated/service_role —
--       triggers fire under the inserter's role and need to reach the
--       function.
--   (2) The default-code trigger functions stay SECURITY DEFINER (from
--       migration 0024) so they run as the owner; the inner
--       jn_internal.next_*_code() calls require no caller grants because
--       the call happens in the owner's privilege context.
--   (3) is_staff()/is_admin() in `public` are rewritten to call
--       jn_internal.current_user_role() so RLS continues to work.

create schema if not exists jn_internal authorization postgres;
grant usage on schema jn_internal to anon, authenticated, service_role;

-- ── codegen helpers ───────────────────────────────────────────────────────

create or replace function jn_internal.next_quote_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare yr int := extract(year from now())::int; n int;
begin
  insert into public.quote_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.quote_code_sequence.last_value + 1
  returning last_value into n;
  return 'JN-' || yr || '-' || lpad(n::text, 5, '0');
end;
$$;

create or replace function jn_internal.next_trip_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare yr int := extract(year from now())::int; n int;
begin
  insert into public.trip_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.trip_code_sequence.last_value + 1
  returning last_value into n;
  return 'JN-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function jn_internal.next_invoice_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare yr int := extract(year from now())::int; n int;
begin
  insert into public.invoice_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.invoice_code_sequence.last_value + 1
  returning last_value into n;
  return 'INV-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function jn_internal.next_empty_leg_code()
returns text language plpgsql security definer set search_path = ''
as $$
declare yr int := extract(year from now())::int; n int;
begin
  insert into public.empty_leg_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.empty_leg_code_sequence.last_value + 1
  returning last_value into n;
  return 'EL-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ── default-code trigger functions ────────────────────────────────────────

create or replace function jn_internal.quotes_set_default_code()
returns trigger language plpgsql security definer set search_path = 'public, pg_temp'
as $$
begin
  if new.quote_code is null or new.quote_code = '' then
    new.quote_code := jn_internal.next_quote_code();
  end if;
  return new;
end;
$$;

create or replace function jn_internal.trips_set_default_code()
returns trigger language plpgsql security definer set search_path = 'public, pg_temp'
as $$
begin
  if new.trip_code is null or new.trip_code = '' then
    new.trip_code := jn_internal.next_trip_code();
  end if;
  return new;
end;
$$;

create or replace function jn_internal.invoices_set_default_code()
returns trigger language plpgsql security definer set search_path = 'public, pg_temp'
as $$
begin
  if new.invoice_code is null or new.invoice_code = '' then
    new.invoice_code := jn_internal.next_invoice_code();
  end if;
  return new;
end;
$$;

create or replace function jn_internal.empty_legs_set_default_code()
returns trigger language plpgsql security definer set search_path = 'public, pg_temp'
as $$
begin
  if new.code is null or new.code = '' then
    new.code := jn_internal.next_empty_leg_code();
  end if;
  return new;
end;
$$;

-- ── current_user_role + is_staff/is_admin ────────────────────────────────

create or replace function jn_internal.current_user_role()
returns text language sql stable security definer set search_path = ''
as $$ select role::text from public.users where id = auth.uid(); $$;

create or replace function public.is_staff()
returns boolean language sql stable set search_path = 'public, pg_temp'
as $$ select coalesce(jn_internal.current_user_role() in ('dispatcher', 'admin', 'superadmin'), false); $$;

create or replace function public.is_admin()
returns boolean language sql stable set search_path = 'public, pg_temp'
as $$ select coalesce(jn_internal.current_user_role() in ('admin', 'superadmin'), false); $$;

-- ── sync triggers ─────────────────────────────────────────────────────────

create or replace function jn_internal.sync_trip_to_schedule_block()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
begin
  v_start := coalesce(new.wheels_up_at, (
    select min(coalesce(tl.scheduled_dep_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl
    where tl.trip_id = new.id
  ));
  v_end := coalesce(new.wheels_down_at, new.eta_at, (
    select max(coalesce(tl.scheduled_arr_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl
    where tl.trip_id = new.id
  ));

  if new.aircraft_id is null or v_start is null or v_end is null or v_end <= v_start then
    delete from public.aircraft_schedule_blocks where related_trip_id = new.id;
    return new;
  end if;

  if new.status in ('cancelled_wx', 'cancelled_other') then
    delete from public.aircraft_schedule_blocks where related_trip_id = new.id;
    return new;
  end if;

  insert into public.aircraft_schedule_blocks
    (aircraft_id, kind, start_at, end_at, related_trip_id, notes)
  values
    (new.aircraft_id, 'trip', v_start, v_end, new.id, new.trip_code)
  on conflict do nothing;

  update public.aircraft_schedule_blocks
  set aircraft_id = new.aircraft_id,
      start_at    = v_start,
      end_at      = v_end,
      notes       = new.trip_code,
      updated_at  = now()
  where related_trip_id = new.id;

  return new;
end;
$$;

create or replace function jn_internal.sync_member_tier_from_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.status = 'active' then
    update public.members
      set tier = case new.program
                   when 'on_demand' then 'on_demand'::public.member_tier
                   when 'card_100'  then 'card_100'::public.member_tier
                   when 'card_250'  then 'card_250'::public.member_tier
                   when 'card_500'  then 'card_500'::public.member_tier
                   when 'reserve_50'  then 'reserve_50'::public.member_tier
                   when 'reserve_100' then 'reserve_100'::public.member_tier
                   when 'reserve_250' then 'reserve_250'::public.member_tier
                   when 'reserve_500_apply' then 'reserve_500_apply'::public.member_tier
                 end,
          tier_since = new.activated_on
    where id = new.member_id;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' and new.status != 'active' then
    if not exists (
      select 1 from public.memberships
      where member_id = new.member_id and status = 'active' and id != new.id
    ) then
      update public.members
        set tier = 'on_demand'::public.member_tier
        where id = new.member_id;
    end if;
  end if;

  return new;
end;
$$;

-- ── repoint triggers ──────────────────────────────────────────────────────

drop trigger quotes_default_quote_code on public.quotes;
create trigger quotes_default_quote_code
  before insert on public.quotes
  for each row execute function jn_internal.quotes_set_default_code();

drop trigger trips_default_trip_code on public.trips;
create trigger trips_default_trip_code
  before insert on public.trips
  for each row execute function jn_internal.trips_set_default_code();

drop trigger invoices_default_invoice_code on public.invoices;
create trigger invoices_default_invoice_code
  before insert on public.invoices
  for each row execute function jn_internal.invoices_set_default_code();

drop trigger empty_legs_default_code on public.empty_legs;
create trigger empty_legs_default_code
  before insert on public.empty_legs
  for each row execute function jn_internal.empty_legs_set_default_code();

drop trigger trips_sync_schedule_block on public.trips;
create trigger trips_sync_schedule_block
  after insert or update on public.trips
  for each row execute function jn_internal.sync_trip_to_schedule_block();

drop trigger memberships_sync_member_tier on public.memberships;
create trigger memberships_sync_member_tier
  after insert or update on public.memberships
  for each row execute function jn_internal.sync_member_tier_from_membership();

-- ── drop the public.* versions ────────────────────────────────────────────

drop function public.quotes_set_default_code();
drop function public.trips_set_default_code();
drop function public.invoices_set_default_code();
drop function public.empty_legs_set_default_code();
drop function public.next_quote_code();
drop function public.next_trip_code();
drop function public.next_invoice_code();
drop function public.next_empty_leg_code();
drop function public.sync_trip_to_schedule_block();
drop function public.sync_member_tier_from_membership();
drop function public.current_user_role();
