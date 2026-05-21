-- Phase A.2 RLS + updated_at trigger for member_preferences.

create trigger member_preferences_set_updated_at
  before update on public.member_preferences
  for each row execute function public.set_updated_at();

-- ─── Enable RLS ─────────────────────────────────────────────────────────

alter table public.member_preferences enable row level security;
alter table public.member_lanes enable row level security;
alter table public.companions enable row level security;
alter table public.member_documents enable row level security;

-- ─── member_preferences ────────────────────────────────────────────────
-- Owner can read + upsert their own row. Staff sees everything (read-only).

create policy "member_preferences_self_select" on public.member_preferences
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "member_preferences_self_insert" on public.member_preferences
  for insert to authenticated
  with check (
    member_id in (select id from public.members where user_id = auth.uid())
  );

create policy "member_preferences_self_update" on public.member_preferences
  for update to authenticated
  using (member_id in (select id from public.members where user_id = auth.uid()))
  with check (member_id in (select id from public.members where user_id = auth.uid()));

create policy "member_preferences_admin_update" on public.member_preferences
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── member_lanes ──────────────────────────────────────────────────────

create policy "member_lanes_self_select" on public.member_lanes
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "member_lanes_self_all" on public.member_lanes
  for all to authenticated
  using (member_id in (select id from public.members where user_id = auth.uid()))
  with check (member_id in (select id from public.members where user_id = auth.uid()));

create policy "member_lanes_staff_all" on public.member_lanes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ─── companions ────────────────────────────────────────────────────────

create policy "companions_self_select" on public.companions
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "companions_self_all" on public.companions
  for all to authenticated
  using (member_id in (select id from public.members where user_id = auth.uid()))
  with check (member_id in (select id from public.members where user_id = auth.uid()));

create policy "companions_staff_all" on public.companions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ─── member_documents (PII — strictest) ────────────────────────────────
-- Members can list their own documents but NOT see the encrypted field
-- in cleartext (the SECURITY DEFINER RPC decrypts and is restricted to
-- admin role). Staff can list. Admin only can write.

create policy "member_documents_self_select" on public.member_documents
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "member_documents_admin_all" on public.member_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
