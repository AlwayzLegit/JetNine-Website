-- Made-up rows for the copy rehearsal (OPS-198). Nothing here is real: example.com addresses,
-- a bcrypt-shaped string that hashes nothing, fixed ids. Loaded after the migrations with every
-- trigger on, the way the live site writes. Every table the plan names has at least one row, so
-- the triggers (users from auth.users, codes on quotes, trips and invoices, updated_at), the
-- identity column of api_requests and the held-back tables are all exercised.

-- auth.users first: the trigger on_auth_user_created (0001) creates the public.users row.
insert into auth.users (id, email, encrypted_password, banned_until, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'member@example.com', '$2a$10$notarealhashnotarealhashnotarealhashnotarealhash00', null, '{"fixture": true}'),
  ('00000000-0000-4000-8000-000000000002', 'banned@example.com', '$2a$10$notarealhashnotarealhashnotarealhashnotarealhash11', '2099-01-01T00:00:00Z', '{"fixture": true}');

insert into public.user_credentials (user_id, password_hash)
values ('00000000-0000-4000-8000-000000000001', '$2a$10$notarealhashnotarealhashnotarealhashnotarealhash22');

insert into public.operators (id, name)
values ('00000000-0000-4000-8000-000000000010', 'Fixture Air Example');

insert into public.aircraft (id, operator_id, tail_number, category, make_model, seats, range_nm, speed_kt)
values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010', 'N000FX', 'midsize', 'Fixture 500', 8, 2500, 450);

insert into public.members (id, user_id, member_code)
values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', 'M-FIXTURE-0001');

insert into public.quotes (id, trip_type, pax_count)
values ('00000000-0000-4000-8000-000000000030', 'one_way', 4);

insert into public.quote_legs (id, quote_id, leg_number)
values ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000030', 1);

insert into public.trips (id, member_id, mission_type, pax_count)
values ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000020', 'one_way', 4);

insert into public.trip_legs (id, trip_id, leg_number)
values ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000040', 1);

insert into public.invoices (id, member_id)
values ('00000000-0000-4000-8000-000000000050', '00000000-0000-4000-8000-000000000020');

insert into public.blog_posts (id, slug, title, description, body_md)
values ('00000000-0000-4000-8000-000000000060', 'fixture-post', 'Fixture post', 'A made-up post for the rehearsal.', 'Made-up body.');

insert into public.api_keys (id, name, prefix, token_hash, last4, scopes)
values ('00000000-0000-4000-8000-000000000070', 'fixture key', 'jn_fixture', 'a-made-up-hash-not-a-real-one', '0000', array['read']);

-- api_requests.id is generated always as identity (0051): leave it to the database. key_id points
-- to a held-back table, so the copy writes it as null on staging (nullRefs).
insert into public.api_requests (key_id, method, route, status)
values ('00000000-0000-4000-8000-000000000070', 'GET', '/api/v1/fixture', 200),
       (null, 'POST', '/api/v1/fixture', 201);

insert into public.audit_log (action, subject_type)
values ('fixture.loaded', 'system');
