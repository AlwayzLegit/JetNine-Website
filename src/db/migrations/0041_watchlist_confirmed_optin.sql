-- Confirmed opt-in for empty-leg watchlists.
--
-- The public form takes a phone number and an optional email with no
-- proof the person filling it in controls either, so anyone could
-- subscribe a stranger to alerts. Watchlists are now created unconfirmed
-- and stay silent until the recipient proves control.
--
-- Confirmation is per channel on purpose: pairing your own phone with
-- someone else's inbox must not let you confirm their inbox. Tokens are
-- stored only as SHA-256 hashes, so the table never holds a value that
-- would let anyone opt in on another person's behalf.
--
-- `active` keeps its old meaning — not paused — and STOP still clears it.
-- Sending now requires both: active, and the channel confirmed.

alter table public.empty_leg_watchlists
  add column "sms_confirmed_at" timestamptz,
  add column "email_confirmed_at" timestamptz,
  add column "confirm_sms_token_hash" text,
  add column "confirm_email_token_hash" text,
  add column "confirm_sent_at" timestamptz,
  add column "confirm_expires_at" timestamptz;

-- Partial unique: the hash is the lookup key while a confirmation is
-- outstanding, and is cleared once used so it cannot be replayed.
create unique index "empty_leg_watchlists_confirm_sms_uq"
  on public.empty_leg_watchlists ("confirm_sms_token_hash")
  where "confirm_sms_token_hash" is not null;

create unique index "empty_leg_watchlists_confirm_email_uq"
  on public.empty_leg_watchlists ("confirm_email_token_hash")
  where "confirm_email_token_hash" is not null;
