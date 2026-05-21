-- Phase B.2 (airports/fbos) — RLS + seed from src/lib/airports.ts.
--
-- RLS:
-- - airports + fbos are reference data; readable by any authenticated user.
-- - Only admins write. The catalog grows via ops curation, never via the
--   anon submit path.
-- updated_at triggers wired so the audit "what changed when" question is
-- answerable from the row itself.

create trigger airports_set_updated_at
  before update on public.airports
  for each row execute function public.set_updated_at();

create trigger fbos_set_updated_at
  before update on public.fbos
  for each row execute function public.set_updated_at();

alter table public.airports enable row level security;
alter table public.fbos enable row level security;

create policy "airports_select_authenticated" on public.airports
  for select to authenticated using (true);

create policy "airports_admin_write" on public.airports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "fbos_select_authenticated" on public.fbos
  for select to authenticated using (true);

create policy "fbos_admin_write" on public.fbos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Seed: 43 airports from the original src/lib/airports.ts catalog ────────
-- ICAO is the source of truth; IATA stays where it's real and is NULL
-- otherwise. tz upgraded to IANA tz strings; the lib's shortcodes (PT, MT,
-- CT, ET, ...) work fine for display but the DB carries the canonical name.
-- Idempotent — re-runs do nothing thanks to ON CONFLICT (icao) DO NOTHING.

insert into public.airports
  (icao, iata, name, city, region, country_iso2, lat, lon, tz, category, customs)
