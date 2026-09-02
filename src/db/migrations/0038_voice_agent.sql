-- JetNine voice agent — call logs, transcripts, leads, messages.
--
-- Voice agent tables (voice/). Same Supabase project as the site, so they carry a voice_
-- prefix (public.messages already exists for the SMS/WhatsApp channel).
-- Service-role access only: RLS is enabled on every table with NO policies,
-- so anon and authenticated keys see nothing; the server's service-role key
-- bypasses RLS.

create type "public"."voice_call_outcome" as enum (
  'lead', 'message', 'escalated', 'abandoned', 'other'
);

create table "public"."voice_leads" (
  "id"         uuid primary key default gen_random_uuid() not null,
  "phone"      text not null,
  "name"       text,
  "email"      text,
  "source"     text default 'voice' not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);
create index "voice_leads_phone_idx" on public.voice_leads ("phone");

create table "public"."voice_calls" (
  "id"                uuid primary key default gen_random_uuid() not null,
  "call_sid"          text not null,
  "from_number"       text,
  "to_number"         text,
  "started_at"        timestamptz default now() not null,
  "ended_at"          timestamptz,
  "duration_seconds"  integer,
  "outcome"           "voice_call_outcome",
  "escalation_reason" text,
  "recording_sid"     text,
  "recording_url"     text,
  -- [{ role: 'user'|'assistant'|'system', text, at }]
  "transcript"        jsonb default '[]'::jsonb not null,
  "summary"           text,
  "lead_id"           uuid references public.voice_leads(id) on delete set null,
  "returning_caller"  boolean default false not null,
  "created_at"        timestamptz default now() not null,
  "updated_at"        timestamptz default now() not null
);
create unique index "voice_calls_call_sid_idx" on public.voice_calls ("call_sid");
create index "voice_calls_started_idx" on public.voice_calls ("started_at" desc);

create table "public"."voice_trip_requests" (
  "id"           uuid primary key default gen_random_uuid() not null,
  "lead_id"      uuid references public.voice_leads(id) on delete cascade not null,
  "call_id"      uuid references public.voice_calls(id) on delete set null,
  "origin"       text,
  "destination"  text,
  -- Kept as spoken ("next Friday morning") plus a best-effort ISO date.
  "depart_date"  text,
  "depart_date_iso" date,
  "return_date"  text,
  "return_date_iso" date,
  "trip_type"    text,           -- 'one_way' | 'round_trip'
  "pax"          integer,
  "urgency"      text,           -- 'within_48h' | 'this_week' | 'flexible' | free text
  "notes"        text,
  "status"       text default 'new' not null,
  "created_at"   timestamptz default now() not null,
  "updated_at"   timestamptz default now() not null
);
create index "voice_trip_requests_lead_idx" on public.voice_trip_requests ("lead_id");
create index "voice_trip_requests_status_idx" on public.voice_trip_requests ("status", "created_at" desc);

create table "public"."voice_messages" (
  "id"         uuid primary key default gen_random_uuid() not null,
  "call_id"    uuid references public.voice_calls(id) on delete set null,
  "name"       text,
  "company"    text,
  "reason"     text,
  "callback"   text,
  "created_at" timestamptz default now() not null
);

alter table public.voice_leads         enable row level security;
alter table public.voice_calls         enable row level security;
alter table public.voice_trip_requests enable row level security;
alter table public.voice_messages      enable row level security;
-- No policies on purpose: service role only.
