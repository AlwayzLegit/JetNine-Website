# Deploy runbook

This is the operator-side checklist for spinning up (or rotating) a JetNine production environment. Every external dependency ships dark — the app runs end-to-end without any of them — but for a real launch you want them all wired.

The codebase already reflects the design decisions; this doc is just the order of operations and where to find each secret.

---

## 0. Prerequisites

- Vercel account with the `jet-nine-website` project linked to the GitHub repo `AlwayzLegit/JetNine-Website`. Production branch: `main`. Region pinned to `cle1` (colocated with Supabase `us-east-2`).
- Supabase project `szuztxfhkudcjzhrkfld` in `us-east-2`. All 31 migrations applied; check `drizzle.__drizzle_migrations` if drift is suspected.
- GitHub repo write access for whoever is running this.

---

## 1. Supabase

What you need from the dashboard:

| Env var | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server-only — never expose) |
| `DATABASE_URL` | Settings → Database → Connection string → **Transaction pooler** (port 6543). Append `?sslmode=require&pgbouncer=true`. |
| `DIRECT_URL` | Settings → Database → Connection string → **Direct connection** (port 5432). Append `?sslmode=require`. Used by migrations only. |

The DB password is the one you set when the project was created. If you've lost it, regenerate it in Settings → Database → Reset database password (this rotates `DATABASE_URL` + `DIRECT_URL` everywhere — update Vercel after).

## 2. Vercel env vars

Easiest: edit `scripts/set-vercel-env.sh`, fill in the four placeholders (fresh Vercel token + DB password + service-role key + prod domain), run `bash scripts/set-vercel-env.sh`. Sets all six required vars across production / preview / development scopes.

Or paste manually into the Vercel dashboard → Settings → Environment Variables.

After env is set, trigger a redeploy from the dashboard's Deployments tab → ⋯ → Redeploy.

## 3. Stripe (optional — payments + member purchase)

Without Stripe keys, the Pay-now button on `/account/invoices` returns `STRIPE_NOT_CONFIGURED` and the Activate buttons on `/account/memberships` do the same. The rest of the app is unaffected.

1. Create a Stripe account at https://dashboard.stripe.com. Toggle Test mode for first-pass verification.
2. Set in Vercel:
   - `STRIPE_SECRET_KEY` — Dashboard → Developers → API keys → Secret key (`sk_test_…` / `sk_live_…`).
3. Create the webhook:
   - Dashboard → Developers → Webhooks → Add endpoint.
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`.
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copy the signing secret (`whsec_…`) into Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Test: from `/account/invoices`, click Pay-now on a due invoice. From `/account/memberships`, click Activate on Card · 100.

## 4. Email (optional — transactional sends)

Without these, every `sendEmail()` call falls through to a stdout logger. The dispatcher UI still shows green `sent · logger` pills.

**Outbound** — Resend OR Postmark; pick one:

| Env var | Notes |
|---|---|
| `RESEND_API_KEY` | https://resend.com → API Keys → New |
| `POSTMARK_SERVER_TOKEN` | https://account.postmarkapp.com → Server → API Tokens. Required only if Resend isn't used. |
| `EMAIL_FROM` | `"JetNine <dispatch@jetnine.com>"`. Required when either provider key is set. Sender must be verified with the provider. |
| `DISPATCH_NOTIFY_EMAIL` | Default `dispatch@jetnine.com`. Where new-quote alerts go. |

**Inbound** (Postmark only for now):

| Env var | Notes |
|---|---|
| `INBOUND_EMAIL_SECRET` | 32+ random chars (`openssl rand -hex 32`). Used as the path segment of the inbound webhook URL. |

Then register the webhook in Postmark:
- Dashboard → Servers → Inbound Stream → Webhook URL: `https://YOUR_DOMAIN/api/email/inbound/$INBOUND_EMAIL_SECRET`.

## 5. Twilio (optional — SMS)

Without these, `channel='sms'` on dispatcher threads falls through to the logger and trip-status auto-SMS is `skipped` for every member.

| Env var | Notes |
|---|---|
| `TWILIO_ACCOUNT_SID` | Console → Account → API keys. Starts `AC…`. |
| `TWILIO_AUTH_TOKEN` | Same panel. **Server-only.** |
| `TWILIO_SMS_FROM` | E.164 number you own in Twilio. e.g. `+18885551234`. |

Configure inbound:
- Console → Phone Numbers → your number → Messaging → A MESSAGE COMES IN.
- Webhook: `https://YOUR_DOMAIN/api/twilio/inbound`, method `HTTP POST`.

The route verifies Twilio's signature using `TWILIO_AUTH_TOKEN`; no path-based secret needed.

**WhatsApp** uses the same Twilio account. Set:

