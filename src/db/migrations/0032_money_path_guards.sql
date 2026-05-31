-- Money-path safety: DB-enforced guards against the race conditions and
-- double-spend paths surfaced by the pre-launch /code-review + /security-review
-- pass. These are belt-and-suspenders with the application-level locks added
-- in the same change — the unique indexes are the ultimate source of truth.

-- 1. One trip per quote. Prevents the convertQuoteToTrip double-click race
--    (dispatcher click + parallel click both pass the application's "already
--    converted?" check, both insert a trip+invoice+draw). With this index,
--    the second INSERT 23505-errors and the action returns "already converted".
create unique index if not exists trips_quote_id_uniq
  on public.trips (quote_id)
  where quote_id is not null;

-- 2. One refund per charter_draw (keyed by trip+invoice). Prevents the
--    updateTripStatus double-cancel race AND the cancel→confirm→cancel cycle
--    that would each post a second +$X refund row against the same draw.
--    `invoice_id` is nullable on the table but always set when there's a
--    charter_draw to refund (drawdowns always link to an invoice), so the
--    partial index covers every real case.
create unique index if not exists reserve_tx_refund_per_draw_uniq
  on public.reserve_transactions (trip_id, invoice_id)
  where kind = 'refund' and trip_id is not null and invoice_id is not null;

-- 3. One active membership per member. Prevents the buyMembership TOCTOU
--    that lets a user double-click "Buy" and end up with two paused rows
--    that both successfully activate (two deposits credited for one user
--    who thinks they bought one Card).
create unique index if not exists memberships_active_per_member_uniq
  on public.memberships (member_id)
  where status = 'active';

-- 4. One soft hold per (aircraft, quote). createSoftHold already does an
--    application-level dup check but it's TOCTOU — two dispatchers can
--    both pass the check and both insert. With this index the second one
--    bounces, matching the contract the comment in the action claims.
create unique index if not exists schedule_blocks_hold_per_quote_aircraft_uniq
  on public.aircraft_schedule_blocks (aircraft_id, related_quote_id)
  where kind = 'hold' and related_quote_id is not null;

-- 5. One top-up per Stripe payment_intent. The webhook event-id dedup in
--    stripe_webhook_events only protects re-deliveries of the same event id.
--    A "Resend event" from the Stripe Dashboard, or a future expansion of
--    the webhook switch to also handle payment_intent.succeeded, would
--    deliver the same intent under a new event id and double-credit the
--    member's balance. The new stripe_payment_intent_id column gets stamped
--    by the webhook handler and the partial unique index prevents the
--    second row from being inserted.
alter table public.reserve_transactions
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists reserve_tx_top_up_per_intent_uniq
  on public.reserve_transactions (stripe_payment_intent_id)
  where kind = 'top_up' and stripe_payment_intent_id is not null;
