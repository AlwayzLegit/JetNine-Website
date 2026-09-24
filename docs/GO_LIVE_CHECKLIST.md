# Go-live checklist: voice desk and SMS alerts

Plain-text mirror of the checklist page shared on 2026-09-11. **You** items
need Jet's accounts; **Me** items I do once pinged. A2P 10DLC covers SMS
from long-code numbers only, so Phase A does not wait on it.

## Status 2026-09-24

- Phase B done on the Twilio side per the owner: number in place, A2P 10DLC
  approved (the 30907 rejection was cleared by PRs #63/#64).
- `CRON_SECRET` set on Vercel (production + preview) and production
  redeployed, so the cron routes now run. Until then all four answered 401.
- Both crons verified on the 20:00 UTC tick: `/api/cron/sla-watch` and
  `/api/cron/empty-leg-watchlists` answered 200.
- **Phase A item 1 was never done.** On redeploy (2026-09-24) `jetnine-voice`
  logged `NOT call-ready` with all six secrets missing: `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER`, `ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ESCALATION_PHONE`. Render shows no traffic in
  30 days. The service is also still on the **free** plan (hibernates).
  `SMS_ALERTS_ENABLED=true` is now set (Phase C item 4) and is inert until
  the secrets land.
- **Phase C item 1 done** (20:00 UTC): `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` set on Vercel production and
  redeployed. `/api/health` now reads **`healthy`** with
  `twilio.smsConfigured: true`. Outbound SMS (watchlist confirmations and
  alerts, thread messages, trip-status texts) is live from this point.
- **Inbound SMS verified** (20:29 UTC): messaging webhook on the number set
  to `https://jetnine.com/api/twilio/inbound`, Messaging Service set to
  defer to the sender's webhook. A TEST text from the broker's mobile
  returned 200 and raised the "[UNROUTED] Inbound SMS" desk alert (the
  correct outcome for a body with no thread code). An earlier attempt with
  the webhook on a per-deployment `*.vercel.app` URL was rejected 403;
  never point Twilio at a deployment URL.
- **Render** (20:27 UTC boot): five of six secrets in, `ESCALATION_PHONE`
  set. Only `ANTHROPIC_API_KEY` is missing; the voice desk stays
  `NOT call-ready` until it lands. Owner chose to stay on the Free plan for
  now (the first call after 15 idle minutes will hit the hibernation delay).
- Still open: `ANTHROPIC_API_KEY` on Render, the number's Voice webhook
  (Phase A item 4), the STOP/START text check, and the three scripted test
  calls.
- Tooling notes: the Twilio MCP is Twilio's public docs server (no account
  access), so the number's webhooks stay a console step. The Render MCP can
  write env vars but not read them; `SUPABASE_SERVICE_ROLE_KEY` on Vercel is
  a write-only sensitive var, so it must be copied from Supabase, not Vercel.

## Phase A — voice desk on the ported number (ships now)

1. **You — six secrets on Render** (`dashboard.render.com → jetnine-voice →
   Environment`). Non-secret values are already set.
   | Variable | Source |
   | --- | --- |
   | `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info (starts `AC`) |
   | `TWILIO_AUTH_TOKEN` | same panel, reveal |
   | `TWILIO_NUMBER` | ported number, E.164 (`+1…`) |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys → create `jetnine-voice` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role |
   | `ESCALATION_PHONE` | broker's own mobile, E.164 — **must not be the ported number** or transfers loop |
   Optional now: `ALERT_PHONE` (lead-summary texts, Phase C).
2. **You — card and plan.** Render → Billing → add card; jetnine-voice →
   Settings → Instance Type → Starter. Free instances sleep and miss the
   webhook timeout; do this before pointing the number.
3. **Me — boot check.** `/health` 503 → 200, empty `missingEnv`, logs clean.
4. **You — voice webhook.** Twilio → Phone Numbers → Active numbers → the
   number → Voice Configuration: Webhook,
   `https://jetnine-voice.onrender.com/twiml`, HTTP POST. Leave Messaging
   empty. Accept the AI/ML addendum prompt if shown.
