-- Phase C.4: RLS + constraints + updated_at trigger for memberships
-- and reserve_transactions.

-- ─── 1. updated_at triggers ──────────────────────────────────────────────

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ─── 2. Partial unique: one active membership per member ────────────────

create unique index memberships_one_active_per_member
  on public.memberships (member_id)
  where status = 'active';

-- ─── 3. RLS ──────────────────────────────────────────────────────────────

alter table public.memberships enable row level security;
alter table public.reserve_transactions enable row level security;

-- memberships
-- Owner sees own; staff sees all. Writes admin-only (membership purchases
-- are real money — they go through ops, not self-service).

create policy "memberships_self_select" on public.memberships
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "memberships_admin_all" on public.memberships
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- reserve_transactions — ledger
-- Owner sees own; staff sees all. Writes ADMIN-only (members can never
-- touch the balance directly — every change goes through ops).

create policy "reserve_transactions_self_select" on public.reserve_transactions
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "reserve_transactions_admin_all" on public.reserve_transactions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 4. members.tier denorm: sync on memberships changes ────────────────
-- Keeps members.tier in sync with the active membership. Members start
-- on 'on_demand' (the default); promote / demote based on active program.

create or replace function public.sync_member_tier_from_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  -- When a membership transitions away from 'active', drop the member back
  -- to 'on_demand' unless another active row exists.
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

create trigger memberships_sync_member_tier
  after insert or update on public.memberships
  for each row execute function public.sync_member_tier_from_membership();