values
  -- North America · West
  ('KVNY', 'VNY', 'Van Nuys',                'Los Angeles',      'CA', 'US', 34.21000, -118.49000, 'America/Los_Angeles', 'private',  'none'),
  ('KLAX', 'LAX', 'Los Angeles Intl.',       'Los Angeles',      'CA', 'US', 33.94000, -118.41000, 'America/Los_Angeles', 'intl',     'intl'),
  ('KBUR', 'BUR', 'Hollywood Burbank',       'Burbank',          'CA', 'US', 34.20000, -118.36000, 'America/Los_Angeles', 'private',  'none'),
  ('KPSP', 'PSP', 'Palm Springs',            'Palm Springs',     'CA', 'US', 33.83000, -116.51000, 'America/Los_Angeles', 'regional', 'user_fee'),
  ('KSFO', 'SFO', 'San Francisco Intl.',     'San Francisco',    'CA', 'US', 37.62000, -122.38000, 'America/Los_Angeles', 'intl',     'intl'),
  ('KOAK', 'OAK', 'Oakland Intl.',           'Oakland',          'CA', 'US', 37.72000, -122.22000, 'America/Los_Angeles', 'regional', 'user_fee'),
  ('KBFI', 'BFI', 'Boeing Field',            'Seattle',          'WA', 'US', 47.53000, -122.30000, 'America/Los_Angeles', 'private',  'user_fee'),
  ('KSEA', 'SEA', 'Seattle-Tacoma Intl.',    'Seattle',          'WA', 'US', 47.45000, -122.31000, 'America/Los_Angeles', 'intl',     'intl'),
  ('KLAS', 'LAS', 'Harry Reid Intl.',        'Las Vegas',        'NV', 'US', 36.08000, -115.15000, 'America/Los_Angeles', 'intl',     'intl'),
  ('KHND', 'HSH', 'Henderson Exec.',         'Las Vegas',        'NV', 'US', 35.97000, -115.13000, 'America/Los_Angeles', 'private',  'none'),
  ('KSDL', 'SDL', 'Scottsdale',              'Scottsdale',       'AZ', 'US', 33.62000, -111.91000, 'America/Phoenix',     'private',  'user_fee'),
  ('KASE', 'ASE', 'Aspen-Pitkin',            'Aspen',            'CO', 'US', 39.22000, -106.87000, 'America/Denver',      'regional', 'user_fee'),
  ('KJAC', 'JAC', 'Jackson Hole',            'Jackson Hole',     'WY', 'US', 43.61000, -110.74000, 'America/Denver',      'regional', 'user_fee'),

  -- North America · Central & South
  ('KDAL', 'DAL', 'Dallas Love',             'Dallas',           'TX', 'US', 32.85000, -96.85000,  'America/Chicago',     'private',  'user_fee'),
  ('KDFW', 'DFW', 'Dallas-Fort Worth Intl.', 'Dallas',           'TX', 'US', 32.90000, -97.04000,  'America/Chicago',     'intl',     'intl'),
  ('KHOU', 'HOU', 'Hobby',                   'Houston',          'TX', 'US', 29.65000, -95.28000,  'America/Chicago',     'regional', 'user_fee'),
  ('KBHM', 'BHM', 'Birmingham-Shuttlesworth', 'Birmingham',      'AL', 'US', 33.56000, -86.75000,  'America/Chicago',     'regional', 'user_fee'),

  -- North America · East
  ('KTEB', 'TEB', 'Teterboro',               'New York',         'NJ', 'US', 40.85000, -74.06000,  'America/New_York',    'private',  'user_fee'),
  ('KJFK', 'JFK', 'John F. Kennedy Intl.',   'New York',         'NY', 'US', 40.64000, -73.78000,  'America/New_York',    'intl',     'intl'),
  ('KLGA', 'LGA', 'LaGuardia',               'New York',         'NY', 'US', 40.78000, -73.87000,  'America/New_York',    'regional', 'user_fee'),
  ('KEWR', 'EWR', 'Newark Liberty',          'Newark',           'NJ', 'US', 40.69000, -74.17000,  'America/New_York',    'intl',     'intl'),
  ('KMVY', 'MVY', 'Martha''s Vineyard',      'Martha''s Vineyard', 'MA', 'US', 41.39000, -70.61000, 'America/New_York',  'regional', 'none'),
  ('KBED', 'BED', 'Hanscom Field',           'Boston',           'MA', 'US', 42.47000, -71.29000,  'America/New_York',    'private',  'user_fee'),
  ('KBOS', 'BOS', 'Logan Intl.',             'Boston',           'MA', 'US', 42.36000, -71.01000,  'America/New_York',    'intl',     'intl'),
  ('KIAD', 'IAD', 'Dulles Intl.',            'Washington',       'VA', 'US', 38.94000, -77.46000,  'America/New_York',    'intl',     'intl'),
  ('KDCA', 'DCA', 'Ronald Reagan National',  'Washington',       'DC', 'US', 38.85000, -77.04000,  'America/New_York',    'regional', 'none'),
  ('KMIA', 'MIA', 'Miami Intl.',             'Miami',            'FL', 'US', 25.79000, -80.29000,  'America/New_York',    'intl',     'intl'),
  ('KOPF', 'OPF', 'Opa-Locka Exec.',         'Miami',            'FL', 'US', 25.91000, -80.28000,  'America/New_York',    'private',  'user_fee'),
  ('KPBI', 'PBI', 'Palm Beach Intl.',        'Palm Beach',       'FL', 'US', 26.68000, -80.10000,  'America/New_York',    'regional', 'user_fee'),

  -- Canada / LATAM
  ('CYYZ', 'YYZ', 'Toronto Pearson',         'Toronto',          'ON', 'CA', 43.68000, -79.63000,  'America/Toronto',     'intl',     'intl'),
  ('SBGL', 'GIG', 'Rio Galeão',              'Rio de Janeiro',   'RJ', 'BR', -22.81000, -43.25000, 'America/Sao_Paulo',   'intl',     'intl'),

  -- Europe
  ('EGGW', 'LTN', 'Luton',                   'London',           NULL, 'GB', 51.87000, -0.37000,   'Europe/London',       'intl',     'intl'),
  ('EGLF', 'FAB', 'Farnborough',             'Farnborough',      NULL, 'GB', 51.27000, -0.78000,   'Europe/London',       'private',  'intl'),
  ('EGLL', 'LHR', 'Heathrow',                'London',           NULL, 'GB', 51.47000, -0.46000,   'Europe/London',       'intl',     'intl'),
  ('LFPB', 'LBG', 'Le Bourget',              'Paris',            NULL, 'FR', 48.97000, 2.44000,    'Europe/Paris',        'private',  'intl'),
  ('LFPG', 'CDG', 'Charles de Gaulle',       'Paris',            NULL, 'FR', 49.01000, 2.55000,    'Europe/Paris',        'intl',     'intl'),
  ('LSGG', 'GVA', 'Geneva',                  'Geneva',           NULL, 'CH', 46.24000, 6.11000,    'Europe/Zurich',       'intl',     'intl'),
  ('LSZH', 'ZRH', 'Zurich',                  'Zurich',           NULL, 'CH', 47.46000, 8.55000,    'Europe/Zurich',       'intl',     'intl'),

  -- Middle East / Asia / Oceania
  ('OMDB', 'DXB', 'Dubai Intl.',             'Dubai',            NULL, 'AE', 25.25000, 55.36000,   'Asia/Dubai',          'intl',     'intl'),
  ('RJTT', 'HND', 'Haneda',                  'Tokyo',            NULL, 'JP', 35.55000, 139.78000,  'Asia/Tokyo',          'intl',     'intl'),
  ('VHHH', 'HKG', 'Hong Kong Intl.',         'Hong Kong',        NULL, 'HK', 22.31000, 113.92000,  'Asia/Hong_Kong',      'intl',     'intl'),
  ('WSSS', 'SIN', 'Changi',                  'Singapore',        NULL, 'SG', 1.36000,  103.99000,  'Asia/Singapore',      'intl',     'intl'),
  ('YSSY', 'SYD', 'Kingsford Smith',         'Sydney',           NULL, 'AU', -33.95000, 151.18000, 'Australia/Sydney',    'intl',     'intl')
on conflict (icao) do nothing;
