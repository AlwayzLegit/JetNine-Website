-- Guest quotes must not be listable with the public anon key.
--
-- 0003 gave `anon` a SELECT policy on unlinked wizard quotes so the submit
-- path could read back its insert. The submit Server Action has written
-- through the pooled DATABASE_URL connection for a long time, and no
-- client code reads quotes with the anon key, so the policy only exposed
-- every guest quote (contact snapshot included) — and, since 0048, the
-- status_token bearer link — to anyone with the publishable key.
--
-- Neutralise both policies, revoke the table grants as a belt and braces,
-- and rotate every token so nothing that could have been listed stays
-- valid. The customer link only goes out from the phase-3 build, which
-- deploys after this, so no live link breaks.
--
-- Applied to production by hand on 2026-10-01 (the policies are kept with
-- `using (false)` rather than dropped; the effect is identical and the
-- statement below is idempotent either way).

alter policy "quotes_anon_select_own" on public.quotes using (false);
alter policy "quote_legs_anon_select_own" on public.quote_legs using (false);

revoke select on public.quotes from anon;
revoke select on public.quote_legs from anon;

update public.quotes
  set status_token = encode(gen_random_bytes(24), 'hex');
