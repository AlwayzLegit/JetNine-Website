-- Emailed sign-in links, password resets and invites on the site's own mail (OPS-94).
--
-- One-time tokens the site keeps itself, so a link no longer depends on
-- Supabase Auth answering. Only the SHA-256 of the token is stored, never the
-- token. Each row is spent by one atomic UPDATE on a POST (see
-- src/lib/auth-tokens).
--
--   auth_tokens   purpose signin (15 min), reset (30 min), invite (7 days).
--
-- Also lets the site create a public.users row itself: the foreign key to
-- auth.users goes, and id gets a default. Additive for the live site: the
-- trigger on auth.users still inserts rows with its own id, and nothing that
-- reads public.users changes.
--
-- Server-only: RLS on with no policies, and no grants for the public roles
-- (the same as 0056).
--
-- Way back: drop table public.auth_tokens;
-- Only if no public.users row was made without an auth user, also:
--   alter table public.users alter column id drop default;
--   alter table public.users add constraint users_id_users_id_fk
--     foreign key (id) references auth.users(id) on delete cascade;
-- (the last statement fails if such a row exists, which is the safe answer).

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('signin', 'reset', 'invite')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists auth_tokens_user_purpose_idx on public.auth_tokens (user_id, purpose);
create index if not exists auth_tokens_expires_idx on public.auth_tokens (expires_at);

alter table public.auth_tokens enable row level security;
revoke all on public.auth_tokens from anon, authenticated;

alter table public.users drop constraint if exists users_id_users_id_fk;
alter table public.users alter column id set default gen_random_uuid();
