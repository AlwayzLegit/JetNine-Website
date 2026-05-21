-- Phase B.1: RLS + updated_at triggers + sample data for operators &
-- aircraft. Sample rows give the admin pages something to render before
-- the real operator + aircraft network gets loaded in.

-- ─── 1. updated_at triggers ──────────────────────────────────────────────

create trigger operators_set_updated_at
  before update on public.operators
  for each row execute function public.set_updated_at();

create trigger aircraft_set_updated_at
  before update on public.aircraft
  for each row execute function public.set_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────

alter table public.operators enable row level security;
alter table public.operator_contacts enable row level security;
alter table public.aircraft enable row level security;

-- operators
-- Everyone authenticated can SEE the directory (members see "who flies me");
-- only admins write. The marketing site doesn't need anonymous reads.
create policy "operators_select_authenticated" on public.operators
  for select to authenticated
  using (true);

create policy "operators_admin_all" on public.operators
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- operator_contacts — staff only (PII)
create policy "operator_contacts_select_staff" on public.operator_contacts
  for select to authenticated
  using (public.is_staff());

create policy "operator_contacts_admin_all" on public.operator_contacts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- aircraft
create policy "aircraft_select_authenticated" on public.aircraft
  for select to authenticated
  using (true);

create policy "aircraft_admin_all" on public.aircraft
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 3. Sample operators ─────────────────────────────────────────────────
-- Twelve representative operators across vetting tiers. Names are
-- placeholders — real network gets loaded by ops.

insert into public.operators (
  name, cert_number, faa_part, home_airport_icao, years_partner, is_preferred,
  status, argus_rating, wyvern_wingman, isbao_stage,
  argus_renews_on, wyvern_renews_on, isbao_renews_on, insurance_renews_on, next_audit_on,
  liability_limit_usd, payment_terms, volume_discount_pct, rate_lock, notes
) values
  ('Skyline Aviation Group', 'OF-12842', '135', 'KVNY', 9, true,
    'active', 'platinum', true, 3,
    '2026-09-15', '2026-09-15', '2026-10-01', '2026-12-31', '2026-07-01',
    500000000, 'NET-30', 4.50, false, 'West-coast anchor; Phenom 300 + Citation Latitude fleet.'),
  ('Atlas Charter Operations', 'OF-04211', '135', 'KTEB', 14, true,
    'active', 'platinum', true, 3,
    '2026-08-10', '2026-08-10', '2026-08-30', '2026-12-31', '2026-06-15',
    750000000, 'NET-30', 5.00, true, 'East-coast workhorse; full heavy-jet bench.'),
  ('Pacific Wings Charter', 'OF-19772', '135', 'KSFO', 7, true,
    'active', 'platinum', true, 2,
    '2026-10-22', null, '2027-01-10', '2026-12-31', '2026-08-22',
    500000000, 'NET-30', 4.00, false, 'Trans-pacific specialist.'),
  ('Aspen Mountain Aviation', 'OF-28811', '135', 'KASE', 11, false,
    'active', 'platinum', false, 2,
    '2026-09-01', null, '2027-02-15', '2026-12-31', '2026-09-01',
    500000000, 'NET-30', 3.00, false, 'Mountain-airport experts.'),
  ('Northeast Executive Air', 'OF-09921', '135', 'KBED', 18, false,
    'active', 'gold', true, 2,
    '2026-06-12', '2026-06-12', '2026-07-01', '2026-12-31', '2026-04-15',
    300000000, 'NET-45', 2.50, false, 'New England regional; midsize bench.'),
  ('Sunbelt Jet Holdings', 'OF-15527', '135', 'KOPF', 6, false,
    'active', 'gold', false, null,
    '2026-11-30', null, null, '2026-12-31', '2026-10-15',
    300000000, 'NET-30', 2.00, false, 'Florida + Caribbean coverage.'),
  ('TransAtlantic Aviation', 'OF-33390', '135', 'KIAD', 22, true,
    'active', 'platinum', true, 3,
    '2026-08-25', '2026-08-25', '2026-09-15', '2026-12-31', '2026-07-15',
    1000000000, 'NET-30', 6.00, true, 'Transatlantic + heavy/ULR specialist.'),
  ('Midwest Charter Group', 'OF-22411', '135', 'KDAL', 12, false,
    'active', 'gold', false, 2,
    '2026-07-19', null, '2027-03-01', '2026-12-31', '2026-05-20',
    500000000, 'NET-30', 3.50, false, 'Texas hub; midsize + super-mid.'),
  ('Coastline Charter Services', 'OF-41122', '135', 'KSDL', 5, false,
    'audit_due', 'gold', false, null,
    '2025-12-01', null, null, '2026-12-31', '2026-04-01',
    300000000, 'NET-30', 1.50, false, 'AZ-based; light jet fleet.'),
  ('Heritage Air Partners', 'OF-50318', '135', 'KMIA', 15, false,
    'hold', 'silver', false, null,
    '2026-03-15', null, null, '2026-08-15', '2026-04-15',
    300000000, 'NET-45', 0, false, 'On hold pending insurance refresh.'),
  ('Continental Jet Services', 'OF-16604', '135', 'KLAS', 8, false,
    'suspended', 'gold', false, null,
    '2025-11-30', null, null, '2026-06-30', '2025-11-15',
    300000000, 'NET-30', 0, false, 'Suspended 2026-03-12 — pending FAA enforcement review.'),
  ('Sierra Charter Holdings', 'OF-29882', '135', 'KBFI', 4, false,
    'active', 'gold', false, null,
    '2026-12-08', null, null, '2026-12-31', '2026-11-15',
    300000000, 'NET-30', 1.00, false, 'Pacific Northwest; light + midsize.');

