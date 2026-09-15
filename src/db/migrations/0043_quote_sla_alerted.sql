-- SLA-watch cron: stamp when a breach alert has been sent for a quote so
-- each breach pages dispatch exactly once. Partial index keeps the cron's
-- scan cheap (open, breached, not-yet-alerted rows only).
alter table public.quotes add column if not exists sla_alerted_at timestamptz;

create index if not exists quotes_sla_unalerted_idx
  on public.quotes (sla_deadline_at)
  where sla_alerted_at is null and status in ('submitted', 'triaged', 'sourcing');
