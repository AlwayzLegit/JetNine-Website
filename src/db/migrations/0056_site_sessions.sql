-- The site's own sign-in (OPS-91).
--
-- Sessions and passwords the site keeps itself, so signing in no longer
-- depends on Supabase Auth answering. Additive: nothing the live site
-- reads today changes when this runs.
--
--   user_sessions     one row per signed-in browser. Only the SHA-256 of
--                     the cookie's random token is stored, never the token.
--                     No IP and no user agent.
--   user_credentials  a password set after this change (bcrypt). It wins
--                     over the older hash in auth.users, which is read in
--                     place and never copied.
--
-- Server-only: RLS on with no policies, and no grants for the public roles.
-- Way back: drop table public.user_sessions, public.user_credentials;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists user_sessions_user_idx on public.user_sessions (user_id);
create index if not exists user_sessions_expires_idx on public.user_sessions (expires_at);

create table if not exists public.user_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;
alter table public.user_credentials enable row level security;

revoke all on public.user_sessions from anon, authenticated;
revoke all on public.user_credentials from anon, authenticated;
