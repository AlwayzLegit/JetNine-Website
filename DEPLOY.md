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
1. Remove the custom domains from the edge Worker (`jetnine-edge`), or comment out `routes` in `edge/wrangler.jsonc` and redeploy it.
2. Recreate the two DNS records pointing at Vercel. Values at cutover (2026-11-03), both DNS-only:
   - `jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com` (Cloudflare flattens it to Vercel's A records)
   - `www.jetnine.com` CNAME `5e51739dca5adc0a.vercel-dns-016.com`
3. Restore `crons` in `vercel.json`.

Keep the Vercel project for two weeks after the cutover before deleting it.

### Edge cache Worker

The public hostnames (`jetnine.com`, `www`, `staging.jetnine.com`) are attached to a second, very small Worker, `jetnine-edge` / `jetnine-edge-staging` (`edge/worker.ts`, `edge/wrangler.jsonc`). It forwards to the app through a service binding and keeps public pages in the data centre cache.

Why: the app is a ~34 MB script, and Cloudflare loads it into a fresh isolate for a large share of requests on a low-traffic site. That load took 1–3 s even for pages Next already had cached. The edge Worker is a few kilobytes and answers a cached page in about 0.15 s.

- **What is cached:** anonymous `GET` requests for HTML the app marks with `s-maxage` (the ISR marketing pages). Served as-is for up to 5 minutes, then stale for up to a day while a background request refreshes it. API routes, `/quote`, `/account`, `/admin`, `/sign-in`, signed-in visitors, query strings and RSC navigations always pass through. The `x-edge-cache` response header says `HIT`, `STALE` or `MISS`.
- **Every release deploys both Workers, app first.** The edge Worker's `APP_VERSION` keys the cache; pass the released commit so the cache starts empty. Old HTML points at the previous build's script files, which no longer exist.

  ```bash
  pnpm exec opennextjs-cloudflare deploy -- --env ""
  pnpm exec wrangler deploy -c edge/wrangler.jsonc --env "" --var APP_VERSION:$(git rev-parse HEAD)
  ```

  For staging use `--env staging` in both. The deploy workflow does this itself.
- **An admin edit shows within about 5 minutes** on a cached page (the fresh window), plus one more visit to trigger the refresh. To clear everything at once, redeploy the edge Worker with a different `APP_VERSION`.
- **To take the cache out of the path,** deploy the edge Worker with `--var APP_VERSION:` (empty): it then forwards every request. To remove the Worker entirely, add the `routes` back to `wrangler.jsonc` and deploy the app; the custom domains move in that one step.

### Site media (blog hero images)

Blog hero images live in the R2 bucket `jetnine-media` (created once with `wrangler r2 bucket create jetnine-media`) under `blog/heroes/`. The app writes uploads there through its `MEDIA` binding and the edge Worker serves them at `/media/blog/heroes/<file>.webp`, cached for a year (filenames are never reused).

They used to be hot-linked from Supabase Storage, which ran the project past its egress quota (Supabase then answers every file with `402`). Posts written before the move still store the Supabase URL; `src/lib/media.ts` maps it to the `/media` path on read, and the edge Worker copies each old file out of Supabase the first time it is requested (`MEDIA_LEGACY_ORIGIN`). Once every old image has been viewed once, the Supabase `blog` bucket is no longer read.

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

## 7b. Turnstile on the public forms (optional)

The contact form, the quote wizard's last step and the empty-leg watchlist form can ask Cloudflare Turnstile for a human check. It is off until both keys exist, and the honeypots and per-IP rate limits apply either way.

1. Cloudflare dashboard → Turnstile → Add widget. Hostnames `jetnine.com` and `staging.jetnine.com`, mode Managed.
2. Site key (public, inlined at build time): add it as the GitHub repository variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Secret key: `wrangler secret put TURNSTILE_SECRET_KEY` (and again with `--env staging`).
4. Deploy. The widget stays invisible unless Cloudflare wants an interaction.

Submissions flagged `[SMOKE]` skip the check, so the post-deploy suite keeps passing. If Cloudflare's verify endpoint is unreachable the submission is allowed and the error is logged. To switch it off, delete the secret and redeploy.

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

## 8e2. The site's own sign-in (OPS-91)

Schema: migration `0056_site_sessions.sql` adds `user_sessions` (one row per
signed-in browser, only the SHA-256 of the cookie token) and
`user_credentials` (a password set after this change, bcrypt). RLS on, no
policies, no grants for `anon` or `authenticated`. It is additive: running it
changes nothing the live site reads. Apply it **before** the deploy:

```
DATABASE_URL="$DIRECT_URL" pnpm db:migrate
```

(or run the file in the SQL editor; it uses `if not exists`). Check: `select
count(*) from public.user_sessions;` returns 0. Way back: `drop table
public.user_sessions, public.user_credentials;` after reverting the merge.

Sign-in no longer calls Supabase Auth: `src/lib/session` checks the password
in place (the older bcrypt hash in `auth.users.encrypted_password`, or a newer
one in `user_credentials`, which wins), keeps the session on the server and
sets the host-only cookie `__Host-jn_session`. Sessions last 30 days and end
after 7 idle days, on sign-out and on a password change. Emailed sign-in links,
password reset mails and invites moved to the site's own mail in OPS-94 (8e3);
`/auth/callback` stays only for Supabase links already sent. A password changed after this
change is not known to Supabase, so after a revert that member resets it
again. `/api/health` shows `signin` in `failing` when the tables are missing.
No new secret.

## 8e3. Emailed links on the site's own mail (OPS-94)

Schema: migration `0057_auth_tokens.sql` adds `public.auth_tokens` (a one-time
token per row, only its SHA-256 stored, purpose `signin` 15 min, `reset` 30
min, `invite` 7 days) and lets the site create a `public.users` row itself: it
drops the foreign key `users_id_users_id_fk` to `auth.users` and gives `id` a
default. RLS on, no policies, no grants for `anon` or `authenticated`.
Additive for the live site. Apply it **before** the deploy (staging shares the
production database):

```
DATABASE_URL="$DIRECT_URL" pnpm db:migrate
```

(or run the file in the SQL editor; it is safe to run twice). Check:
`select count(*) from public.auth_tokens;` returns 0. Way back: see the header
of the file.

The sign-in link, the password reset mail and staff and client invites no
longer call Supabase Auth. They go out through `src/lib/email.ts`, so **each
environment needs `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` plus
`EMAIL_FROM`**. Links are built from `NEXT_PUBLIC_SITE_URL` (never the Host
header) and open `/auth/link`, which only shows a button: the token is spent
by the POST behind it, so a mail scanner that fetches the link cannot use it
up. In production with no mail provider the send reports a failure instead of
logging the link. The Supabase email templates are no longer used for new
links. `/auth/callback` stays for links Supabase already sent.

D1 twin (OPS-100 is on main): `src/db/d1/schema/sessions.ts` gains `authTokens`
and the D1 `users.id` gets an app-side default. The generated D1 migration is
`src/db/d1/migrations/0001_cynical_lady_deathstrike.sql` (one new table). It is
not applied anywhere yet; production stays on Postgres until the cutover row.

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

## 8h. Monitor Worker (OPS-60)

`jetnine-monitor` (folder `monitor/`) checks the site from outside it every 15 minutes and serves `GET /status`. It is a Worker of its own, so it keeps answering when the site does not. The deploy workflow's `monitor` job deploys it after the app and the edge Worker, with the same two repo secrets. Its state lives in one Durable Object declared in `monitor/wrangler.jsonc`: no namespace id, no dashboard step. Staging has its own copy, `jetnine-monitor-staging`.

- **What it checks:** `/api/health` answers 200 with `ok` true; `/`, `/contact` and `/cost-calculator` carry their title text; a path that does not exist must answer 404 (the canary: proof the probes can see a failure; it never raises an incident). GET only, a failed check is tried once more after 30 seconds.
- **The status address:** `https://jetnine-monitor.jetnine-inc.workers.dev/status` (staging: `jetnine-monitor-staging`). Fixed fields only: `v`, `ok`, `checkedAt`, `failingSince`, `streak`, `checks`, `canary`, `alerts`, `quietUntil`, `wouldHaveRaised`, `incidents`. 503 when the last round is over 45 minutes old. The daily `monitor-status` job of `health-monitor.yml` reads it (and a run by hand can read another address with `status_url`).
- **Quiet start:** `QUIET_UNTIL` in `monitor/wrangler.jsonc` is at least 24 hours after the merge. Before it a failing round is only written to `wouldHaveRaised`: no incident, no email. Move it first when the merge comes later than the date in the file. The old 15 minute GitHub check stays until that record has been read.
- **Alerts (owner step, optional):** `pnpm exec wrangler secret put ALERT_EMAIL -c monitor/wrangler.jsonc`, then the same with `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` (the value the site uses; `ALERT_FROM` is optional). It worked when `/status` shows `"alerts":"configured"`. Without them the monitor records and never emails.
- **Sign-in service check (OPS-90):** a fifth check reads `/api/health` and fails when its `failing` list names `auth`, which `/api/health` does when Supabase Auth does not answer 200 (since OPS-91 that guards emailed links, resets and invites; password sign-in has its own `signin` check in the same list, which this monitor check does not read), as when the project was restricted on 2026-11-16 (402). `/api/health` itself stays 200 and `ok` stays true then, so deploy smoke tests do not fail while the project is down. The check has its own quiet date, `SIGNIN_QUIET_UNTIL` in `monitor/wrangler.jsonc` (both envs): before it a failure is only written to `wouldHaveRaised`. Keep it at least 24 hours after the merge, and move it first when the merge comes later than the date in the file. A missing or broken value stays quiet.
- **Silence it:** `pnpm exec wrangler delete --name jetnine-monitor` (owner), or push `QUIET_UNTIL` far into the future.

## 8i. Database target (D1 move, OPS-99)

JetNine's database is moving from Supabase Postgres to Cloudflare D1, one domain at a time.

- **Binding.** The staging Worker has a D1 binding `DB` (database `jetnine-staging`, migrations in `src/db/d1/migrations`). Production has no such binding and stays on Postgres.
- **Switch.** `DB_TARGET` (`postgres` or `d1`) names the database per environment. Staging sets `postgres` until the first converted domain row changes it. `src/db/target.mjs` reads it: anything but exactly `d1` means Postgres, and production refuses `d1` by code until the cutover row lifts that on purpose.
- **Code.** `dbTarget()` and `d1Db()` in `src/db/d1.ts` (re-exported from `src/db`). `db` and `sql` still point at Postgres; a converted domain calls `d1Db()` when `dbTarget()` is `d1`.
- **Health.** `checks.db` in `/api/health` (full view and `/admin/health`) shows `target`, `d1` (`absent`, `ok` or `error`) and `d1Tables`. D1 never changes `ok` or the status.
- **Converted to D1: blog (posts, subscribers), OPS-109.** Staging runs `DB_TARGET` `d1`, so the blog reads and writes the D1 twin tables through `src/domain/blog/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`). Production stays on Postgres. Other domains on staging still use Postgres through Hyperdrive. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Migrations.** The staging run of "Deploy (Cloudflare)" applies D1 migrations (`wrangler d1 migrations apply jetnine-staging --env staging --remote`) with the repo's own `CLOUDFLARE_API_TOKEN`, then prints `D1 jetnine-staging tables: N`.
- **Converted to D1: reference data (operators, operator contacts, aircraft, airports, FBOs), OPS-112.** The admin lists, detail pages and editors, the ops board fleet list and `/api/v1/reference` read and write through `src/domain/reference/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. Staging-only effect: once staging runs `d1`, an operator, aircraft or airport created on staging lives only in staging D1, so choosing it in a staging request or trip form (still Postgres) fails on the foreign key, until those domains move. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.
- **Converted to D1: contact form and guide download leads (contact_inquiries), OPS-122.** The public contact form, the pricing guide download form, the desk's new-inquiry count, the admin Website form tab and its handle and reopen action read and write through `src/domain/contact/store.ts` (a Postgres adapter and a D1 adapter, one chosen per request by `dbTarget()`); production stays on Postgres. The audit log and the rate limits stay on Postgres (OPS-123). Staging-only effect: on staging the signed-in user and member come from Postgres, so a contact form sent by a signed-in member created after the last D1 copy, or a handle by a staff user created after it, fails on the D1 foreign key; anonymous sends, the guide form and staff copied by the D1 load work. Undo on staging: set `DB_TARGET` back to `postgres` in `wrangler.jsonc` and redeploy staging.

## 9. Custom domain

`jetnine.com` and `www` are custom domains of the edge cache Worker (see §2 → Cutover and Edge cache Worker), and Cloudflare issues their certificates.

`NEXT_PUBLIC_SITE_URL` comes from the `wrangler.jsonc` vars at runtime and from the deploy workflow at build time. The sitemap, OG URLs, Stripe redirects and canonical tags all use it.

## Trigger logic made by the app (OPS-102)

Three more Postgres triggers have an app-side twin, so the rule holds on D1 too. The triggers stay in place on Postgres until the cutover (their removal needs the owner's yes and the exact statement); each app function recomputes from the current rows, so running beside the trigger arrives at the same values.

- **Aircraft calendar.** `syncTripScheduleBlock(tx, tripId)` in `src/domain/trips/schedule-block.ts`, after a trip is converted (`src/domain/requests/commands.ts`, after its legs are inserted) and after a status change (`src/domain/trips/commands.ts`). Same window rules as `trips_sync_schedule_block`: wheels up, else the earliest leg departure (a date alone is 00:00 UTC); wheels down, else the ETA, else the latest leg arrival; no aircraft, no window or a cancelled trip means no block.
- **Member tier.** `syncMemberTier(tx, membershipId, previousStatus)` in `src/domain/memberships/tier.ts`, after each membership write (`src/app/account/memberships/actions.ts`, and the Stripe webhook, in one transaction with the activation). An active membership sets the tier from its program and tier_since from activated_on; losing the last active one resets the tier to on_demand.
- **Role lock.** `setUserRole(actorRole, ...)` in `src/lib/auth-users.ts` refuses a role change unless the actor is an admin or superadmin (`src/lib/role-lock.ts`). The only caller is `src/domain/team/commands.ts`.
- Tests: CI step "Trigger-logic tests".

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

## After a deploy: retries and the tail summary (OPS-104)

Requests were cut off a few minutes after some production deploys, and the same read passed minutes later. The cause is not yet read from evidence, so a deploy run now records it instead of guessing.

- **Smoke and sitemap reads name their cause.** When a read throws, the smoke line carries the reason (`UND_ERR_SOCKET`, `ECONNRESET`, a timeout, a cut body) and how long it took, plus the `cf-ray` and edge cache state of the latest response. The sitemap audit names the URL and the exception type of every error (for example `https://jetnine.com/blog/x: IncompleteRead(26647 bytes read)`).
- **One retry, transport errors only.** A GET or HEAD that fails because the connection was reset or closed, the body was cut off or the 15 s timeout fired is tried once more after 10 s (`SMOKE_RETRY_DELAY_MS`, `SITEMAP_RETRY_DELAY`). A wrong status, a wrong redirect, a missing string or a wrong header is never retried and fails at once. A read that fails twice fails the job.
- **A retry is a warning to look at, not a pass to ignore.** Every first failure is a `::warning` annotation on the run with URL, cause, `cf-ray` and time, and the run ends with "N reads needed a retry". If the same URL needs a retry after several deploys, treat it as a real cut-off for visitors.
- **The `tail` job.** After the app deploy, `tail` in `deploy-cloudflare.yml` runs `wrangler tail` on the edge and app Workers (the `-staging` names on staging) for up to 6 minutes, or until the smoke and sitemap jobs are done. Its job summary and the artifact `deploy-tail-summary` list, per Worker, every event whose outcome is not `ok` (exception, exceededCpu, exceededMemory, canceled, responseStreamDisconnected) with time, method, path without query string and the exception name. Tokens and ids in paths are masked. It never prints headers, query strings, bodies, log lines or exception messages, and the raw tail is not uploaded. It uses the repo's own deploy token; if that cannot tail, the summary says so in one line and the job passes. The job never fails a deploy.
- **The summary says how many events it read.** Each Worker block starts with "Events read: N". `wrangler tail --format json` prints every event as indented JSON over many lines, so the summary reads a stream of JSON objects, not one object per line. "0 not ok" next to "Events read: 0" means the tail saw nothing, not that all was well; check the attach time and that the smoke job sent requests in the window.
- **Reading the summary.** Compare its times with the smoke and sitemap jobs of the same run. Non-ok outcomes on visitor paths (exceededCpu, exceededMemory, responseStreamDisconnected, exceptions on pages) are a real fault to file with that evidence. Retries in the checks and nothing in the tail point at the checks racing the rollout. The tail attaches after the deploy job ends, so the first seconds of the new version can fall before it; its summary prints when it attached.
- **Staging robots.** The smoke check holds staging to the same rule as previews (`Disallow: /` and no `Sitemap:` line), matching `src/app/robots.ts`. Production is still held to the production rule.