-- ─── 4. Sample aircraft ──────────────────────────────────────────────────
-- 18 tails distributed across the operators above.

insert into public.aircraft (
  tail_number, operator_id, category, make_model, year_manufactured,
  seats, range_nm, speed_kt, wifi_type,
  standup_cabin, lavatory_enclosed, lieflat_capable, pet_friendly, flight_attendant_standard,
  base_icao, total_hours, status
)
select v.tail, op.id, v.category::public.aircraft_category, v.model, v.yr,
       v.seats, v.range_nm, v.speed_kt, v.wifi::public.aircraft_wifi,
       v.standup, v.lav, v.lieflat, v.pet, v.fa,
       v.base, v.hrs, v.st::public.aircraft_status
from (values
  ('N814QX', 'Skyline Aviation Group',     'midsize',  'Citation Latitude',         2019, 9, 2700, 446, 'yes',   true,  true,  false, true,  false, 'KVNY', 1620, 'available'),
  ('N925SK', 'Skyline Aviation Group',     'light',    'Phenom 300E',               2022, 7, 2010, 464, 'yes',   false, true,  false, true,  false, 'KVNY',  840, 'available'),
  ('N336SK', 'Skyline Aviation Group',     'midsize',  'Citation XLS+',             2018, 9, 2100, 441, 'yes',   true,  true,  false, true,  false, 'KVNY', 2140, 'available'),
  ('N612AT', 'Atlas Charter Operations',   'heavy',    'Falcon 2000LXS',            2019, 10, 4000, 482, 'ka',   true,  true,  false, true,  true,  'KTEB', 2360, 'available'),
  ('N705AT', 'Atlas Charter Operations',   'supermid', 'Challenger 350',            2020, 10, 3200, 488, 'ka',   true,  true,  false, true,  false, 'KTEB', 1480, 'available'),
  ('N221AT', 'Atlas Charter Operations',   'heavy',    'Gulfstream G450',           2017, 14, 4350, 476, 'ka',   true,  true,  true,  true,  true,  'KTEB', 3220, 'available'),
  ('N550PW', 'Pacific Wings Charter',      'ulr',      'Gulfstream G650ER',         2020, 14, 7500, 516, 'ka',   true,  true,  true,  true,  true,  'KSFO', 1860, 'available'),
  ('N771PW', 'Pacific Wings Charter',      'heavy',    'Bombardier Challenger 605', 2018, 12, 4000, 459, 'ka',   true,  true,  true,  true,  true,  'KSFO', 2620, 'aog'),
  ('N109AM', 'Aspen Mountain Aviation',    'light',    'Citation CJ4',              2020, 7, 2165, 451, 'yes',   false, true,  false, true,  false, 'KASE',  920, 'available'),
  ('N210AM', 'Aspen Mountain Aviation',    'turboprop','Pilatus PC-12 NGX',         2022, 8, 1803, 290, 'yes',   false, false, false, true,  false, 'KASE',  610, 'available'),
  ('N418NE', 'Northeast Executive Air',    'midsize',  'Hawker 900XP',              2017, 8, 2930, 448, 'yes',   true,  true,  false, true,  false, 'KBED', 2880, 'available'),
  ('N628NE', 'Northeast Executive Air',    'light',    'Learjet 75 Liberty',        2018, 6, 2040, 464, 'yes',   false, true,  false, true,  false, 'KBED', 1990, 'available'),
  ('N512SB', 'Sunbelt Jet Holdings',       'midsize',  'Citation Sovereign',        2019, 9, 3000, 458, 'yes',   true,  true,  false, true,  false, 'KOPF', 1700, 'available'),
  ('N890TA', 'TransAtlantic Aviation',     'ulr',      'Bombardier Global 7500',    2022, 17, 7700, 516, 'ka',   true,  true,  true,  true,  true,  'KIAD', 1150, 'available'),
  ('N902TA', 'TransAtlantic Aviation',     'heavy',    'Dassault Falcon 8X',        2021, 14, 6450, 488, 'ka',   true,  true,  true,  true,  true,  'KIAD', 1840, 'available'),
  ('N306MW', 'Midwest Charter Group',      'supermid', 'Embraer Praetor 600',       2021, 8, 4018, 466, 'ka',   true,  true,  false, true,  false, 'KDAL', 1280, 'available'),
  ('N612MW', 'Midwest Charter Group',      'midsize',  'Cessna Citation Longitude', 2022, 9, 3500, 483, 'yes',   true,  true,  false, true,  false, 'KDAL',  920, 'maint'),
  ('N722SH', 'Sierra Charter Holdings',    'light',    'Phenom 300',                2019, 7, 1971, 453, 'yes',   false, true,  false, true,  false, 'KBFI', 2010, 'available')
) as v(tail, op_name, category, model, yr, seats, range_nm, speed_kt, wifi, standup, lav, lieflat, pet, fa, base, hrs, st)
join public.operators op on op.name = v.op_name;
