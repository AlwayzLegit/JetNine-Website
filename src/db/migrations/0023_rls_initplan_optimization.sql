-- RLS perf — wrap auth.uid() in (select auth.uid()) so Postgres evaluates
-- it once per query (initPlan) instead of per row. Zero behaviour change;
-- the optimization kicks in because auth.uid() is STABLE — the planner
-- can hoist a sub-SELECT but not a bare function call.
--
-- 28 policies across 16 tables, flagged by the `auth_rls_initplan`
-- advisor. Re-creates each policy in place; DROP + CREATE are inside the
-- transaction so the table is never left unprotected.

-- ── public.users ──────────────────────────────────────────────────────────
drop policy "users_select_self_or_staff" on public.users;
create policy "users_select_self_or_staff" on public.users
  for select to authenticated
  using ((id = (select auth.uid())) or public.is_staff());

drop policy "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── public.members ────────────────────────────────────────────────────────
drop policy "members_select_self_or_staff" on public.members;
create policy "members_select_self_or_staff" on public.members
  for select to authenticated
  using ((user_id = (select auth.uid())) or public.is_staff());

drop policy "members_insert_self" on public.members;
create policy "members_insert_self" on public.members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy "members_update_self" on public.members;
create policy "members_update_self" on public.members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── public.quotes ─────────────────────────────────────────────────────────
drop policy "quotes_authenticated_insert" on public.quotes;
create policy "quotes_authenticated_insert" on public.quotes
  for insert to authenticated
  with check (
    ((created_by_user_id is null) or (created_by_user_id = (select auth.uid())))
    and ((member_id is null) or (member_id in (
      select members.id from public.members where members.user_id = (select auth.uid())
    )))
    and (consent_broker = true) and (consent_contact = true)
  );

drop policy "quotes_select_owner_or_staff" on public.quotes;
create policy "quotes_select_owner_or_staff" on public.quotes
  for select to authenticated
  using (
    (created_by_user_id = (select auth.uid()))
    or (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.quote_legs ─────────────────────────────────────────────────────
drop policy "quote_legs_authenticated_insert" on public.quote_legs;
create policy "quote_legs_authenticated_insert" on public.quote_legs
  for insert to authenticated
  with check (quote_id in (
    select quotes.id from public.quotes
    where (quotes.created_by_user_id = (select auth.uid()))
       or (quotes.member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
       or public.is_staff()
  ));

drop policy "quote_legs_select" on public.quote_legs;
create policy "quote_legs_select" on public.quote_legs
  for select to authenticated
  using (quote_id in (
    select quotes.id from public.quotes
    where (quotes.created_by_user_id = (select auth.uid()))
       or (quotes.member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
       or public.is_staff()
  ));

-- ── public.trips ──────────────────────────────────────────────────────────
drop policy "trips_select_owner_or_staff" on public.trips;
create policy "trips_select_owner_or_staff" on public.trips
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.trip_legs ──────────────────────────────────────────────────────
drop policy "trip_legs_select" on public.trip_legs;
create policy "trip_legs_select" on public.trip_legs
  for select to authenticated
  using (trip_id in (
    select trips.id from public.trips
    where (trips.member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
       or public.is_staff()
  ));

-- ── public.invoices ───────────────────────────────────────────────────────
drop policy "invoices_select_owner_or_staff" on public.invoices;
create policy "invoices_select_owner_or_staff" on public.invoices
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.member_preferences ─────────────────────────────────────────────
drop policy "member_preferences_self_select" on public.member_preferences;
create policy "member_preferences_self_select" on public.member_preferences
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

drop policy "member_preferences_self_insert" on public.member_preferences;
create policy "member_preferences_self_insert" on public.member_preferences
  for insert to authenticated
  with check (member_id in (select members.id from public.members where members.user_id = (select auth.uid())));

drop policy "member_preferences_self_update" on public.member_preferences;
create policy "member_preferences_self_update" on public.member_preferences
  for update to authenticated
  using (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
  with check (member_id in (select members.id from public.members where members.user_id = (select auth.uid())));

-- ── public.member_lanes ───────────────────────────────────────────────────
drop policy "member_lanes_self_select" on public.member_lanes;
create policy "member_lanes_self_select" on public.member_lanes
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

drop policy "member_lanes_self_all" on public.member_lanes;
create policy "member_lanes_self_all" on public.member_lanes
  for all to authenticated
  using (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
  with check (member_id in (select members.id from public.members where members.user_id = (select auth.uid())));

-- ── public.companions ─────────────────────────────────────────────────────
drop policy "companions_self_select" on public.companions;
create policy "companions_self_select" on public.companions
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

drop policy "companions_self_all" on public.companions;
create policy "companions_self_all" on public.companions
  for all to authenticated
  using (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
  with check (member_id in (select members.id from public.members where members.user_id = (select auth.uid())));

-- ── public.member_documents ───────────────────────────────────────────────
drop policy "member_documents_self_select" on public.member_documents;
create policy "member_documents_self_select" on public.member_documents
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.empty_leg_watchlists ───────────────────────────────────────────
drop policy "empty_leg_watchlists_self_insert" on public.empty_leg_watchlists;
create policy "empty_leg_watchlists_self_insert" on public.empty_leg_watchlists
  for insert to authenticated
  with check (
    (member_id is null)
    or (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
  );

drop policy "empty_leg_watchlists_self_select" on public.empty_leg_watchlists;
create policy "empty_leg_watchlists_self_select" on public.empty_leg_watchlists
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.memberships ────────────────────────────────────────────────────
drop policy "memberships_self_select" on public.memberships;
create policy "memberships_self_select" on public.memberships
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.reserve_transactions ───────────────────────────────────────────
drop policy "reserve_transactions_self_select" on public.reserve_transactions;
create policy "reserve_transactions_self_select" on public.reserve_transactions
  for select to authenticated
  using (
    (member_id in (select members.id from public.members where members.user_id = (select auth.uid())))
    or public.is_staff()
  );

-- ── public.audit_log ──────────────────────────────────────────────────────
drop policy "audit_log_insert_self" on public.audit_log;
create policy "audit_log_insert_self" on public.audit_log
  for insert to authenticated
  with check ((actor_user_id is null) or (actor_user_id = (select auth.uid())));

-- ── public.messages ───────────────────────────────────────────────────────
drop policy "messages_select_owner_or_staff" on public.messages;
create policy "messages_select_owner_or_staff" on public.messages
  for select to authenticated
  using (
    (from_user_id = (select auth.uid()))
    or (to_user_id = (select auth.uid()))
    or public.is_staff()
  );

drop policy "messages_insert_self" on public.messages;
create policy "messages_insert_self" on public.messages
  for insert to authenticated
  with check (public.is_staff() or (from_user_id = (select auth.uid())));

drop policy "messages_update_own_read" on public.messages;
create policy "messages_update_own_read" on public.messages
  for update to authenticated
  using (
    (to_user_id = (select auth.uid()))
    or (from_user_id = (select auth.uid()))
    or public.is_staff()
  )
  with check (
    (to_user_id = (select auth.uid()))
    or (from_user_id = (select auth.uid()))
    or public.is_staff()
  );
