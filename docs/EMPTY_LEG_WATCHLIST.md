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

## Confirmed opt-in

The form takes a phone number and an optional email with no proof that
whoever filled it in controls either, so a watchlist starts silent and
stays that way until the recipient proves control.

- On submit the row is created with a random token per channel, stored
  only as a SHA-256 hash, and a 48-hour window. The confirmation goes to
  the address it belongs to.
- Confirmation is **per channel**. An SMS token confirms the number and
  nothing else, so pairing your own phone with someone else's inbox does
  not confirm the inbox.
- Confirming is a POST from a button on `/empty-legs/confirm/[token]`,
  never a GET on page load. Corporate mail scanners follow links, and a
  confirming GET would let a scanner opt someone in without a human
  seeing the message.
- Tokens are single-use: the hash is cleared when it is spent.
- Unconfirmed rows are deleted by the cron once the window passes, which
  is the promise the confirmation email makes.

`active` and confirmation are separate gates and both are required.
`active` means "not paused" and is what STOP clears; confirmation means
"this address asked for it". A member resuming their own watchlist from
`/account/preferences` cannot resume an unconfirmed one, because owning
the row is not the same as controlling the number on it.

## What counts as a match

All of these must hold:

- The watchlist is active and has a channel it can actually reach *and
  that has confirmed*: a phone for SMS, an address for email.
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

Note that confirmation SMS goes out through the same `sendSms`, so until
Twilio is configured nobody can complete an opt-in in production — the
link is only written to the function log. That is the correct order:
credentials first, then the flow works end to end.

## Checking on it

Run it by hand:

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://jetnine.com/api/cron/empty-leg-watchlists
```

It answers with counts: `legs`, `watchlists`, `matched`, `sent`,
`skipped` (already alerted on an earlier run), `failed`, and
`sweptUnconfirmed` (expired opt-ins deleted). The run is
idempotent, so calling it twice in a row should show the second call
skipping everything the first one sent.

## Unsubscribing from email

Every alert email carries two ways out.

- **A link in the body**, to `/empty-legs/unsubscribe/[token]`. That page
  only reads; the unsubscribe is a POST from a button, so a mail scanner
  walking the message cannot unsubscribe the reader. It stops email, and
  offers to stop the texts too when the number confirmed.
- **The `List-Unsubscribe` header pair**, pointing at
  `/api/email/unsubscribe/[token]`, which answers a bare POST. That is
  what Gmail's and Yahoo's own unsubscribe button uses, and RFC 8058
  requires the single POST to be enough — the opposite of the confirm
  flow, and correctly so, because this direction only ever stops mail.

The endpoint answers 200 for tokens it does not recognise. A provider
retrying after a timeout must not see a failure, and an error would tell
a prober which tokens are real.

The token is minted by the database (`default encode(gen_random_bytes(24),
'hex')`) so a row cannot exist without one, and it is stored in plain
text. That asymmetry against the hashed confirmation tokens is
deliberate: a confirmation token grants consent, so a leaked one could
subscribe a stranger; an unsubscribe token only withdraws it, and the
cron has to read it to write the link into each alert.

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

## Where the email copy lives

In code, in `src/lib/email.ts` and the two watchlist modules — not in the
Resend dashboard, which holds no templates. Resend is the live provider
(`RESEND_API_KEY` set, `jetnine.com` verified), with Postmark as the
fallback branch and a logger when neither is configured.

## What is still not true

The board no longer claims an operator feed it does not have. Legs appear
when someone creates them in the admin, and the copy now says the desk
posts them as operators release them. An automated operator ingest remains
unbuilt.
