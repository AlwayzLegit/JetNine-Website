-- Why a watchlist is inactive.
--
-- Added with the inbound STOP handler. Without a reason, an inbound
-- START would have to either reactivate every inactive watchlist for
-- that number — including ones switched off deliberately — or do
-- nothing at all. Recording who switched it off lets START resume
-- exactly what STOP paused, and nothing else.

alter table public.empty_leg_watchlists
  add column "deactivated_at" timestamptz,
  add column "deactivated_reason" text;

-- The STOP/START handler looks watchlists up by number.
create index "empty_leg_watchlists_phone_idx"
  on public.empty_leg_watchlists ("phone_e164");
