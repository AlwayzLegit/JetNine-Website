-- Approval queue (API phase 5).
--
-- When a key that "asks before acting" calls an operation that would
-- contact a client, move money or change settings, the operation is not
-- run: its validated input is stored here with a plain-words summary and
-- the exact preview of what would be sent or changed. A person approves
-- (optionally editing the whitelisted text fields), rejects with a note,
-- or lets it expire after 7 days. Approving claims the row atomically
-- (pending → executing) so nothing is sent twice.
--
-- Server-only; RLS on with no policies.

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  op text not null,
  payload jsonb not null,
  edited_payload jsonb,
  summary text not null check (char_length(summary) between 1 and 300),
  preview text,
  reason text check (reason is null or char_length(reason) <= 2000),
  risk text not null check (risk in ('client','money','settings','access','content')),
  subject_type text,
  subject_id uuid,
  subject_code text,
  status text not null default 'pending'
    check (status in ('pending','executing','executed','failed','rejected','expired')),
  dedupe_key text not null,
  requested_by_key uuid references public.api_keys(id) on delete set null,
  requested_by_user uuid references public.users(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  result jsonb,
  error text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists approvals_status_created_idx on public.approvals (status, created_at desc);
create index if not exists approvals_pending_subject_idx
  on public.approvals (subject_type, subject_id) where status = 'pending';
create unique index if not exists approvals_pending_dedupe_uq
  on public.approvals (dedupe_key) where status = 'pending';
create index if not exists approvals_key_created_idx on public.approvals (requested_by_key, created_at desc);

alter table public.approvals enable row level security;
