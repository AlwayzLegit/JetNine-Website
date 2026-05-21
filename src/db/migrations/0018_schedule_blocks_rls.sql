-- Phase B.2 RLS + helpers for aircraft_schedule_blocks.
--
-- Visibility: staff-only. Members never need to see "what else is on the
-- airframe today" — they get told whether their requested window is
-- available via the workbench, not by querying this table directly.

create trigger asb_set_updated_at
  before update on public.aircraft_schedule_blocks
  for each row execute function public.set_updated_at();

alter table public.aircraft_schedule_blocks enable row level security;

create policy "asb_staff_all" on public.aircraft_schedule_blocks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ─── Trip → block sync ─────────────────────────────────────────────────────
--
-- When a trip is created or updated with a wheels_up_at / wheels_down_at /
-- aircraft_id, mirror it into aircraft_schedule_blocks so the fleet planner
-- has one source of truth for "is this airframe busy?".
--
-- The sync is best-effort: if either timestamp is missing or the aircraft
-- isn't yet assigned, we skip — dispatch fills those in when sourcing.

create or replace function public.sync_trip_to_schedule_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
begin
  -- We only mirror trips that have an aircraft and a usable window.
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
    -- Clear any stale block; nothing to mirror.
    delete from public.aircraft_schedule_blocks
    where related_trip_id = new.id;
    return new;
  end if;

  -- Cancellation → drop the block.
  if new.status in ('cancelled_wx', 'cancelled_other') then
    delete from public.aircraft_schedule_blocks
    where related_trip_id = new.id;
    return new;
  end if;

  -- Upsert by related_trip_id.
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

drop trigger if exists trips_sync_schedule_block on public.trips;
create trigger trips_sync_schedule_block
  after insert or update on public.trips
  for each row execute function public.sync_trip_to_schedule_block();

-- When a trip is hard-deleted, the FK ON DELETE CASCADE already drops the
-- mirror row. No extra trigger needed.

-- Backfill — mirror any existing trips that already have an aircraft +
-- window. Idempotent against future runs because of the FK + ON CONFLICT.

insert into public.aircraft_schedule_blocks
  (aircraft_id, kind, start_at, end_at, related_trip_id, notes)
select
  t.aircraft_id,
  'trip',
  coalesce(t.wheels_up_at, (
    select min(coalesce(tl.scheduled_dep_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl where tl.trip_id = t.id
  )),
  coalesce(t.wheels_down_at, t.eta_at, (
    select max(coalesce(tl.scheduled_arr_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl where tl.trip_id = t.id
  )),
  t.id,
  t.trip_code
from public.trips t
where t.aircraft_id is not null
  and t.status not in ('cancelled_wx', 'cancelled_other')
  and not exists (
    select 1 from public.aircraft_schedule_blocks asb where asb.related_trip_id = t.id
  )
  and coalesce(t.wheels_up_at, (
    select min(coalesce(tl.scheduled_dep_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl where tl.trip_id = t.id
  )) is not null
  and coalesce(t.wheels_down_at, t.eta_at, (
    select max(coalesce(tl.scheduled_arr_at, (tl.depart_date::timestamp at time zone 'UTC')))
    from public.trip_legs tl where tl.trip_id = t.id
  )) is not null;