5. **You — recording decision.** Currently on with disclosure in the
   greeting (California two-party consent). Say the word to turn it off.
6. **You — three test calls**, tell me after each:
   - "Flying tomorrow, VNY to TEB, two of us" → transfer; lead + trip
     request `within_48h`, outcome `escalated`.
   - Ordinary quote next month → lead saved, outcome `lead`, no transfer.
   - "Let me talk to a person" → immediate transfer.
   Plus one mid-sentence hang-up to see the partial lead saved.
7. **You + Me — voice.** Candidates in `voice/.env.example`; one redeploy
   per audition.

## Phase B — A2P 10DLC registration (submit now, approval takes days)

Requires an upgraded Twilio account. Console → Messaging → Regulatory
Compliance → A2P 10DLC (may route via Trust Hub → Customer Profile).

1. **Business profile:** legal name as registered, EIN, address, business
   type, `https://jetnine.com`, contact.
2. **Brand:** Low Volume Standard.
3. **Campaign:** use case Account Notifications; embedded links yes; phone
   numbers yes; age-gated no; direct lending no; opt-in keywords none
   (web opt-in); opt-out STOP STOPALL UNSUBSCRIBE CANCEL END QUIT; help
   HELP INFO.

   Description:
   > JetNine is a private jet charter brokerage. This campaign sends two
   > kinds of transactional messages to customers who opted in on
   > jetnine.com: (1) a one-time confirmation text when someone sets up an
   > empty-leg alert, and (2) an alert when a repositioning flight matching
   > their saved route and dates becomes available. Each alert is one
   > message per match. Customers can reply STOP at any time.

   Opt-in flow:
   > On https://jetnine.com/empty-legs a visitor enters their mobile number
   > and the route and dates they want to watch. The form states "Mobile
   > (for SMS)" and "1 SMS per match, cancel any time". We then send one
   > confirmation text containing a link; nothing further is sent unless
   > the recipient opens that link and presses Confirm. Alerts stop on
   > reply STOP, and every alert ends with "reply STOP to end alerts".

   Sample 1 (confirmation):
   > JetNine: confirm empty-leg alerts for KVNY → KTEB —
   > https://jetnine.com/empty-legs/confirm/abc123. Expires in 48h. Didn't
   > request this? Ignore it and nothing is sent. Reply STOP to block all
   > texts.

   Sample 2 (alert):
   > JetNine: empty leg match. VNY → TEB Sat, Sep 12, super-mid, $8,400
   > (53% off). First call wins: +1 (424) 487-2707.
   > https://jetnine.com/empty-legs · reply STOP to end alerts.

   Opt-out reply: "JetNine: you're unsubscribed from empty-leg alerts and
   will get no more texts. Reply START to resume."
   Help reply: "JetNine empty-leg alerts. Reply STOP to end. Questions:
   +1 (424) 487-2707 or dispatch@jetnine.com."
4. **Attach the number** to the campaign's Messaging Service sender pool.
5. **Wait for Verified / Approved**, then tell me. If rejected, send the
   reason verbatim.

## Phase C — switch SMS on (after B approves)

1. **You — Vercel Production env:** `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` (ported number, E.164). Or paste
   the three values into a Claude session and they go in through the Vercel
   MCP. Redeploy the latest deployment afterwards (env changes only apply to
   a new deployment). `CRON_SECRET` is already set (2026-09-24).
2. **You — messaging webhook:** number → Messaging Configuration (or the
   Messaging Service → Integration → Send a webhook):
   `https://jetnine.com/api/twilio/inbound`, HTTP POST.
3. **Me — end-to-end SMS test:** run the cron by hand, real watchlist with
   a number you give me, confirmation text, press Confirm, STOP, verify,
   delete test rows.
4. **You — `SMS_ALERTS_ENABLED=true` on Render** with `ALERT_PHONE` set.

## Phase D — not blocking

- A real leg on the board (board, watchlist and matcher idle until then).
- Backlink tier 1 + Google Business Profile (`docs/BACKLINK_TARGETS.md`).
- Semrush Position Tracking campaign, UI only
  (`docs/POSITION_TRACKING_KEYWORDS.md`).
