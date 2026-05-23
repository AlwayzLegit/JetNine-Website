-- Stripe linkage on memberships so the webhook can stamp the deposit
-- payment back onto the row that created the Checkout session.
--
-- Same shape we used on invoices in 0027. Partial unique indexes
-- prevent two memberships from claiming the same Stripe object.

alter table public.memberships
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id   text,
  add column if not exists activated_at               timestamptz;

create unique index if not exists memberships_stripe_session_uq
  on public.memberships (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists memberships_stripe_pi_uq
  on public.memberships (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
