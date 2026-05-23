-- Inbound-email idempotency.
--
-- The /api/email/inbound webhook is called by Postmark (or Resend) when
-- a customer replies to one of our thread emails. Postmark retries on
-- timeout; without an idempotency guard, the same reply would land in
-- the thread N times.
--
-- We dedupe on the provider's MessageID, stamped in delivery_message_id.
-- Partial index because that column is also used for OUTBOUND messages,
-- where uniqueness isn't an invariant we want to enforce (an outbound
-- message id collision would just mean Stripe-style two writes from the
-- same provider, very unlikely but not worth blocking).

create unique index if not exists messages_inbound_provider_id_uq
  on public.messages (delivery_message_id)
  where direction = 'in' and delivery_message_id is not null;
