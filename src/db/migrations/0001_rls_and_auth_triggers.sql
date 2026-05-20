-- Phase A.2: RLS, auth triggers, role helpers.
-- Drizzle doesn't model these — hand-written SQL applied via `pnpm db:migrate`.

-- ─── 1. Helper functions ──────────────────────────────────────────────────

-- Returns the role text for the currently authenticated user, or NULL if anon.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text from public.users where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in ('dispatcher', 'admin', 'superadmin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in ('admin', 'superadmin'), false);
$$;

-- ─── 2. updated_at trigger ────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ─── 3. Auto-create public.users on Supabase auth.users insert ────────────

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── 4. Role-immutability trigger ─────────────────────────────────────────
-- Members can update their own row but never their role. Admins can.

create or replace function public.enforce_user_role_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role can only be changed by admins'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger users_enforce_role_immutable
  before update of role on public.users
  for each row execute function public.enforce_user_role_immutable();

-- ─── 5. member_code auto-generation ───────────────────────────────────────
-- Format M-YYYY-NNNN; NNNN is a per-year sequence. Sequence is a table so
-- we don't pollute pg_class with per-year sequences.

create table if not exists public.member_code_sequence (
  year int primary key,
  last_value int not null default 0
);

create or replace function public.next_member_code()
returns text
language plpgsql
as $$
declare
  yr int := extract(year from now())::int;
  n int;
begin
  insert into public.member_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.member_code_sequence.last_value + 1
  returning last_value into n;
  return 'M-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.members_set_default_member_code()
returns trigger
language plpgsql
as $$
begin
  if new.member_code is null or new.member_code = '' then
    new.member_code := public.next_member_code();
  end if;
  return new;
end;
$$;

create trigger members_default_member_code
  before insert on public.members
  for each row execute function public.members_set_default_member_code();

-- ─── 6. Enable RLS ────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.members enable row level security;
alter table public.staff enable row level security;
alter table public.dispatcher_assignments enable row level security;
alter table public.member_code_sequence enable row level security;
-- member_code_sequence is system-only — no policies, so authenticated cannot
-- read or write it. The next_member_code() SECURITY DEFINER function still
-- bypasses RLS.

-- ─── 7. users policies ────────────────────────────────────────────────────

create policy "users_select_self_or_staff" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "users_update_self" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users_admin_update_all" on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT policy: rows only come from the on_auth_user_created trigger.
-- No DELETE policy: row removal cascades from auth.users via FK.

-- ─── 8. members policies ──────────────────────────────────────────────────

create policy "members_select_self_or_staff" on public.members
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "members_insert_self" on public.members
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "members_update_self" on public.members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members_staff_update_all" on public.members
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "members_admin_delete" on public.members
  for delete to authenticated
  using (public.is_admin());

-- ─── 9. staff policies ────────────────────────────────────────────────────
-- Any authenticated user can see the dispatcher list (members pick assignees,
-- the homepage may show "your dispatcher"). Only admins manage staff rows.

create policy "staff_select_any_authenticated" on public.staff
  for select to authenticated
  using (true);

create policy "staff_admin_all" on public.staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 10. dispatcher_assignments policies ──────────────────────────────────

create policy "dispatcher_assignments_staff_select" on public.dispatcher_assignments
  for select to authenticated
  using (public.is_staff());

create policy "dispatcher_assignments_admin_all" on public.dispatcher_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
