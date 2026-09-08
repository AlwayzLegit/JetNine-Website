# Empty-leg watchlist alerts

What the board promises, and the machinery that now keeps the promise.

## The promise

`/empty-legs` tells visitors two things about watchlists: **1 SMS per
match**, and that we *"match it against the live board every fifteen
minutes and text you the moment a leg fits"*. Both are now true. A third
claim on the same page — *"updated every fifteen minutes from operator
dispatch"* — is about how legs arrive on the board and is **still not
true**: there is no operator feed, and legs only exist when someone
creates them in the admin.

## How it runs

A Vercel cron hits `/api/cron/empty-leg-watchlists` every fifteen minutes
(`vercel.json`). The route loads live legs and active watchlists, decides
matches, sends, and records what it sent.

| Piece | Where |
| --- | --- |
| Matching rules (pure, no I/O) | `src/lib/watchlist-matching.ts` |
| Job plumbing | `src/app/api/cron/empty-leg-watchlists/route.ts` |
| Delivery ledger | `empty_leg_watchlist_matches` (migration 0039) |
| Rule checks | `pnpm check:watchlist` |

## What counts as a match

All of these must hold:

- The watchlist is active and has a channel it can actually reach: a
  phone for SMS, an address for email.
- The leg is `live` and has not departed.
- **Route.** An ICAO on the watchlist is compared strictly. Free text is
  compared against the leg's ICAO, IATA, city and airport name, so a
  watchlist for "Los Angeles" matches a leg out of Van Nuys. Matching is
  exact after normalizing, or a whole-word prefix, so "New York" matches
  "New York City" while "York" does not match "New York".
- **Dates.** The wheels-up day in UTC falls inside `earliest_on` and
  `latest_on`, inclusive. An empty window matches any date.
- **Discount.** At or above the watchlist's `min_discount_pct`, which
  defaults to 30. When a leg has no `discount_pct` the figure is derived
  from listed price against the full-charter reference, the same
  arithmetic the board shows.

`rejectionFor()` returns *why* something did not match rather than a bare
false, which is what to reach for when someone asks why they were not
texted.

## Why nobody gets texted twice

Delivery is claim-then-send. Before sending, the job inserts a `pending`
row into `empty_leg_watchlist_matches`, whose unique index covers
(watchlist, leg, channel). If that insert loses the race the send is
skipped. An overlapping run, a retry after a timeout, or a redeploy
mid-flight therefore cannot produce a duplicate.

The deliberate trade: a crash between the claim and the send leaves a
`pending` row that is never retried, so that alert is lost. A missed
alert beats a duplicate one, and the row records that it happened.

There is also a ceiling of 100 sends per run. Hitting it is a bug, and
the response says `capped` when it does.

## Going live

1. Add `CRON_SECRET` to the Vercel project, any 32-plus character random
   string. Vercel then attaches it as a bearer token on the scheduled
   request. **Until this exists the route answers 401 and nothing is
   sent** — that is the intended failure direction.
2. Set the Twilio variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_SMS_FROM`). Without them `sendSms` logs instead of sending, so
   the job is safe to deploy first and watch in the function logs.
3. Finish A2P 10DLC registration before real SMS volume. US carriers
   filter unregistered application-to-person traffic.
4. Put at least one leg on the board. With an empty board the job returns
   `{ legs: 0, sent: 0 }` and exits immediately.

## Checking on it

Run it by hand:

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://jetnine.com/api/cron/empty-leg-watchlists
```

It answers with counts: `legs`, `watchlists`, `matched`, `sent`,
`skipped` (already alerted on an earlier run), `failed`. The run is
idempotent, so calling it twice in a row should show the second call
skipping everything the first one sent.

## Opt-outs

Every SMS ends with "reply STOP to end alerts". Twilio enforces the block
at the account level regardless of what we do, and the inbound webhook at
`/api/twilio/inbound` now keeps our own rows in step:

- **STOP** (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) deactivates every
  active watchlist on that number and stamps `deactivated_reason =
  'sms_stop'`.
- **START** (or YES, UNSTOP) resumes only the rows STOP paused. A
  watchlist switched off for any other reason stays off, which is why the
  reason column exists.
- **HELP** changes nothing; Twilio answers it.

Keyword matching is on the whole message after stripping case, whitespace
and punctuation, the way carriers do it: "stop." opts out, "please stop
texting me" is treated as a human reply and threaded normally. The rules
are in `src/lib/sms-optout.ts` and covered by `pnpm check:watchlist`.

Carrier keywords are handled before subject-code threading, because a STOP
carries no `[QT-...]` code and would otherwise be logged as unmatched and
dropped.

## What is still not true

The board no longer claims an operator feed it does not have. Legs appear
when someone creates them in the admin, and the copy now says the desk
posts them as operators release them. An automated operator ingest remains
unbuilt.
