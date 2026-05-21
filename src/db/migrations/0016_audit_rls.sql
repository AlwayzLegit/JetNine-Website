-- Phase C.5: RLS for audit_log + messages. Both are essentially staff-only
-- in v1; members can see messages addressed to them in a future inbox UI.

alter table public.audit_log enable row level security;
alter table public.messages enable row level security;

-- audit_log
-- SELECT: staff only. Members shouldn't see operational audit (it carries
-- dispatcher PII like assigned-to changes).
-- INSERT: server-side only (Drizzle on the postgres role bypasses RLS).
-- For belt-and-suspenders, authenticated may insert ONLY when
-- actor_user_id = auth.uid().
-- UPDATE / DELETE: never allowed via RLS. Audit log is append-only.

create policy "audit_log_select_staff" on public.audit_log
  for select to authenticated
  using (public.is_staff());

create policy "audit_log_insert_self" on public.audit_log
  for insert to authenticated
  with check (actor_user_id is null or actor_user_id = auth.uid());

-- messages
-- SELECT: staff sees all; member sees messages where they're the to_user_id
-- OR from_user_id (their thread).
-- INSERT: staff anywhere; member only if from_user_id = auth.uid().
-- UPDATE: only is_read flip allowed for owners; staff can edit anything.
-- DELETE: admin only.

create policy "messages_select_owner_or_staff" on public.messages
  for select to authenticated
  using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_staff()
  );

create policy "messages_insert_self" on public.messages
  for insert to authenticated
  with check (
    public.is_staff()
    or from_user_id = auth.uid()
  );

create policy "messages_update_own_read" on public.messages
  for update to authenticated
  using (
    to_user_id = auth.uid()
    or from_user_id = auth.uid()
    or public.is_staff()
  )
  with check (
    to_user_id = auth.uid()
    or from_user_id = auth.uid()
    or public.is_staff()
  );

create policy "messages_delete_admin" on public.messages
  for delete to authenticated
  using (public.is_admin());
