-- Voice agents (Settings › Voice agent › Agents).
--
-- voice_agents: one row per agent. `config` is the agent's settings in
--   layers (profile, voice, speech, llm, instructions, calls); see
--   src/lib/voice-agent-config.ts. Exactly one agent is live at a time
--   (partial unique index); the voice service on Render answers with it.
--   With no live agent the voice service uses its built-in defaults.
-- voice_agent_versions: every save, so a change can be read back and
--   restored.
--
-- Read by the site (Drizzle, postgres role) and by the voice service
-- (Supabase service role), so RLS is on with no policies, like voice_*.

create table if not exists public.voice_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text,
  config jsonb not null,
  version integer not null default 1 check (version >= 1),
  is_live boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (is_live and archived_at is not null))
);

create unique index if not exists voice_agents_one_live_idx on public.voice_agents (is_live) where is_live;

create table if not exists public.voice_agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.voice_agents(id) on delete cascade,
  version integer not null check (version >= 1),
  config jsonb not null,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);

alter table public.voice_agents enable row level security;
alter table public.voice_agent_versions enable row level security;
