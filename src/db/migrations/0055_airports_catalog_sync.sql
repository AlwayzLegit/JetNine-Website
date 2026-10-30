-- The quote wizard's picker (src/lib/airports.ts) grew to 67 airports after
-- the 43-airport seed in 0020, but quote_legs.*_icao FK airports.icao
-- (0026): a quote to any of the 24 unseeded airports failed with
-- quote_legs_to_icao_fk and the customer saw "Not sent". Seen live on
-- 2026-10-30 (VNY → Austin Executive, eight attempts).
--
-- Seeds the missing 24 in the 0020 format. Idempotent. submitQuote now
-- also inserts any catalog airport it needs (ON CONFLICT DO NOTHING), and
-- scripts/check-api.mts fails when the picker and the seeds drift again.

insert into public.airports
  (icao, iata, name, city, region, country_iso2, lat, lon, tz, category, customs)
values
  -- North America · West
  ('KSAN', 'SAN', 'San Diego Intl.',                 'San Diego',        'CA',  'US', 32.73000, -117.19000, 'America/Los_Angeles', 'intl',     'intl'),
  ('KCRQ', 'CRQ', 'McClellan-Palomar',               'Carlsbad',         'CA',  'US', 33.13000, -117.28000, 'America/Los_Angeles', 'private',  'user_fee'),
  ('KAPA', 'APA', 'Centennial',                      'Denver',           'CO',  'US', 39.57000, -104.85000, 'America/Denver',      'private',  'user_fee'),
  ('KDEN', 'DEN', 'Denver Intl.',                    'Denver',           'CO',  'US', 39.86000, -104.67000, 'America/Denver',      'intl',     'intl'),

  -- North America · Central & South
  ('KMDW', 'MDW', 'Chicago Midway',                  'Chicago',          'IL',  'US', 41.79000, -87.75000,  'America/Chicago',     'regional', 'user_fee'),
  ('KAUS', 'AUS', 'Austin-Bergstrom Intl.',          'Austin',           'TX',  'US', 30.19000, -97.67000,  'America/Chicago',     'intl',     'intl'),
  ('KEDC', 'EDC', 'Austin Executive',                'Austin',           'TX',  'US', 30.40000, -97.57000,  'America/Chicago',     'private',  'none'),
  ('KSAT', 'SAT', 'San Antonio Intl.',               'San Antonio',      'TX',  'US', 29.53000, -98.47000,  'America/Chicago',     'intl',     'intl'),
  ('KSSF', 'SSF', 'Stinson Municipal',               'San Antonio',      'TX',  'US', 29.34000, -98.47000,  'America/Chicago',     'private',  'none'),
  ('KBNA', 'BNA', 'Nashville Intl.',                 'Nashville',        'TN',  'US', 36.12000, -86.68000,  'America/Chicago',     'intl',     'intl'),
  ('KJWN', 'JWN', 'John C. Tune',                    'Nashville',        'TN',  'US', 36.18000, -86.89000,  'America/Chicago',     'private',  'none'),
  ('KFCM', 'FCM', 'Flying Cloud',                    'Minneapolis',      'MN',  'US', 44.83000, -93.46000,  'America/Chicago',     'private',  'none'),
  ('KMSP', 'MSP', 'Minneapolis-St. Paul Intl.',      'Minneapolis',      'MN',  'US', 44.88000, -93.22000,  'America/Chicago',     'intl',     'intl'),
  ('KPDK', 'PDK', 'DeKalb-Peachtree',                'Atlanta',          'GA',  'US', 33.88000, -84.30000,  'America/New_York',    'private',  'user_fee'),
  ('KFTY', 'FTY', 'Fulton County Exec.',             'Atlanta',          'GA',  'US', 33.78000, -84.52000,  'America/New_York',    'private',  'none'),

  -- North America · East
  ('KJAX', 'JAX', 'Jacksonville Intl.',              'Jacksonville',     'FL',  'US', 30.49000, -81.69000,  'America/New_York',    'intl',     'intl'),
  ('KFXE', 'FXE', 'Fort Lauderdale Exec.',           'Fort Lauderdale',  'FL',  'US', 26.20000, -80.17000,  'America/New_York',    'private',  'user_fee'),
  ('KFLL', 'FLL', 'Fort Lauderdale-Hollywood Intl.', 'Fort Lauderdale',  'FL',  'US', 26.07000, -80.15000,  'America/New_York',    'intl',     'intl'),
  ('KAPF', 'APF', 'Naples',                          'Naples',           'FL',  'US', 26.15000, -81.78000,  'America/New_York',    'private',  'none'),
  ('KORL', 'ORL', 'Orlando Executive',               'Orlando',          'FL',  'US', 28.55000, -81.33000,  'America/New_York',    'private',  'user_fee'),
  ('KMCO', 'MCO', 'Orlando Intl.',                   'Orlando',          'FL',  'US', 28.43000, -81.31000,  'America/New_York',    'intl',     'intl'),
  ('KTPA', 'TPA', 'Tampa Intl.',                     'Tampa',            'FL',  'US', 27.98000, -82.53000,  'America/New_York',    'intl',     'intl'),
  ('KTPF', 'TPF', 'Peter O. Knight',                 'Tampa',            'FL',  'US', 27.92000, -82.45000,  'America/New_York',    'private',  'none'),

  -- Caribbean / LATAM
  ('MYNN', 'NAS', 'Lynden Pindling Intl.',           'Nassau',           NULL,  'BS', 25.04000, -77.47000,  'America/Nassau',      'intl',     'intl'),
  ('MMSD', 'SJD', 'Los Cabos Intl.',                 'Los Cabos',        'BCS', 'MX', 23.15000, -109.72000, 'America/Mazatlan',    'intl',     'intl')
on conflict (icao) do nothing;
