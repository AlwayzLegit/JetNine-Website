# Production launch tracker

Live status of the JetNine production rollout. Operator-side items only —
code-side work is tracked in PRs / commits.

Last updated: 2026-05-31 by Claude (session_013mQ7iterX9C2onpo1Qi8Vg)

---

## ✅ Phase 1 — DB connectivity (COMPLETE)

- [x] All six core env vars set in Vercel
- [x] Pooler hostname corrected to `aws-1-us-east-2.pooler.supabase.com` (was `aws-0-`)
- [x] Redeploy `dpl_HiQZ2ec…` → built, ready, serving
- [x] `/api/health` returns `db.ok: true`, **latency 169 ms** (down from 568 ms timeout)
- [x] `/empty-legs` renders all 6 seed legs from the DB
- [x] Superadmin `alwayzlegit@gmail.com` provisioned (`role='superadmin'`,
      email_verified, identity row attached) — ready for first sign-in

## 🟡 Phase 2 — First sign-in test

- [ ] Open https://jet-nine-website.vercel.app/sign-in in incognito
- [ ] Enter `alwayzlegit@gmail.com` → "Email me a link"
- [ ] Magic link arrives via Supabase default SMTP (rate-limited but fine
      for first sign-in; check spam if it doesn't show in 30 s)
- [ ] Click link → lands on `/account`
- [ ] Manually navigate to `/admin/dispatch` — should resolve (you're superadmin)
- [ ] Visit `/admin/health` — confirm DB row green, optional integrations
      red until Phase 3+ wire them

## 🟢 Phase 3 — Sentry (error tracking)

- [ ] Sentry org `jetnine` confirmed exists. Member-create policy currently
      blocks project creation via MCP. Either:
  - Enable "Open Membership" in https://jetnine.sentry.io/settings/ → ping
    Claude and the project + DSN get provisioned via MCP
  - OR create the project yourself at https://jetnine.sentry.io/projects/new/
    with platform `javascript-nextjs`, team `jetnine`. Copy the DSN.
- [ ] Set in Vercel:
  - `NEXT_PUBLIC_SENTRY_DSN` = `<DSN>`
  - `SENTRY_DSN` = `<DSN>` (same value)
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` = `0.1` (optional)
- [ ] Redeploy + verify `/admin/health` Sentry row goes green

## 🟢 Phase 4 — Stripe (test mode first)

- [ ] Sign up at https://dashboard.stripe.com/register
- [ ] Stay in TEST mode for the first walkthrough
- [ ] Settings → Developers → API keys → copy Secret key (`sk_test_…`)
- [ ] Set in Vercel:
  - `STRIPE_SECRET_KEY` = `sk_test_…`
- [ ] Settings → Developers → Webhooks → Add endpoint
  - URL: `https://jet-nine-website.vercel.app/api/stripe/webhook`
  - Events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`
- [ ] Copy the signing secret (`whsec_…`) → set in Vercel:
  - `STRIPE_WEBHOOK_SECRET` = `whsec_…`
- [ ] Redeploy + verify `/admin/health` Stripe row shows `mode: test`
- [ ] Manual walkthrough:
  - [ ] Visit `/account/memberships` as a member (use a second test user)
  - [ ] Click Activate on Card · 100
  - [ ] Use test card `4242 4242 4242 4242`, any future date, any CVC
  - [ ] Confirm membership flips to active + reserve balance shows $100,000

## 🟢 Phase 5 — Email (outbound + inbound)

- [ ] Recommended: Resend (https://resend.com — simpler)
- [ ] Create account, generate API key
- [ ] Verify a sender domain OR use the test sender `onboarding@resend.dev`
      for the first cycle
- [ ] Set in Vercel:
  - `RESEND_API_KEY` = `re_…`
  - `EMAIL_FROM` = `JetNine <dispatch@jetnine.com>` (or `onboarding@resend.dev` for testing)
  - `DISPATCH_NOTIFY_EMAIL` = `dispatch@jetnine.com` (where new-quote alerts go)
- [ ] Redeploy + verify `/admin/health` Email row shows `provider: resend`
- [ ] Submit a test quote via `/quote` — ack email + dispatch notification
      should land

**Inbound (Postmark only — separate provider for this):**
- [ ] If you want customer email replies to thread back automatically,
      sign up for Postmark (https://postmarkapp.com), create a Server
- [ ] Generate `INBOUND_EMAIL_SECRET` (`openssl rand -hex 32`)
- [ ] Set in Vercel:
  - `POSTMARK_SERVER_TOKEN` = `…`
  - `INBOUND_EMAIL_SECRET` = `…`
- [ ] In Postmark: create an Inbound Stream, webhook URL
      `https://jet-nine-website.vercel.app/api/email/inbound/<INBOUND_EMAIL_SECRET>`

## 🟢 Phase 6 — Supabase Auth SMTP (member invites at scale)

The default Supabase SMTP is rate-limited to 4 emails/hour. For real member
invites (when dispatchers invite via `/admin/member`), you need your own SMTP.

- [ ] Supabase dashboard → Project Settings → Authentication → SMTP Settings
- [ ] Enable custom SMTP, plug in Resend's SMTP credentials:
  - Host: `smtp.resend.com`
  - Port: `587`
  - User: `resend`
  - Pass: your Resend API key
  - Sender email: your verified `EMAIL_FROM`

## 🟢 Phase 7 — Twilio (SMS, WhatsApp deferred)

- [ ] Sign up at https://twilio.com (trial credit, no card required initially)
- [ ] Phone Numbers → Buy a number (US local, ~$1/mo)
- [ ] Console → Account → API keys & tokens → copy Account SID + Auth Token
- [ ] Set in Vercel:
  - `TWILIO_ACCOUNT_SID` = `AC…`
  - `TWILIO_AUTH_TOKEN` = `…`
  - `TWILIO_SMS_FROM` = `+1…` (the number you bought, E.164 format)
- [ ] Phone Numbers → your number → Messaging → "A message comes in"
  - Webhook: `https://jet-nine-website.vercel.app/api/twilio/inbound`
  - Method: HTTP POST
- [ ] Redeploy + verify `/admin/health` Twilio SMS row green
- [ ] Manual walkthrough: from `/admin/trip/[id]`, post a `channel=sms` message
      to your own phone; reply; confirm the inbound message threads back

**WhatsApp:** defer until you actually want it. Needs Twilio WABA + Meta
approval (~1 week). Set `TWILIO_WHATSAPP_FROM=whatsapp:+1…` when ready.

## 🟢 Phase 8 — Plausible (analytics)

- [ ] Sign up at https://plausible.io (or self-host)
- [ ] Add `jetnine.com` (or your domain)
- [ ] Set in Vercel: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` = `jetnine.com`
- [ ] Redeploy + load any marketing page to fire a pageview
- [ ] Verify the Plausible dashboard shows the hit within a minute

## 🟢 Phase 9 — Search Console (SEO)

- [ ] https://search.google.com/search-console → Add Property → URL prefix
- [ ] Choose "HTML tag" verification → copy the `content="…"` value
- [ ] Set in Vercel: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = `…`
- [ ] Redeploy, then click "Verify" in Search Console
- [ ] Submit sitemap: Sitemaps tab → add `sitemap.xml`

## 🟢 Phase 10 — Custom domain + cutover

- [ ] Vercel → Project → Domains → Add `jetnine.com` (and `www.jetnine.com`)
- [ ] Configure DNS at your registrar per Vercel's instructions
- [ ] Once DNS resolves + SSL provisions:
  - Update Vercel env `NEXT_PUBLIC_SITE_URL` = `https://jetnine.com`
  - Update Stripe webhook URL, Postmark inbound URL, Twilio messaging webhook
    to use the new host
  - Redeploy
- [ ] Verify `/sitemap.xml` `<loc>` entries reflect the new host
- [ ] Verify Search Console picks up the new property

## 🟢 Phase 11 — End-to-end manual smoke

Once Phases 1-7 are green, walk this in order. I'll watch DB + runtime
logs and report what I see at each step.

- [ ] **Public quote** — `/quote/mission` as a fresh visitor (Bob Smith,
      bob+test@example.com). Submit. Verify quote row, ack email, dispatch
      notification.
- [ ] **Sign in as Bob** — separate browser. Magic-link in.
- [ ] **Convert quote** — back in your superadmin session, `/admin/dispatch`
      → click the new quote → "Convert to trip". Verify trip + invoice rows.
- [ ] **Activate Card · 100 as Bob** — `/account/memberships`. Pay with
      Stripe test card. Verify membership active + balance.
- [ ] **Convert another quote for Bob** — confirm invoice auto-pays from
      reserve balance (the drawdown flow). Verify `reserve_transactions`
      `charter_draw` row + invoice flips to `paid` automatically.
- [ ] **Send a thread message** — from the trip workbench, `channel=sms`
      to Bob's phone. Verify delivery + reply threads back.
- [ ] **Flip trip status** to `cancelled_wx` — verify the auto-refund
      posts a positive `refund` row + invoice voids.
- [ ] **`/admin/audit`** — confirm every action above has a row.

---

## What's deferred (intentional design choices)

- Partial-balance drawdown semantics (block vs partial draw + Stripe-due
  remainder) — needs product call once a real card holder hits this
- Empty-leg self-serve booking — phone-channel today
- Operator portal at `/operator/*` — not built; operators use dispatch
  email/SMS today
- Member document upload — DocuSign external today
- WhatsApp templated outbound for auto-status — needs WABA-approved
  templates from Meta
- Cashback / hourly-credit accrual — schema exists, marketing doesn't
  promise it
