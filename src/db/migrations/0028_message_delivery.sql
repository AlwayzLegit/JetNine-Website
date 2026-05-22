-- Delivery-status tracking on the polymorphic messages table.
--
-- Before this migration, channel='email' on quote / trip threads only
-- INSERT-ed into the table — the message was never actually sent. This
-- adds enough columns for the email lib (and Twilio later) to record
-- the outcome so dispatchers can see at a glance whether their note
-- left the building.
--
-- delivery_status semantics:
--   queued    — row inserted, transmission not yet attempted
--   sent      — provider returned 2xx; messageId stamped
--   failed    — provider returned non-2xx or threw; error stamped
--   skipped   — channel intentionally not transmitted (inapp / call /
--               voicemail; or email without a to_address)

create type public.message_delivery_status as enum (
  'queued', 'sent', 'failed', 'skipped'
);

alter table public.messages
  add column if not exists delivery_status     public.message_delivery_status not null default 'skipped',
  add column if not exists delivery_provider   text,
  add column if not exists delivery_message_id text,
  add column if not exists delivery_error      text,
  add column if not exists delivered_at        timestamptz;

create index if not exists messages_delivery_status_idx
  on public.messages (delivery_status, occurred_at desc);
