-- Empty-leg watchlist match ledger.
--
-- One row per (watchlist, leg, channel) the matcher has acted on. The
-- unique index is the whole point: the cron claims a row before it sends,
-- so a retry, an overlapping run, or a redeploy mid-flight can never text
-- the same person about the same leg twice.
--
-- Writes only ever come from the cron route on the direct connection
-- (table owner), never through PostgREST, so there are no anon or
-- authenticated write policies. Reads are staff-only: the rows carry no
-- content of their own, just delivery state.

create table "public"."empty_leg_watchlist_matches" (
  "id" uuid primary key default gen_random_uuid() not null,
  "watchlist_id" uuid not null
    references public.empty_leg_watchlists ("id") on delete cascade,
  "leg_id" uuid not null
    references public.empty_legs ("id") on delete cascade,
  -- 'sms' | 'email'
  "channel" text not null,
  -- 'pending' while the send is in flight, then 'sent' or 'failed'
  "status" text not null default 'pending',
  "provider" text,
  "provider_message_id" text,
  "error" text,
  "created_at" timestamptz default now() not null,
  "sent_at" timestamptz
);

-- The dedup guarantee.
create unique index "empty_leg_watchlist_matches_uq"
  on public.empty_leg_watchlist_matches ("watchlist_id", "leg_id", "channel");

-- Sweeping every match for a leg (e.g. when it sells) without scanning.
create index "empty_leg_watchlist_matches_leg_idx"
  on public.empty_leg_watchlist_matches ("leg_id");

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.empty_leg_watchlist_matches enable row level security;

create policy "empty_leg_watchlist_matches_staff_select"
  on public.empty_leg_watchlist_matches
  for select to authenticated
  using (public.is_staff());
