# Deploy runbook

This is the operator-side checklist for spinning up (or rotating) a JetNine production environment. Every external dependency ships dark — the app runs end-to-end without any of them — but for a real launch you want them all wired.

The codebase already reflects the design decisions; this doc is just the order of operations and where to find each secret.

---

## 0. Prerequisites

- Cloudflare account on **Workers Paid** (the bundle is over the free plan's 3 MB limit) with the `jetnine.com` zone. The site runs as the Worker `jetnine-web` (staging: `jetnine-web-staging`), built with the OpenNext adapter. Smart Placement keeps it near Supabase `us-east-2`.
- Until the cutover in §2 is finished, the Vercel project `jet-nine-website` still serves production and is the rollback target.
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

The DB password is the one you set when the project was created. If you've lost it, regenerate it in Settings → Database → Reset database password (this rotates `DATABASE_URL` + `DIRECT_URL` everywhere — update the Hyperdrive config and Worker secrets after — see §2).

## 2. Cloudflare (Workers)

### One-time setup

Run these from the repo root after `pnpm exec wrangler login` (or with `CLOUDFLARE_API_TOKEN` set).

1. **Hyperdrive** pools database connections for the Worker.
   - Use the Supabase **session pooler** URL: Settings → Database → Connection string → Session pooler. That's port **5432** on host `aws-1-us-east-2.pooler.supabase.com`, user `postgres.szuztxfhkudcjzhrkfld`.
   - Don't use the 6543 transaction pooler, because Hyperdrive already does its own pooling.
   ```
   pnpm exec wrangler hyperdrive create jetnine-db --connection-string="postgresql://postgres.szuztxfhkudcjzhrkfld:PASSWORD@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
   ```
   Put the printed id into both `<HYPERDRIVE_ID>` placeholders in `wrangler.jsonc`.
2. **Cache storage** backs ISR, `revalidate` and `revalidateTag`:
   ```
   pnpm exec wrangler r2 bucket create jetnine-next-cache
   pnpm exec wrangler r2 bucket create jetnine-next-cache-staging
   pnpm exec wrangler d1 create jetnine-tag-cache
   pnpm exec wrangler d1 create jetnine-tag-cache-staging
   ```
   Put the two D1 ids into `<D1_TAG_CACHE_ID>` and `<D1_TAG_CACHE_STAGING_ID>`.
3. **Images** handles next/image optimisation and blog hero resizing. Enable Images in the dashboard (Images → Overview). The `IMAGES` binding needs nothing else.
4. **Secrets.** Put the production values in a dotenv file that isn't committed. `vercel env pull .env.cloudflare --environment=production` copies them from Vercel. Then run:
   ```
   bash scripts/set-wrangler-secrets.sh .env.cloudflare            # production Worker
   bash scripts/set-wrangler-secrets.sh .env.cloudflare staging    # staging Worker
   rm .env.cloudflare
   ```
5. **GitHub** (Settings → Secrets and variables → Actions):
   - Secrets:
     - `CLOUDFLARE_API_TOKEN`: create it from the "Edit Cloudflare Workers" template and add D1, R2 and Hyperdrive permissions.
     - `CLOUDFLARE_ACCOUNT_ID`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `DATABASE_URL`: the transaction pooler URL. The build prerenders pages that read the database, as Vercel builds did.
   - Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
   - The `NEXT_PUBLIC_*` values are compiled into the build, so they must be set here, not only in Worker secrets.

**Deploys**
- Every push to `main` deploys **staging** through `.github/workflows/deploy-cloudflare.yml`, then runs the post-deploy smoke test against `https://staging.jetnine.com`.
- Until the cutover, deploy production by running that workflow manually (workflow_dispatch) with target `production`. After the cutover, change the push target in the workflow to production.

**Deploying from the bundle** (until `CLOUDFLARE_API_TOKEN` exists)
- Run `.github/workflows/staging-bundle.yml` (workflow_dispatch, target staging or production) and download the `open-next-<target>` artifact. It is built on Linux because OpenNext can't build on Windows.
- Unpack it over `.open-next/` in the checkout, then rewrite the runner's absolute paths that the build bakes into `handler.mjs` wasm imports: replace `/home/runner/work/JetNine-Website/JetNine-Website` with the local checkout path (forward slashes) in every file under `.open-next/`.
- `wrangler deploy --dry-run --env staging` (or no `--env` for production) must list every binding before you deploy for real.
- Deploy with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder pnpm exec opennextjs-cloudflare deploy --env staging`. The variable is only parsed by the local Miniflare proxy that populates the cache; any valid URL works, it is never connected to.

**Local**
- `pnpm dev` is unchanged and still talks to `DATABASE_URL`.
- `pnpm cf:preview` builds the Worker and serves it in workerd. It needs `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=<DATABASE_URL>` in the environment.
- Build on Linux, WSL or in CI. OpenNext warns that builds on Windows are unreliable.

### Cutover (zero downtime)

DNS for `jetnine.com` is already on Cloudflare, so switching over is a route change. There's no DNS propagation to wait for.

1. **Get staging green.**
   - The smoke workflow passes on `staging.jetnine.com`.
   - Check by hand: sign-in, the quote wizard, the admin desk, and invoice → Stripe Checkout (stop before paying).
   - Staging runs no crons.
2. **Stop the Vercel crons first.** Remove the `crons` array from `vercel.json` and push; wait for that Vercel deploy to finish. The production Worker's crons are live from its first deploy, so this has to happen before step 3 or every job runs twice for a while. The gap is a few minutes of no `sla-watch`, which is fine.
3. **Deploy production once** (workflow_dispatch → production, or from the bundle, see below). It's only reachable on its `*.workers.dev` URL, but its crons are already running against the shared database. Check `/api/health` and the first `*/10` cron in Workers logs.
4. **Do these together, in this order:**
   1. In `wrangler.jsonc`, uncomment the production `routes` (jetnine.com and www).
   2. Delete the DNS records for `jetnine.com` and `www` that point at Vercel. Cloudflare won't attach a custom domain over an existing record. Write down their values first; you need them to roll back.
   3. Deploy production again. The Worker takes over both hostnames.
   4. Change the push target in `deploy-cloudflare.yml` to production.
5. **Check the switch worked:**
   - `curl -sI https://jetnine.com | grep -i server` shows `cloudflare`, and there's no `x-vercel-id` header.
   - `/api/health` returns 200 with `"ok": true`. With `Authorization: Bearer $CRON_SECRET` it also reports `region: cloudflare` and the commit.
   - Workers logs show the next `*/10` cron (`sla-watch`) returning 200.
6. **Webhooks need no edits.** Their URLs don't change (`/api/stripe/webhook`, `/api/twilio/inbound`, `/api/email/inbound/…`, `/api/voice/*`), so Stripe, Twilio and Postmark keep working as they are.

**Rollback**
1. Remove the custom domains from the Worker, or comment out `routes` and redeploy.
2. Recreate the two DNS records pointing at Vercel. Values at cutover (2026-11-03), both DNS-only:
   - `jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com` (Cloudflare flattens it to Vercel's A records)
   - `www.jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com`
3. Restore `crons` in `vercel.json`.

Keep the Vercel project for two weeks after the cutover before deleting it.

## 3. Stripe (optional — payments + member purchase)

Without Stripe keys, the Pay-now button on `/account/invoices` returns `STRIPE_NOT_CONFIGURED` and the Activate buttons on `/account/memberships` do the same. The rest of the app is unaffected.

1. Create a Stripe account at https://dashboard.stripe.com. Toggle Test mode for first-pass verification.
2. Set as Worker secrets (`pnpm exec wrangler secret put NAME`):
   - `STRIPE_SECRET_KEY` — Dashboard → Developers → API keys → Secret key (`sk_test_…` / `sk_live_…`).
3. Create the webhook:
   - Dashboard → Developers → Webhooks → Add endpoint.
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`.
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copy the signing secret (`whsec_…`) as the Worker secret `STRIPE_WEBHOOK_SECRET`.
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
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API key (`phc_…`). SDK lazy-loads client-side only when set. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional. Defaults to `https://us.i.posthog.com`; only set for EU cloud or self-hosted. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console → Add property → meta tag method → copy the `content="..."` value. |

After PostHog is wired, submit the sitemap to Search Console at https://search.google.com/search-console → Sitemaps → Add `sitemap.xml`.

## 8. AI providers (voice desk)

The voice desk on Render needs a model vendor. Keys are not env vars: an admin
stores them at `/admin/settings/ai` (Anthropic and/or OpenAI, each with a
default model) and sets the **Voice desk** route to a primary and optional
fallback provider. The page tests a key by listing the vendor's models with it.

| Env var | Notes |
|---|---|
| `AI_KEYS_ENCRYPTION_KEY` | `openssl rand -hex 32`. Encrypts the stored keys. **Same value in the site's Worker secrets and on the voice service.** |
| `ANTHROPIC_API_KEY` (Render only) | Optional fallback when nothing is routed in the admin. |

Schema: migration `0047_ai_providers.sql` (tables `ai_providers`, `ai_routes`,
audit subject `ai_provider`). Admin-only (`requireAdmin`), every change audited
as `ai_provider.*` / `ai_route.update`; key material never appears in the
audit log or the UI (last four characters only).

## 8b. Guest status link (redesign phase 3)

Schema: migration `0048_quote_status_token.sql` adds `quotes.status_token`
(24 random bytes, hex, unique) and backfills existing rows. Apply it before
deploying the phase-3 build — the submit action writes the column. The page
`/request/<token>` is `noindex` and disallowed in robots; lookups are
rate-limited per IP. No new env vars. Migration `0049_quotes_anon_select_revoke.sql`
(also applied) removes the anon-key read path on `quotes` / `quote_legs` that 0003
left open and rotates every token; keep it applied before 0048's links go out.

## 8c. Dispatch desk settings (redesign phase 5)

Schema: migration `0050_desk_settings.sql` adds `staff_notification_prefs`
(one row per staff user; absent row = defaults) and `desk_settings`
(key/value; seeded with `reply_promise_minutes = 30`). Apply it before
deploying the phase-5 build — Settings › Notifications reads and writes both,
and the quote submit action reads the reply promise (it falls back to 30
minutes if the table is missing, so a late migration degrades rather than
breaks). No new env vars. A new cron `/api/cron/morning-summary` runs at 7 AM
Los Angeles for staff who turned the morning summary on (same `CRON_SECRET`).

Old desk URLs (`/admin/dispatch`, `/admin/quote/<id>`, `/admin/trip/<id>`,
`/admin/member/<id>`, `/admin/inquiries`, `/admin/voice`, `/admin/reports`,
`/admin/audit`, `/admin/health`) redirect to the five new sections, so links
in older dispatch emails keep working.

## 8d. Desk API keys (API phase 1)

Schema: migration `0051_api_keys.sql` adds `api_keys` (hashed keys, scopes,
expiry, revocation) and `api_requests` (per-call log), and six audit subject
types (`api_key`, `blog_post`, `approval`, `agent_run`, `agent_playbook`,
`agent_memory`). Apply it before deploying — the blog endpoints now write
audit rows with `subject_type = 'blog_post'`; without the enum values those
rows are silently dropped (audit is best-effort) and `/api/v1` answers 503. No new env vars; `BLOG_ADMIN_API_KEY` keeps working on the legacy
`/api/admin/blog/*` paths. API reference: `docs/API.md`.

## 8e. Desk assistant tables (API phase 4)

Schema: migration `0052_agent.sql` adds `agent_playbooks`, `agent_runs`,
`agent_run_items` and `agent_memory` (all RLS on, no policies; server-only).
Apply it before deploying — `/api/v1/agent/*` reads and writes them. No new
env vars. The scheduled task moves to the bootstrap prompt in
`docs/AGENT_HANDOFF.md` with a key from Settings › API keys.

## 8f. Approval queue (API phase 5)

Schema: migration `0053_approvals.sql` adds `approvals` (RLS on, no
policies; server-only). Apply it before deploying — client-facing desk
writes called by a key that "asks before acting" are stored there and
return a 202 instead of running. People decide them in Messages › Needs
your OK; the `api-maintenance` cron expires anything undecided after 7
days. No new env vars.

## 8g. Cutting the scheduled task over to the assistant (API phase 8)

No schema or env changes. The runbook, in order:

1. Admin › Settings › API keys → Create a key → template **Daily assistant**
   (read, content, desk, assistant; asks before acting; 90 days). Copy it
   once; it is never shown again.
2. In Cowork, open the existing daily blog task. Disable it (do not delete
   it yet) and create the new one with the prompt in `docs/AGENT_HANDOFF.md`,
   the key pasted in, the Hugging Face connector on, Semrush optional.
3. Run the new task once by hand. Admin › Settings › Assistant › Today shows
   the run, its report and its items; Messages › Needs your OK shows anything
   it proposed.
4. Watch Settings › API keys for a week: the assistant key "used today" every
   day, and **The old blog key** card showing no calls. When it reads
   "Safe to remove", run `pnpm exec wrangler secret delete BLOG_ADMIN_API_KEY` and
   delete the old task. The legacy `/api/admin/blog/*` routes go in phase 10.

## 9. Custom domain

`jetnine.com` and `www` are Worker custom domains (see §2 → Cutover), and Cloudflare issues their certificates.

`NEXT_PUBLIC_SITE_URL` comes from the `wrangler.jsonc` vars at runtime and from the deploy workflow at build time. The sitemap, OG URLs, Stripe redirects and canonical tags all use it.

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
  "region": "cloudflare",
  "sha": "abc123def456",
  "checks": {
    "db":        { "ok": true,  "latencyMs": 12 },
    "stripe":    { "ok": true,  "configured": true, "webhookConfigured": true, "mode": "live" },
    "email":     { "ok": true,  "provider": "resend", "outboundConfigured": true, "inboundConfigured": true, "fromConfigured": true },
    "twilio":    { "ok": true,  "smsConfigured": true, "whatsappConfigured": true },
    "sentry":    { "ok": true,  "browserConfigured": true, "serverConfigured": true },
    "posthog":   { "ok": true,  "configured": true }
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
- [ ] PostHog activity feed shows pageviews.
- [ ] Sentry dashboard shows a test error (trigger via `/admin/audit` if you've wired one).

## Diagnosing a sick deploy

If `/api/health` returns `status: "unhealthy"`, the only check that can flip it is `db`. Three causes, in order of likelihood:

1. **Hyperdrive is misconfigured.** On Workers, the app connects through the `HYPERDRIVE` binding, not `DATABASE_URL`. If the Supabase password was rotated:
   - Run `pnpm exec wrangler hyperdrive update <HYPERDRIVE_ID> --origin-password=NEW`.
   - Also update the `DATABASE_URL` and `DIRECT_URL` secrets. Scripts, migrations and `pnpm dev` still use them.
2. **Supabase project paused.** Free tier auto-pauses after 7 days of zero queries. Resume from the Supabase dashboard; deploys start working again within seconds.
3. **Hyperdrive points at the wrong pooler.** It must use the **session pooler**: port 5432 on `aws-1-us-east-2.pooler.supabase.com`. `DATABASE_URL`, which is used outside Workers, stays on the transaction pooler URL (port 6543).

If `/api/health` returns `status: "degraded"`, the DB is fine but at least one optional integration (Stripe / email / Twilio / Sentry / PostHog) is unconfigured. Visit `/admin/health` for a per-integration breakdown with fix hints, or read `checks.*` in the JSON.

The post-deploy smoke workflow (`.github/workflows/smoke-after-deploy.yml`) fails when `/api/health` returns non-200 against a non-localhost target — so a degraded prod deploy will paint the merge commit red without manual checking. There's also a scheduled health monitor (`.github/workflows/health-monitor.yml`) that probes every 15 minutes for between-deploy regressions.

## Rotation

If you need to rotate a secret:

1. Generate the new value in the provider's dashboard.
2. Run `pnpm exec wrangler secret put NAME` (add `--env staging` for staging). Workers use the new value from the next request on, with no redeploy.
3. `NEXT_PUBLIC_*` values are the exception, because they're compiled into the build. Change the GitHub variable and redeploy.
4. Revoke the old value in the provider.
