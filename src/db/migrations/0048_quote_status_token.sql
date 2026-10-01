-- Guest status link for quote requests: /request/<status_token>.
--
-- Set by the submit action for new rows; this backfills every existing
-- quote so older acknowledgment threads can be given a link by hand.
-- 24 random bytes as hex (48 chars). Stored in clear text like the
-- watchlist unsubscribe token (0042): every later email (options sent,
-- booked) writes the link again, so it has to be readable at send time.

alter table public.quotes
  add column if not exists status_token text;

update public.quotes
  set status_token = encode(gen_random_bytes(24), 'hex')
  where status_token is null;

create unique index if not exists quotes_status_token_uq
  on public.quotes (status_token);
