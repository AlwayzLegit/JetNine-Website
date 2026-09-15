-- Blog subscribers — double opt-in email capture for the daily blog,
-- plus the weekly digest cron's claim column.
--
-- Consent model mirrors empty-leg watchlists (migration 0040/0042): a row
-- is created 'pending' and stays silent until the confirm link is used;
-- the confirm token is stored only as a SHA-256 hash; the unsubscribe
-- token is plain text on purpose (it only ever stops mail, so a leaked
-- value cannot subscribe or spam anyone).

create type blog_subscriber_status as enum ('pending', 'confirmed', 'unsubscribed');

create table if not exists public.blog_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status blog_subscriber_status not null default 'pending',

  confirm_token_hash text,
  confirm_expires_at timestamptz,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,

  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at timestamptz,

  -- Weekly digest claim stamp: the cron claims rows by setting this before
  -- sending, so overlapping runs cannot double-send (same pattern as
  -- empty_leg_watchlist_matches / sla_alerted_at).
  last_digest_at timestamptz,

  source text not null default 'blog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists blog_subscribers_email_uq
  on public.blog_subscribers (lower(email));
create unique index if not exists blog_subscribers_unsub_token_uq
  on public.blog_subscribers (unsubscribe_token);
create index if not exists blog_subscribers_status_idx
  on public.blog_subscribers (status);

-- RLS: no anonymous access at all — every touch goes through server code
-- with the service connection. PostgREST never needs this table.
alter table public.blog_subscribers enable row level security;
