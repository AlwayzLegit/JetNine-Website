-- Desk assistant (API phase 4).
--
-- agent_playbooks: the assistant's instructions, versioned. The current
--   version is the highest. `jobs` is a list of
--   {slug, name, enabled, cadence, instructions_md}.
-- agent_runs: one row per scheduled run (open → closed | failed), with the
--   structured report the assistant writes when it closes the run.
-- agent_run_items: what a run produced — a published post, a flag on a
--   request or trip, a draft, a note, an insight, a proposal.
-- agent_memory: short facts, lessons, preferences and to-dos the assistant
--   (or the owner) keeps between runs. Pinned items always load.
--
-- Server-only tables (the site connects as the postgres role); RLS is on
-- with no policies so a PostgREST caller sees nothing.

create table if not exists public.agent_playbooks (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version >= 1),
  general_md text not null,
  jobs jsonb not null default '[]'::jsonb,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null default 'open' check (status in ('open','closed','failed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  key_id uuid references public.api_keys(id) on delete set null,
  playbook_version integer not null default 0,
  summary_md text,
  report jsonb,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_date_idx on public.agent_runs (run_date desc, started_at desc);
-- One open run per key at a time.
create unique index if not exists agent_runs_one_open_per_key
  on public.agent_runs (key_id) where status = 'open' and key_id is not null;

create table if not exists public.agent_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  kind text not null check (kind in ('post','flag','draft','note','insight','proposal')),
  subject_type text,
  subject_id uuid,
  subject_code text,
  title text not null check (char_length(title) between 1 and 200),
  body_md text check (body_md is null or char_length(body_md) <= 8000),
  url text check (url is null or char_length(url) <= 600),
  status text not null default 'open' check (status in ('open','dismissed','done')),
  dismissed_by uuid references public.users(id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_run_items_run_idx on public.agent_run_items (run_id);
create index if not exists agent_run_items_open_subject_idx
  on public.agent_run_items (subject_type, subject_id) where status = 'open';

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fact','lesson','preference','todo')),
  body text not null check (char_length(body) between 1 and 600),
  pinned boolean not null default false,
  author text not null check (author in ('agent','owner')),
  source_run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_memory_active_idx on public.agent_memory (pinned desc, updated_at desc) where archived_at is null;

alter table public.agent_playbooks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_run_items enable row level security;
alter table public.agent_memory enable row level security;
