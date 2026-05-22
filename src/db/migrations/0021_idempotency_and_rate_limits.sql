-- Production hardening:
--   1. Quote idempotency — dedupe retries when a Server Action fails after the
--      DB insert but before the response reaches the client.
--   2. Rate limits — Postgres-backed sliding window for anonymous endpoints
--      (chiefly /quote submission) so a bot can't spam dispatch alerts.

-- ── 1. Idempotency key on quotes ───────────────────────────────────────────

alter table public.quotes
  add column if not exists client_idempotency_key text;

-- Partial unique index — only enforced when a key is present, so legacy
-- quotes (and any path that doesn't set a key) remain insertable.
create unique index if not exists quotes_client_idempotency_key_uq
  on public.quotes (client_idempotency_key)
  where client_idempotency_key is not null;

-- ── 2. Rate-limit counters ─────────────────────────────────────────────────

create table if not exists public.request_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists request_rate_limits_window_idx
  on public.request_rate_limits (window_start);

-- RLS: no anon/authenticated access. The server connects as the postgres
-- role (bypasses RLS), so the rate-limiter library can read/write without
-- needing an explicit policy. Anyone connecting via PostgREST is blocked.
alter table public.request_rate_limits enable row level security;

revoke all on public.request_rate_limits from anon, authenticated;