| Env var | Notes |
|---|---|
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+E164` of your WABA-approved sender. Sandbox value for dev: `whatsapp:+14155238886`. |

Dev sandbox: members text "join <code>" to the sandbox number from their phone before we can reach them. Production needs a WhatsApp Business Account (WABA) registration through Twilio + Meta — allow a week for approval. Outbound-first messages from a WABA sender require pre-approved templates; once the customer initiates a conversation, freeform replies work for 24h after each message.

## 6. Sentry (optional — error tracking)

Without a DSN, error boundaries log to `console.error` only.

| Env var | Notes |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project → Settings → Client Keys (DSN). |
| `SENTRY_DSN` | Same project's DSN. Can be the same value. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional, default `0.1`. |

The SDK lazy-loads on the client (no bundle cost when DSN is missing).

## 7. Analytics & SEO verification (optional)

| Env var | Notes |
|---|---|
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | e.g. `jetnine.com`. Plausible is cookieless — no GDPR banner needed. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console → Add property → meta tag method → copy the `content="..."` value. |

After Plausible is wired, submit the sitemap to Search Console at https://search.google.com/search-console → Sitemaps → Add `sitemap.xml`.

## 8. Custom domain

In Vercel → Domains → Add. Point your registrar's `A` record at Vercel's anycast IP (or `CNAME` for subdomain). Vercel issues a Let's Encrypt cert automatically.

After DNS resolves:
- Update `NEXT_PUBLIC_SITE_URL` in Vercel to the canonical domain (e.g. `https://jetnine.com`).
- Redeploy — sitemap, OG URLs, Stripe redirects, and canonical tags all pick up the new host.

## First-deploy verification checklist

After everything is wired, the fastest single-call check is:

```
curl -s https://YOUR_DOMAIN/api/health | jq
```

Expected response shape:

```json
{
  "ok": true,
  "status": "healthy",       // or "degraded" if some optional integration is unconfigured
  "env": "production",
  "region": "cle1",
  "sha": "abc123def456",
  "checks": {
    "db":        { "ok": true,  "latencyMs": 12 },
    "stripe":    { "ok": true,  "configured": true, "webhookConfigured": true, "mode": "live" },
    "email":     { "ok": true,  "provider": "resend", "outboundConfigured": true, "inboundConfigured": true, "fromConfigured": true },
    "twilio":    { "ok": true,  "smsConfigured": true, "whatsappConfigured": true },
    "sentry":    { "ok": true,  "browserConfigured": true, "serverConfigured": true },
    "plausible": { "ok": true,  "configured": true }
  }
}
```

`status: "healthy"` means every integration is wired. `status: "degraded"` means DB is up but at least one optional integration (Stripe / email / Twilio / Sentry) is unconfigured — read `checks` to see which. HTTP status is 200 unless the DB itself is unreachable, in which case the endpoint returns 503 with the same body shape (so ops still has diagnostics).

For broader verification, also check:

- [ ] `/sitemap.xml` returns 200 with the right host in `<loc>` entries.
- [ ] `/robots.txt` shows production rules (not `Disallow: /`).
- [ ] `/opengraph-image` returns a 200 PNG (1200×630).
- [ ] Security headers present: `curl -sI YOUR_DOMAIN | grep -i 'csp\|hsts\|frame-options'`.
- [ ] `/quote` form submits; new-quote email lands at `DISPATCH_NOTIFY_EMAIL`; row appears in `/admin/dispatch`.
- [ ] `/account/invoices` Pay-now → Stripe Checkout → return → invoice flips to `paid` (test mode).
- [ ] `/account/memberships` Activate Card · 100 → Stripe Checkout → return → membership active + balance shows $100k.
- [ ] Flip a test trip from `confirmed` → `boarding`; member receives both email + SMS.
- [ ] Member replies to either; thread shows `direction='in'` row.
- [ ] Plausible dashboard shows pageviews.
- [ ] Sentry dashboard shows a test error (trigger via `/admin/audit` if you've wired one).

## Diagnosing a sick deploy

If `/api/health` returns `status: "unhealthy"`, the only check that can flip it is `db`. Three causes, in order of likelihood:

1. **`DATABASE_URL` missing or wrong on Vercel.** Open Project Settings → Environment Variables. Confirm `DATABASE_URL` is set for the right scope (Production / Preview / Development). If you rotated the Supabase DB password, both `DATABASE_URL` and `DIRECT_URL` need the new password — they're independent strings.
2. **Supabase project paused.** Free tier auto-pauses after 7 days of zero queries. Resume from the Supabase dashboard; deploys start working again within seconds.
3. **Region mismatch.** `DATABASE_URL` should be the **Transaction pooler** URL (port 6543), not the direct connection (port 5432). The pooler region must match your Supabase region — for us-east-2, that's `aws-0-us-east-2.pooler.supabase.com`.

If `/api/health` returns `status: "degraded"`, the DB is fine but at least one optional integration (Stripe / email / Twilio / Sentry / Plausible) is unconfigured. Visit `/admin/health` for a per-integration breakdown with fix hints, or read `checks.*` in the JSON.

The post-deploy smoke workflow (`.github/workflows/smoke-after-deploy.yml`) fails when `/api/health` returns non-200 against a non-localhost target — so a degraded prod deploy will paint the merge commit red without manual checking. There's also a scheduled health monitor (`.github/workflows/health-monitor.yml`) that probes every 15 minutes for between-deploy regressions.

## Rotation

If you need to rotate a secret:

1. Generate the new value in the provider's dashboard.
2. Update Vercel env (script or dashboard).
3. Trigger a fresh deploy — env changes don't apply to running serverless functions until they cold-start.
4. Revoke the old value in the provider.
