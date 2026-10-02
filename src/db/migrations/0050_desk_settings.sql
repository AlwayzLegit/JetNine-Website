-- Redesign phase 5 — Settings › Notifications and the reply-time promise.
--
-- staff_notification_prefs: one row per staff user (absent row = defaults).
-- desk_settings: desk-wide key/value settings, owner-editable. Seeded with
-- the 30-minute reply promise the site already advertises.
--
-- Both tables are read and written by the site through Drizzle on the
-- postgres role (bypasses RLS). RLS is on with staff-only SELECT so a
-- PostgREST caller with a member JWT sees nothing; writes go through
-- Server Actions only.

create table if not exists public.staff_notification_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  new_request boolean not null default true,
  reply_due_soon boolean not null default true,
  client_pick boolean not null default true,
  morning_summary boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.desk_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.desk_settings (key, value)
values ('reply_promise_minutes', '30'::jsonb)
on conflict (key) do nothing;

alter table public.staff_notification_prefs enable row level security;
alter table public.desk_settings enable row level security;

create policy "staff_notification_prefs_select_staff" on public.staff_notification_prefs
  for select to authenticated
  using (public.is_staff());

create policy "desk_settings_select_staff" on public.desk_settings
  for select to authenticated
  using (public.is_staff());

-- Settings › Team changes roles from a Server Action. The site connects on
-- the postgres role with no JWT, so public.is_admin() is false there and the
-- role-immutability trigger from 0001 would block every role change. The
-- action sets a transaction-local flag right before the update; the trigger
-- honours it. PostgREST callers cannot set it (set_config needs a session,
-- and the API role never runs arbitrary SQL), so the member-side guarantee
-- is unchanged.

create or replace function public.enforce_user_role_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and coalesce(current_setting('jn.allow_role_change', true), '') <> '1' then
    raise exception 'role can only be changed by admins'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
