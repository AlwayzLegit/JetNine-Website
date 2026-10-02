-- Admin API foundation (API phase 1).
--
-- api_keys: keys minted and revoked from Settings › API keys. Only a
-- sha256 of the token is stored; the token itself is shown once. A key
-- acts as the staff user who created it, capped by its scopes, so a key
-- whose creator is demoted or removed loses access on its next request.
--
-- api_requests: one row per /api/v1 call for the key's activity view and
-- abuse investigation. Pruned after 30 days by the maintenance cron.
--
-- Both are server-only (the site connects as the postgres role); RLS is
-- on with no policies so a PostgREST caller sees nothing.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null unique,
  token_hash text not null unique,
  last4 text not null,
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array['read','content','desk','clients','money','settings','admin','agent']::text[]
  ),
  requires_approval boolean not null default true,
  rate_limit_per_min integer not null default 120 check (rate_limit_per_min between 1 and 2000),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip text,
  last_used_ua text,
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoke_reason text,
  -- The assistant's key always asks before anything client-facing.
  constraint api_keys_agent_supervised check (not ('agent' = any(scopes)) or requires_approval)
);

create index if not exists api_keys_created_by_idx on public.api_keys (created_by);

create table if not exists public.api_requests (
  id bigint generated always as identity primary key,
  key_id uuid references public.api_keys(id) on delete cascade,
  legacy boolean not null default false,
  method text not null,
  route text not null,
  status smallint not null,
  error_code text,
  duration_ms integer,
  ip text,
  ua text,
  run_id uuid,
  request_id text,
  at timestamptz not null default now()
);

create index if not exists api_requests_key_at_idx on public.api_requests (key_id, at desc);
create index if not exists api_requests_at_idx on public.api_requests (at);

alter table public.api_keys enable row level security;
alter table public.api_requests enable row level security;

-- Audit subjects for the API and the assistant. Added on their own: a new
-- enum value cannot be used in the same transaction that adds it.
alter type audit_subject_type add value if not exists 'api_key';
alter type audit_subject_type add value if not exists 'blog_post';
alter type audit_subject_type add value if not exists 'approval';
alter type audit_subject_type add value if not exists 'agent_run';
alter type audit_subject_type add value if not exists 'agent_playbook';
alter type audit_subject_type add value if not exists 'agent_memory';
