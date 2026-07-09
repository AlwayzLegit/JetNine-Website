# JetNine — Go-Live Checklist

Ordered, owner-facing. The site is deployed and stable on `https://jetnine.com`;
this is what stands between "deployed" and "confidently taking real customers."
Grouped by priority. Code items marked ✅ are already shipped; the rest are
owner/dashboard actions the app can't perform.

---

## 🔴 Blocker — must clear before real sign-ins

### 1. Magic-link email delivery
The app is confirmed correct (Supabase accepted every send — HTTP 200 in the
auth logs — and silently throttles repeats). The gap is at the SMTP/Resend
layer. Do:

- **Verify Supabase → Auth → SMTP Settings** actually points at Resend, not the
  default built-in sender (which caps at ~4 emails/hour):
  - Host: `smtp.resend.com`  ·  Port: `587` (STARTTLS)
  - Username: `resend`  ·  Password: your **Resend API key**
  - Sender email: `dispatch@jetnine.com`  ·  Sender name: `JetNine`
- **Check Resend → Logs** for the QA test sends (to `alwayzlegit+…@gmail.com` /
  `smoke+…`) — confirm they left Resend and weren't bounced/dropped. Gmail can
  also spam-filter `+alias` auth mail; test with a plain address too.

### 2. Magic-link email templates → token_hash (activates the cross-tab fix)
Cross-tab / cross-device sign-in was fixed in code (PR #46: `/auth/callback`
now accepts `token_hash` via `verifyOtp`). To use it, point the templates at
the token_hash URL. In **Supabase → Auth → Email Templates**, for **Magic Link**
and **Invite user**, set the confirmation link to:

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/account
```

(For the invite template use `type=invite`.) Until this changes, links stay
PKCE and only work in the same browser that requested them.

---

## 🟠 Verify before opening the doors

- **Finish the browser QA re-run.** The last pass was cut short by the auth
  blocker, so **Reports, the member portal, and the invoice → Stripe pay path
  are unverified in-browser.** Stripe is **LIVE** — do one real end-to-end test
  but **stop at the Stripe Checkout page; do not complete a charge.**
- **One real member onboarding run** — the roster is empty (a quote can't be
  converted without a member). Invite → member → quote → trip → invoice → pay,
  once, end to end.
- **Email deliverability (DNS for `jetnine.com`).** Resend already verified the
  root domain (DKIM at `resend._domainkey`, Return-Path `send.jetnine.com`).
  Remaining:
  - **DMARC** is currently `p=none` (monitor-only). After watching aggregate
    reports for ~1–2 weeks, tighten the `_dmarc.jetnine.com` TXT record to:
    `v=DMARC1; p=quarantine; rua=mailto:dmarc@jetnine.com; adkim=s; aspf=s`
    then to `p=reject` once clean.
  - Confirm **SPF** on the root TXT includes Resend (`include:_spf.resend.com`)
    alongside Google Workspace (`include:_spf.google.com`) — both must be in the
    **single** SPF record (max one `v=spf1` TXT per domain).

---

## 🟡 Content / data (owner input)

- **Demo empty legs** (`EL-2026-0001..0006`) — refreshed to future dates (or
  hide them) so `/empty-legs` doesn't show stale/past flights. *(Being handled
  this session; confirm the board looks right.)*
- **Membership pricing** — confirm the three `/memberships` tiers (issue #30G).
- **Founder headshots** — real photos only (issue #30F).
- **Purge QA smoke rows** — `JN-2026-00006`/`00007` + the smoke contact, plus any
  test member accounts (`alwayzlegit+…`). Delete child rows first
  (invoices→trips→quotes→contacts→watchlists→members→users).

---

## ⚪ Optional (ships dark — enable when wanted)

- **Twilio SMS/WhatsApp** (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_SMS_FROM` / `TWILIO_WHATSAPP_FROM` in Vercel) — the quote wizard
  offers SMS/phone contact, but those channels won't deliver until this is set.
  Register the inbound webhook `https://jetnine.com/api/twilio/inbound`.
- **Postmark inbound** (`INBOUND_EMAIL_SECRET` in Vercel) — threads client email
  replies back into the message log. Webhook:
  `https://jetnine.com/api/email/inbound/<secret>`.

---

## SEO (Semrush audit — code fixes shipped this session)

Quality score 95/100; the fixable technical issues are addressed in code:
- ✅ Sitemap "incorrect page" — `/quote/mission` is now self-canonical.
- ✅ 24 temporary redirects — public CTAs point straight to `/quote/mission`; the
  `/quote` vanity redirect is now `308` permanent.
- ✅ `llms.txt` added at `/llms.txt`.
- **Re-run the Semrush audit** after this deploys to confirm the error clears.
- Left as content work (not code): "low text/HTML ratio" (design-heavy pages)
  and a couple of low-internal-link pages (`/faq`, `/legal`) — optional.
