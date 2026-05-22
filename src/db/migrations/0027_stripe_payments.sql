-- Payments via Stripe Checkout.
--
-- (1) Add Stripe linkage columns to invoices so the webhook handler can
--     find the right row to mark paid on `checkout.session.completed`.
-- (2) Add a `stripe_webhook_events` table — idempotency log keyed on the
--     Stripe event id so retries (network glitches, replay attacks)
--     can't double-process a payment.

alter table public.invoices
  add column if not exists stripe_payment_intent_id   text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_at                    timestamptz;

create unique index if not exists invoices_stripe_payment_intent_uq
  on public.invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists invoices_stripe_checkout_session_uq
  on public.invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table if not exists public.stripe_webhook_events (
  -- Stripe event id (evt_...). PK gives us idempotency for free.
  id text primary key,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (type, received_at);

-- Server-only table — nobody connects as anon/authenticated to read or
-- write here. RLS on with no policies blocks both PostgREST paths.
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