Tests: `pnpm exec tsx --test scripts/smoke-fetch.test.mts`, `node --test scripts/deploy-tail/summarize.test.mjs`, `python3 scripts/test-live-sitemap.py`.

## Codes and timestamps made by the app (OPS-101)

D1 cannot run Postgres triggers, so the work of two kinds of trigger now happens in the app, and the triggers stay in place on Postgres until the cutover (their removal needs the owner's yes and the exact statement).

- **Codes.** `nextCode(tx, kind)` in `src/db/codes.ts` makes JN-YYYY-NNNNN (quote), JN-YYYY-NNNN (trip), INV-YYYY-NNNN, EL-YYYY-NNNN and M-YYYY-NNNN with one upsert on the `[kind]_code_sequence` table (`insert ... on conflict (year) do update set last_value = last_value + 1 returning last_value`). The year is UTC. The five insert paths call it in the same transaction as the insert: `src/app/quote/actions.ts`, `src/domain/requests/commands.ts` (trip and invoice), `src/domain/clients/commands.ts`, `src/domain/empty-legs/commands.ts`. The triggers fill a code only when it is empty, so they do nothing now and the counter moves once.
- **updated_at.** The 14 tables that had the `set_updated_at` trigger (aircraft, airports, aircraft_schedule_blocks, empty_legs, fbos, invoices, member_preferences, members, memberships, operators, quotes, staff, trips, users) carry `$onUpdate(() => new Date())`. On Postgres the trigger then sets the same value in the same write.
- Still to move: the schedule-block and member-tier syncs and the role lock (OPS-102), the new-user trigger (OPS-94). Row level security and its helper functions are not moved: D1 has none, and the app's own checks guard the data.
- Tests: `src/db/codes.test.ts` (CI step "Codes and updated-at tests").

## Rotation

If you need to rotate a secret:

1. Generate the new value in the provider's dashboard.
2. Run `pnpm exec wrangler secret put NAME` (add `--env staging` for staging). Workers use the new value from the next request on, with no redeploy.
3. `NEXT_PUBLIC_*` values are the exception, because they're compiled into the build. Change the GitHub variable and redeploy.
4. Revoke the old value in the provider.

## D1 tables (OPS-100)

The 50 tables of `src/db/schema` are written a second time for Cloudflare D1 (SQLite) in `src/db/d1/schema`, one file per Postgres file, same export, table and column names. Nothing live reads them yet; later rows convert the data code one domain at a time.

How types map, decided once:

- `uuid` is `text`, made in the app (`newId`). `timestamp` is `integer` in `timestamp_ms` mode: UTC milliseconds, read back as `Date`. `date` and `time` are `text` (`YYYY-MM-DD`, `HH:MM:SS`); `numeric` is `text`, so decimals stay exact strings. `boolean` is `integer` in `boolean` mode. `jsonb` and `text[]` are `text` holding JSON. `char(n)` is `text` plus a length CHECK.
- A Postgres enum is `text` with the same values (read from the Postgres enum, so there is one list) plus a CHECK named `<table>_<column>_enum` (`enumCheck` in `src/db/d1/helpers.ts`).
- Defaults that Postgres ran in the database (`now()`, `current_date`, `gen_random_uuid()`, `encode(gen_random_bytes(24), 'hex')`, `now() + interval`) run in the app (`src/db/d1/helpers.ts`). Raw SQL inserts no longer get them.
- No equal in D1: the `auth` schema (so `users.id` has no foreign key), row level security, and Postgres functions and triggers (OPS-101). `api_keys` scope CHECKs are rewritten with string tests because SQLite forbids subqueries in CHECK.
- Regenerate with `pnpm db:d1:generate` (`drizzle.d1.config.ts`); the migration goes to `src/db/d1/migrations` and the staging deploy applies it. The test `src/db/d1/parity.test.ts` runs in CI and fails when a Postgres table, column, not-null flag, primary key, foreign key count, index count or enum CHECK has no D1 twin.


## Copy Postgres to staging D1 (OPS-105)

Step 5 of the move to Cloudflare (OPS-93): fill staging's own D1 database from Postgres and prove the copy is whole. Production's database is never written.

- Run the GitHub workflow **D1 copy** by hand (Actions, Run workflow). `mode = load` applies the D1 migrations, wipes the staging D1 tables, copies all 51 tables and then checks; `mode = check` only compares. It uses the repo secrets `DATABASE_URL`, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Postgres is read in one read-only snapshot, so every table comes from the same moment. Values are mapped by the rules in "D1 tables (OPS-100)" above (`scripts/d1-copy/map.mjs`).
- The log has one line per table: Postgres rows, D1 rows, and "checksum equal yes or no". The checksum is an order-independent hash of each row's key and its `updated_at` (or `created_at`). No row value is printed, and wrangler's own text is not echoed. A failure prints an error code only.
- The tool refuses any target other than the database `jetnine-staging` with `--env staging`; the guard runs before any call. `pnpm exec tsx scripts/d1-copy/copy.mjs --list` prints the table plan with no network.
- **Held back on purpose:** `user_credentials` (password hashes), `user_sessions` (session token hashes), `api_keys` (key hashes) and `ai_providers` (encrypted provider keys). These are not copied to staging. Moving credentials is the owner's decision and belongs to the cutover row.
- Staging D1 is a test copy, not a source of truth. Run the copy again whenever a fresh copy is needed; it starts by wiping.
- The reverse copy (D1 back to Postgres, for a rollback) is not part of this row.
- Tests (`scripts/d1-copy/*.test.*`) run in CI and need no secrets or network.

### Load order, nulled references and the preflight (OPS-115)

The first load failed with `SQLITE_CONSTRAINT` and the log did not say where. What changed:

- **Parents first.** The table plan is in referential order (a parent table before every table that has a foreign key to it, ties by name). The file deletes children first (the plan in reverse) and inserts parents first. `--list` prints this order. If the keys ever form a cycle, the plan throws and names the tables.
- **Five references are written as NULL.** `agent_runs.key_id`, `api_requests.key_id` and `approvals.requested_by_key` point to `api_keys`; `ai_routes.primary_provider_id` and `ai_routes.fallback_provider_id` point to `ai_providers`. Both parents are held back and load empty, so a real value would break the key. All five columns are nullable (the plan throws if one ever is not, and then that table would have to be held back too, which is the owner's call). The log says how many rows had such a reference set to null, per table.
- **Preflight, before staging is touched.** The tool builds an in-memory SQLite database from the repo's own D1 migrations (Node's built-in `node:sqlite`), loads every table's rows into it with foreign keys off, then runs `PRAGMA foreign_key_check`. A rule the real data does not meet is printed as `preflight FAIL [table]: [kind and names]` (for example `UNIQUE members.email`, `NOT NULL quotes.total`, `CHECK agent_memory_kind_check`, or `FOREIGN KEY child -> parent: 2 rows`), followed by `staging D1 not touched`, and the run exits 1. A statement longer than D1's 100,000 bytes is reported the same way. Only table, column and constraint names are printed, never a value. If `node:sqlite` is missing the preflight cannot run and the run stops, also before staging is touched.
- **Clean preflight** prints `preflight ok: [n] tables, [rows] rows; ...` and the remote load follows as before.
- **If the remote load still fails** the log prints the error code with the constraint kind and names, then counts the rows of every table in staging D1: `staging D1 after the failed load: empty` or `partial, [x] of [n] tables have rows (a new load wipes it first)`. Running the load again is always safe.
- Nothing else changed: the staging-only guard, the held-back tables (never read from Postgres), no row value in any log line.
