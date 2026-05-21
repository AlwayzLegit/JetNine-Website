-- Phase C.3 empty_legs: code generator + RLS + sample data.

-- ─── 1. code generator: EL-YYYY-NNNN ─────────────────────────────────────

create or replace function public.next_empty_leg_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr int := extract(year from now())::int;
  n int;
begin
  insert into public.empty_leg_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.empty_leg_code_sequence.last_value + 1
  returning last_value into n;
  return 'EL-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.empty_legs_set_default_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.next_empty_leg_code();
  end if;
  return new;
end;
$$;

create trigger empty_legs_default_code
  before insert on public.empty_legs
  for each row execute function public.empty_legs_set_default_code();

create trigger empty_legs_set_updated_at
  before update on public.empty_legs
  for each row execute function public.set_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────

alter table public.empty_legs enable row level security;
alter table public.empty_leg_watchlists enable row level security;
alter table public.empty_leg_code_sequence enable row level security;

-- empty_legs
-- Public read for the marketing board: anyone (even anon) can SELECT rows
-- where status = 'live'. Authenticated users see the same scope; staff sees
-- everything (drafts, scheduled, sold, etc.). Writes are staff-only.
create policy "empty_legs_public_live" on public.empty_legs
  for select to anon
  using (status = 'live');

create policy "empty_legs_authenticated_live" on public.empty_legs
  for select to authenticated
  using (status = 'live' or public.is_staff());

create policy "empty_legs_staff_all" on public.empty_legs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- empty_leg_watchlists
-- Anonymous users can INSERT a watchlist tied to an email/phone (no
-- member_id). Authenticated users INSERT scoped to their own member.
-- Reads are owner-only or staff.
create policy "empty_leg_watchlists_anon_insert" on public.empty_leg_watchlists
  for insert to anon
  with check (member_id is null and (email is not null or phone_e164 is not null));

create policy "empty_leg_watchlists_self_insert" on public.empty_leg_watchlists
  for insert to authenticated
  with check (
    member_id is null
    or member_id in (select id from public.members where user_id = auth.uid())
  );

create policy "empty_leg_watchlists_self_select" on public.empty_leg_watchlists
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "empty_leg_watchlists_staff_all" on public.empty_leg_watchlists
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ─── 3. Sample empty legs ───────────────────────────────────────────────
-- Six representative repositioning flights from the seeded operators &
-- aircraft. wheels_up_at uses now()+offset so they always look "fresh"
-- against today's date — staff can repromote them by editing.

insert into public.empty_legs (
  aircraft_id, operator_id, category,
  from_icao, from_iata, from_city, from_name,
  to_icao, to_iata, to_city, to_name,
  wheels_up_at, flight_minutes, distance_nm,
  seats_available, full_charter_ref_usd, listed_price_usd, discount_pct,
  pet_friendly, headline, body_copy, status,
  visibility_flags, board_go_live_at, expires_at
)
select
  ac.id, ac.operator_id, ac.category,
  v.from_icao, v.from_iata, v.from_city, v.from_name,
  v.to_icao, v.to_iata, v.to_city, v.to_name,
  now() + v.offset_h * interval '1 hour',
  v.flight_min, v.distance_nm,
  v.seats, v.full_ref, v.listed, v.disc_pct,
  true, v.headline, v.body_copy, 'live',
  jsonb_build_object('publicBoard', true, 'memberMatch', true, 'weeklyDigest', false, 'affiliateFeed', false),
  now() - interval '1 hour',
  now() + (v.offset_h * interval '1 hour') - interval '30 minutes'
from (values
  -- VNY → TEB, Latitude (Skyline)
  ('N814QX', 'KVNY','VNY','Los Angeles','Van Nuys',
              'KTEB','TEB','New York','Teterboro',
              7,  290, 2151, 8, 38000, 15200, 60,
              'Tonight, Van Nuys to Teterboro — 60% off',
              'Citation Latitude positioning empty back to TEB tonight. Eight seats. Pets welcome. Wheels-up 6:30 PM PT.'),
  -- KASE → KDAL, Phenom (Aspen Mountain)
  ('N109AM','KASE','ASE','Aspen','Aspen-Pitkin',
              'KDAL','DAL','Dallas','Dallas Love',
              26, 145, 1020, 7, 18000, 8200, 54,
              'Aspen to Dallas, tomorrow morning',
              'Phenom 300 ferry leg. Seven seats, Wi-Fi, lavatory enclosed. Single sector — date locked.'),
  -- KPBI → KVNY, Challenger (Sunbelt — actually Atlas Challenger 350 in our seeds)
  ('N705AT','KPBI','PBI','Palm Beach','Palm Beach Intl.',
              'KVNY','VNY','Los Angeles','Van Nuys',
              72, 310, 2200, 9, 52000, 21000, 60,
              'Palm Beach → LA, Friday 11am',
              'Super-mid Challenger 350 with Ka-band Wi-Fi. Flat-floor cabin, double club. Nine seats.'),
  -- KSFO → EGLL, Global 6000 (Pacific Wings - wait, we have G650ER N550PW)
  ('N550PW','KSFO','SFO','San Francisco','San Francisco Intl.',
              'EGLL','LHR','London','Heathrow',
              120, 590, 4790, 14, 195000, 89000, 55,
              'SFO → London, Wednesday night',
              'Gulfstream G650ER repositioning to LHR. Three-zone cabin, lie-flat, real bed in the aft. Fourteen seats.'),
  -- KTEB → KMVY, CJ3 (Heritage — but we don''t have CJ3 in seed. use N925SK Phenom)
  ('N925SK','KTEB','TEB','New York','Teterboro',
              'KMVY','MVY','Martha''s Vineyard','Martha''s Vineyard',
              28,  65,  220, 6, 8000, 3000, 62,
              'Teterboro → Martha''s Vineyard, tomorrow PM',
              'Light jet hop, late afternoon. Six seats. Pets welcome.'),
  -- KIAD → RJTT, Global 7500 (TransAtlantic Aviation)
  ('N890TA','KIAD','IAD','Washington','Dulles Intl.',
              'RJTT','HND','Tokyo','Haneda',
              96, 770, 6680, 17, 240000, 108000, 55,
              'Dulles → Haneda, Thursday afternoon',
              'Global 7500 ferry. Three-zone, full bedroom, Ka-band streaming. Seventeen seats.')
) as v(
  tail,
  from_icao, from_iata, from_city, from_name,
  to_icao, to_iata, to_city, to_name,
  offset_h, flight_min, distance_nm,
  seats, full_ref, listed, disc_pct,
  headline, body_copy
)
join public.aircraft ac on ac.tail_number = v.tail;
