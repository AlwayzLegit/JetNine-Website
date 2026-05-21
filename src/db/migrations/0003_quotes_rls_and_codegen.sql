-- Phase C.1: RLS + quote_code generator + lifecycle defaults for quotes.

-- ─── 1. Quote-code generator: JN-YYYY-NNNNN ──────────────────────────────

create or replace function public.next_quote_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr int := extract(year from now())::int;
  n int;
begin
  insert into public.quote_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.quote_code_sequence.last_value + 1
  returning last_value into n;
  return 'JN-' || yr || '-' || lpad(n::text, 5, '0');
end;
$$;

create or replace function public.quotes_set_default_code()
returns trigger
language plpgsql
as $$
begin
  if new.quote_code is null or new.quote_code = '' then
    new.quote_code := public.next_quote_code();
  end if;
  return new;
end;
$$;

create trigger quotes_default_quote_code
  before insert on public.quotes
  for each row execute function public.quotes_set_default_code();

-- ─── 2. Reuse the shared updated_at trigger ──────────────────────────────

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ─── 3. Enable RLS ───────────────────────────────────────────────────────

alter table public.quotes enable row level security;
alter table public.quote_legs enable row level security;
alter table public.quote_code_sequence enable row level security;
-- quote_code_sequence has no policies — only SECURITY DEFINER functions
-- (next_quote_code) can touch it.

-- ─── 4. quotes policies ──────────────────────────────────────────────────

-- Anonymous can INSERT a quote (the homepage and /quote wizard).
-- They must NOT set member_id (RLS check enforces user_id linkage isn't
-- spoofed) — contact_snapshot carries the identity instead.
create policy "quotes_anon_insert" on public.quotes
  for insert to anon
  with check (
    member_id is null
    and created_by_user_id is null
    and source in ('quote_wizard', 'homepage_widget', 'empty_leg_inquiry')
    and consent_broker = true
    and consent_contact = true
  );

-- Authenticated users can INSERT — either anonymously-shaped (no member_id)
-- or pinned to their own user/member row.
create policy "quotes_authenticated_insert" on public.quotes
  for insert to authenticated
  with check (
    (created_by_user_id is null or created_by_user_id = auth.uid())
    and (
      member_id is null
      or member_id in (select id from public.members where user_id = auth.uid())
    )
    and consent_broker = true
    and consent_contact = true
  );

-- SELECT: owner-or-staff
create policy "quotes_select_owner_or_staff" on public.quotes
  for select to authenticated
  using (
    created_by_user_id = auth.uid()
    or member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

-- UPDATE: staff only (members can re-submit if needed via new INSERT)
create policy "quotes_update_staff" on public.quotes
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- DELETE: admin only
create policy "quotes_delete_admin" on public.quotes
  for delete to authenticated
  using (public.is_admin());

-- ─── 5. quote_legs policies ──────────────────────────────────────────────
-- Legs piggyback off the parent quote's access.

create policy "quote_legs_anon_insert" on public.quote_legs
  for insert to anon
  with check (
    quote_id in (
      select id from public.quotes
      where source in ('quote_wizard', 'homepage_widget', 'empty_leg_inquiry')
        and member_id is null
        and created_by_user_id is null
    )
  );

create policy "quote_legs_authenticated_insert" on public.quote_legs
  for insert to authenticated
  with check (
    quote_id in (
      select id from public.quotes
      where created_by_user_id = auth.uid()
         or member_id in (select id from public.members where user_id = auth.uid())
         or public.is_staff()
    )
  );

create policy "quote_legs_select" on public.quote_legs
  for select to authenticated
  using (
    quote_id in (
      select id from public.quotes
      where created_by_user_id = auth.uid()
         or member_id in (select id from public.members where user_id = auth.uid())
         or public.is_staff()
    )
  );

-- Anon needs to read its own freshly-inserted legs back (for the success
-- screen). Scope tightly to legs whose parent is anon-sourced.
create policy "quote_legs_anon_select_own" on public.quote_legs
  for select to anon
  using (
    quote_id in (
      select id from public.quotes
      where member_id is null
        and created_by_user_id is null
        and source in ('quote_wizard', 'homepage_widget', 'empty_leg_inquiry')
    )
  );

create policy "quote_legs_update_staff" on public.quote_legs
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "quote_legs_delete_admin" on public.quote_legs
  for delete to authenticated
  using (public.is_admin());

-- Anon also needs to read back the row it just inserted (the Server Action
-- queries the returned id for the success screen ref). Scope to anon-source
-- quotes only.
create policy "quotes_anon_select_own" on public.quotes
  for select to anon
  using (
    member_id is null
    and created_by_user_id is null
    and source in ('quote_wizard', 'homepage_widget', 'empty_leg_inquiry')
  );
