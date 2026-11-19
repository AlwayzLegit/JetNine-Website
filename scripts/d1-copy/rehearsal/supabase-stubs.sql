-- The smallest stand-ins for what Supabase gives a project, so the repo's 58 Postgres
-- migrations (src/db/migrations) replay on a plain throwaway Postgres in CI (OPS-198).
-- Nothing here is a copy of Supabase's real objects: each one only has to exist.
-- Applied by apply.mjs, which refuses any host but localhost. Never run this on Supabase.

-- Roles that migrations grant to or revoke from: "to authenticated" (0001 onward),
-- "to anon" / "from anon" (0006, 0020, 0049 and others), "to supabase_auth_admin" (0022),
-- "authorization postgres" (0025: the role is the owner of schema jn_internal; a Supabase
-- project has it, the CI database's own user is another name), service_role for completeness.
-- NOLOGIN: nothing connects as them.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'supabase_auth_admin', 'postgres'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end
$$;

-- Schema auth and table auth.users: 0000 points a foreign key at it, 0001 puts the trigger
-- on_auth_user_created on it, 0022, 0056 and 0057 name it, and src/lib/identity-store/store-pg.ts
-- reads email, encrypted_password and banned_until from it. 0057 drops the foreign key again.
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  encrypted_password text,
  banned_until       timestamptz,
  raw_user_meta_data jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- auth.uid() is called by 90 row level security policies and helpers (0001 onward).
-- With no session it is null, as on Supabase with no signed-in user.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select null::uuid $$;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select null::jsonb $$;

-- Schema storage and storage.buckets: 0037 inserts the public bucket "blog".
create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean default false
);

-- pgcrypto: 0042 defaults a column to encode(gen_random_bytes(24), 'hex'). Supabase installs
-- the extension in its "extensions" schema, which is on every role's search_path; a plain
-- Postgres has it in public. The postgres:15 image ships it (contrib).
create extension if not exists pgcrypto;
