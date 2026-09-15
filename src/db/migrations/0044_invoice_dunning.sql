-- Invoice dunning (cron /api/cron/invoice-watch): claim stamps so each
-- invoice gets at most one due-soon reminder and one overdue notice.
alter table public.invoices add column if not exists due_reminder_sent_at timestamptz;
alter table public.invoices add column if not exists overdue_notified_at timestamptz;

create index if not exists invoices_dunning_idx
  on public.invoices (due_on)
  where status in ('due', 'overdue');
