-- AI provider keys and routing, managed from /admin/settings/ai.
--
-- api_key_enc is AES-256-GCM ciphertext (key: AI_KEYS_ENCRYPTION_KEY env
-- on Vercel and on the Render voice service), so a leaked database dump
-- does not leak the vendor keys. last4 is clear text for the admin screen.
-- ai_routes maps each AI surface ('voice_agent' today) to a primary and an
-- optional fallback provider; the voice service reads it at call start.

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('anthropic', 'openai')),
  label text not null,
  api_key_enc text not null,
  api_key_last4 text not null,
  default_model text not null,
  enabled boolean not null default true,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_routes (
  purpose text primary key check (purpose in ('voice_agent')),
  primary_provider_id uuid references public.ai_providers(id) on delete set null,
  fallback_provider_id uuid references public.ai_providers(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_routes (purpose) values ('voice_agent') on conflict do nothing;

-- Service connection only (site via Drizzle, voice desk via service role).
-- No policies on purpose: anon/authenticated PostgREST callers see nothing.
alter table public.ai_providers enable row level security;
alter table public.ai_routes enable row level security;

alter type audit_subject_type add value if not exists 'ai_provider';
